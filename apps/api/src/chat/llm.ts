import type { HistoryTurn } from '../core/chat.js';

export interface LlmRequest {
  system: string;
  messages: HistoryTurn[];
  maxTokens: number;
}

export type LlmEvent =
  | { type: 'text'; delta: string }
  | { type: 'finish'; reason: 'stop' | 'length' };

export type LlmErrorCode =
  'upstream_rate_limited' | 'upstream_timeout' | 'upstream_error';

export class LlmError extends Error {
  constructor(
    readonly code: LlmErrorCode,
    detail?: string,
    readonly retryAfterS?: number,
  ) {
    super(detail ?? code);
  }
}

/**
 * One streaming generation. Adapters map HTTP 429 to `upstream_rate_limited`
 * and any other failure (non-2xx, refusal, broken stream) to `upstream_error`.
 * Deadlines are not theirs: `withDeadlines` owns them.
 */
export interface LlmProvider {
  stream(req: LlmRequest, signal: AbortSignal): AsyncIterable<LlmEvent>;
}

export const FAKE_SCENARIOS = {
  ok: 'answers in a few chunks, citing the first id in DATA',
  length: 'like ok, but stops for length',
  mid_error: 'one chunk, then a provider error',
  empty: 'finishes without any text',
  rate_limited: 'the provider answers 429 before any text',
  error: 'the provider fails before any text',
} as const;

export type FakeScenario = keyof typeof FAKE_SCENARIOS;

export interface LlmSettings {
  model: string;
  apiKey: string;
  baseUrl: string;
  fake: { scenario: FakeScenario; delayMs: number };
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

function fakeLlm({ fake }: LlmSettings): LlmProvider {
  return {
    async *stream(req, signal) {
      await sleep(fake.delayMs, signal);
      if (fake.scenario === 'rate_limited') {
        throw new LlmError('upstream_rate_limited', 'fake 429', 7);
      }
      if (fake.scenario === 'error') throw new LlmError('upstream_error', 'fake 500');
      if (fake.scenario === 'empty') {
        yield { type: 'finish', reason: 'stop' };
        return;
      }
      const cite = /[EP]-[a-z0-9]+/.exec(req.system.split('DATA:')[1] ?? '');
      const chunks = [
        '기록을 보니 ',
        '둘이 스쳤던 것 같아. ',
        cite ? `[${cite[0]}]` : '아직 근거가 부족해.',
      ];
      for (const [i, delta] of chunks.entries()) {
        if (i > 0) await sleep(fake.delayMs, signal);
        if (fake.scenario === 'mid_error' && i === 1) {
          throw new LlmError('upstream_error', 'fake mid-stream failure');
        }
        yield { type: 'text', delta };
      }
      await sleep(fake.delayMs, signal);
      yield {
        type: 'finish',
        reason: fake.scenario === 'length' ? 'length' : 'stop',
      };
    },
  };
}

export async function* sseData(
  body: AsyncIterable<Uint8Array>,
): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let end = buffer.indexOf('\n');
    while (end >= 0) {
      const line = buffer.slice(0, end).replace(/\r$/, '');
      buffer = buffer.slice(end + 1);
      if (line.startsWith('data:')) yield line.slice(5).trimStart();
      end = buffer.indexOf('\n');
    }
  }
}

interface CompletionChunk {
  error?: { message?: string };
  choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[];
}

function openAiCompatible(s: LlmSettings): LlmProvider {
  return {
    async *stream(req, signal) {
      const fail = (e: unknown): never => {
        if (e instanceof LlmError || signal.aborted) throw e;
        throw new LlmError('upstream_error', String(e));
      };
      const res = await fetch(`${s.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        signal,
        headers: {
          authorization: `Bearer ${s.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: s.model,
          stream: true,
          max_tokens: req.maxTokens,
          messages: [{ role: 'system', content: req.system }, ...req.messages],
        }),
      }).catch(fail);
      if (res.status === 429) {
        const wait = Number(res.headers.get('retry-after'));
        throw new LlmError(
          'upstream_rate_limited',
          'provider 429',
          Number.isInteger(wait) && wait > 0 ? wait : undefined,
        );
      }
      if (!res.ok || !res.body) {
        throw new LlmError('upstream_error', `provider HTTP ${res.status}`);
      }
      try {
        for await (const data of sseData(res.body)) {
          if (data === '[DONE]') break;
          const chunk = JSON.parse(data) as CompletionChunk;
          if (chunk.error) {
            throw new LlmError('upstream_error', chunk.error.message);
          }
          const choice = chunk.choices?.[0];
          const delta = choice?.delta?.content;
          if (delta) yield { type: 'text', delta };
          const reason = choice?.finish_reason;
          if (reason === 'stop' || reason === 'length') {
            yield { type: 'finish', reason };
            return;
          }
          if (reason) throw new LlmError('upstream_error', `finish ${reason}`);
        }
      } catch (e) {
        fail(e);
      }
      throw new LlmError('upstream_error', 'stream ended without a finish');
    },
  };
}

export const LLM_ADAPTERS = {
  fake: fakeLlm,
  'openai-compatible': openAiCompatible,
} satisfies Record<string, (s: LlmSettings) => LlmProvider>;

export type LlmProviderName = keyof typeof LLM_ADAPTERS;

export interface Deadlines {
  firstMs: number;
  idleMs: number;
}

export async function* withDeadlines(
  source: AsyncIterable<LlmEvent>,
  ctl: AbortController,
  deadlines: Deadlines,
): AsyncGenerator<LlmEvent> {
  const it = source[Symbol.asyncIterator]();
  let limit = deadlines.firstMs;
  for (;;) {
    let timer: NodeJS.Timeout | undefined;
    const next = it.next();
    // After a timeout the provider's pending step rejects with the abort; nobody waits for it.
    next.catch(() => {});
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        ctl.abort();
        reject(new LlmError('upstream_timeout'));
      }, limit);
    });
    let r: IteratorResult<LlmEvent>;
    try {
      r = await Promise.race([next, timeout]);
    } finally {
      clearTimeout(timer);
    }
    if (r.done) return;
    yield r.value;
    limit = deadlines.idleMs;
  }
}
