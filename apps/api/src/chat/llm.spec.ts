import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  LLM_ADAPTERS,
  LlmError,
  type LlmEvent,
  type LlmSettings,
  sseData,
  withDeadlines,
} from './llm.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function collect(it: AsyncIterable<LlmEvent>) {
  const events: LlmEvent[] = [];
  try {
    for await (const e of it) events.push(e);
    return { events };
  } catch (error) {
    return { events, error: error as LlmError };
  }
}

async function* timed(...steps: [number, LlmEvent][]): AsyncGenerator<LlmEvent> {
  for (const [ms, event] of steps) {
    await sleep(ms);
    yield event;
  }
}

describe('withDeadlines', () => {
  const text = (delta: string): LlmEvent => ({ type: 'text', delta });
  const deadlines = { firstMs: 60, idleMs: 30 };

  it('passes events through when every deadline is met', async () => {
    const ctl = new AbortController();
    const r = await collect(withDeadlines(timed([40, text('a')], [10, text('b')]), ctl, deadlines));
    expect(r).toEqual({ events: [text('a'), text('b')] });
    expect(ctl.signal.aborted).toBe(false);
  });

  it('times out a slow first event and aborts the provider', async () => {
    const ctl = new AbortController();
    const r = await collect(withDeadlines(timed([100, text('a')]), ctl, deadlines));
    expect(r.error?.code).toBe('upstream_timeout');
    expect(r.events).toEqual([]);
    expect(ctl.signal.aborted).toBe(true);
  });

  it('times out a stall between events', async () => {
    const ctl = new AbortController();
    const r = await collect(withDeadlines(timed([10, text('a')], [60, text('b')]), ctl, deadlines));
    expect(r.error?.code).toBe('upstream_timeout');
    expect(r.events).toEqual([text('a')]);
  });

  it('does not count the consumer’s own time against the provider', async () => {
    const ctl = new AbortController();
    const events: LlmEvent[] = [];
    for await (const e of withDeadlines(timed([5, text('a')], [5, text('b')]), ctl, deadlines)) {
      events.push(e);
      await sleep(80);
    }
    expect(events).toHaveLength(2);
    expect(ctl.signal.aborted).toBe(false);
  });
});

describe('sseData', () => {
  it('joins lines and multi-byte characters split across chunks', async () => {
    const bytes = new TextEncoder().encode('data: {"t":"안녕"}\r\n\n: comment\ndata:[DONE]\n');
    const chunks = [bytes.slice(0, 13), bytes.slice(13, 15), bytes.slice(15)];
    const out: string[] = [];
    for await (const d of sseData((async function* () { yield* chunks; })())) out.push(d);
    expect(out).toEqual(['{"t":"안녕"}', '[DONE]']);
  });
});

describe('openai-compatible adapter', () => {
  let server: Server;
  let reply: (res: import('node:http').ServerResponse, body: any) => void;
  let seen: { auth?: string; body?: any } = {};
  let settings: LlmSettings;

  beforeAll(async () => {
    server = createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        seen = { auth: req.headers.authorization, body: JSON.parse(raw) };
        reply(res, seen.body);
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    settings = {
      model: 'test-model',
      apiKey: 'sk-test',
      baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1/`,
      fake: { scenario: 'ok', delayMs: 0 },
    };
  });
  afterAll(() => new Promise((r) => server.close(r)));

  const run = () =>
    collect(
      LLM_ADAPTERS['openai-compatible'](settings).stream(
        { system: 'SYS', messages: [{ role: 'user', content: 'Q' }], maxTokens: 800 },
        new AbortController().signal,
      ),
    );

  const sse = (...chunks: unknown[]) => (res: import('node:http').ServerResponse) => {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    for (const c of chunks) res.write(`data: ${typeof c === 'string' ? c : JSON.stringify(c)}\n\n`);
    res.end();
  };
  const delta = (content: string, finish: string | null = null) => ({
    choices: [{ delta: { content }, finish_reason: finish }],
  });

  it('streams text and the finish reason, sending the model, key, cap and system prompt', async () => {
    reply = sse(delta('안'), delta('녕'), delta('', 'length'), '[DONE]');
    expect(await run()).toEqual({
      events: [
        { type: 'text', delta: '안' },
        { type: 'text', delta: '녕' },
        { type: 'finish', reason: 'length' },
      ],
    });
    expect(seen.auth).toBe('Bearer sk-test');
    expect(seen.body).toMatchObject({
      model: 'test-model',
      stream: true,
      max_tokens: 800,
      messages: [
        { role: 'system', content: 'SYS' },
        { role: 'user', content: 'Q' },
      ],
    });
  });

  it('maps 429 to upstream_rate_limited with the provider’s Retry-After', async () => {
    reply = (res) => res.writeHead(429, { 'retry-after': '12' }).end();
    const { error } = await run();
    expect(error).toBeInstanceOf(LlmError);
    expect([error?.code, error?.retryAfterS]).toEqual(['upstream_rate_limited', 12]);
  });

  it('maps other failures to upstream_error', async () => {
    const cases: ((res: import('node:http').ServerResponse) => void)[] = [
      (res) => res.writeHead(401).end(),
      (res) => res.writeHead(503).end(),
      sse(delta('a'), delta('', 'content_filter')),
      sse(delta('a')),
      sse({ error: { message: 'boom' } }),
      sse('not json'),
    ];
    for (const c of cases) {
      reply = c;
      expect((await run()).error?.code).toBe('upstream_error');
    }
  });
});
