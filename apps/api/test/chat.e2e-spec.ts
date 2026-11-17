import { randomUUID } from 'node:crypto';
import {
  type PairedRoom,
  pairedRoom,
  type Seat,
  uploadShots,
} from './fixtures.js';
import { type Api, type CallResult, type OpenStream, startApi } from './harness.js';

let api: Api;
beforeAll(async () => {
  api = await startApi();
});
afterAll(() => api.close());

async function withApi<T>(env: Record<string, string>, fn: (api: Api) => Promise<T>) {
  const scoped = await startApi({ env });
  try {
    return await fn(scoped);
  } finally {
    await scoped.close();
  }
}

async function chatRoom(on = api): Promise<PairedRoom> {
  const room = await pairedRoom(on);
  for (const seat of [room.a, room.b]) {
    await on.call('updateMe', {
      params: { roomId: room.roomId },
      token: seat.token,
      json: { aiConsent: true },
    });
  }
  await uploadShots(on, room, room.a, [{ lat: 37.5284, lng: 126.9341, at: '2022:04:09 15:12:00' }]);
  await uploadShots(on, room, room.b, [{ lat: 37.5275, lng: 126.9363, at: '2022:04:09 15:20:00' }]);
  return room;
}

const ask = (room: PairedRoom, seat: Seat, content: unknown, on = api) =>
  on.call('chat', { params: { roomId: room.roomId }, token: seat.token, json: { content } });

const frames = (res: CallResult) =>
  (res.body as string).split('\n').filter(Boolean).map((l) => JSON.parse(l));

const history = (room: PairedRoom, query: Record<string, string | number> = {}, on = api) =>
  on.call('listChatMessages', { params: { roomId: room.roomId }, token: room.a.token, query });

async function openChat(room: PairedRoom, seat: Seat, on: Api): Promise<OpenStream> {
  const res = await on.open('chat', {
    params: { roomId: room.roomId },
    token: seat.token,
    json: { content: '우리 어디서 스쳤어?' },
  });
  if (!('frames' in res)) throw new Error(`chat ${res.status}`);
  return res;
}

async function rest(stream: OpenStream) {
  const out = [];
  for await (const f of stream.frames) out.push(f);
  return out;
}

async function settled(room: PairedRoom, on = api) {
  for (let i = 0; i < 100; i++) {
    const { body } = await history(room, {}, on);
    if (!body.messages.some((m: any) => m.status === 'streaming')) return body.messages;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('answer never settled');
}

const quotaUsed = async (room: PairedRoom, on = api) =>
  (await on.call('getRoom', { params: { roomId: room.roomId }, token: room.a.token })).body
    .chat.used;

const usageToday = async () =>
  (
    await api.sql(
      `SELECT coalesce(sum(count), 0)::int AS n FROM chat_usage
        WHERE day = (now() AT TIME ZONE 'Asia/Seoul')::date`,
    )
  )[0].n as number;

describe('chat', () => {
  it('streams meta, text and done, and stores the question and the answer', async () => {
    const room = await chatRoom();
    const before = await api.call('getRoom', { params: { roomId: room.roomId }, token: room.a.token });
    const res = await ask(room, room.b, '  우리 처음 스친 곳 어디야?  ');
    expect(res.status).toBe(200);

    const [meta, ...more] = frames(res);
    const snapshot = await api.call('getSnapshot', { params: { roomId: room.roomId }, token: room.a.token });
    const encounterId = snapshot.body.encounters[0].id;
    expect(meta).toMatchObject({
      type: 'meta',
      revision: before.body.revision,
      quota: { used: 1, limit: 30 },
    });
    expect(meta.evidenceIds).toContain(encounterId);
    expect(more.at(-1)).toEqual({ type: 'done', finishReason: 'stop' });
    const answer = more.filter((f) => f.type === 'text').map((f) => f.delta).join('');
    expect(answer).toContain(`[${encounterId}]`);

    const { body } = await history(room);
    expect(body).toEqual({
      hasMore: false,
      messages: [
        expect.objectContaining({
          id: meta.userMessageId,
          role: 'user',
          authorId: room.b.id,
          content: '우리 처음 스친 곳 어디야?',
          evidenceIds: [],
          status: 'complete',
        }),
        expect.objectContaining({
          id: meta.assistantMessageId,
          role: 'assistant',
          authorId: null,
          content: answer,
          evidenceIds: [encounterId],
          status: 'complete',
        }),
      ],
    });
    const after = await api.call('getRoom', { params: { roomId: room.roomId }, token: room.a.token });
    expect(after.body.chatLastMessageId).toBe(meta.assistantMessageId);
    expect(after.body.revision).toBe(before.body.revision);
  });

  it('marks an answer cut for length as truncated', async () => {
    await withApi({ LLM_FAKE_SCENARIO: 'length' }, async (on) => {
      const room = await chatRoom(on);
      const res = await ask(room, room.a, '길게 말해줘', on);
      expect(frames(res).at(-1)).toEqual({ type: 'done', finishReason: 'length' });
      expect((await settled(room, on))[1].status).toBe('truncated');
    });
  });

  it('rejects an empty, overlong, control-character or extra-field question', async () => {
    const room = await chatRoom();
    for (const content of ['   ', 'x'.repeat(1001), 'a\u0000b']) {
      const res = await ask(room, room.a, content);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('validation_failed');
    }
    const extra = await api.call('chat', {
      params: { roomId: room.roomId },
      token: room.a.token,
      json: { content: 'hi', model: 'gpt' },
    });
    expect(extra.status).toBe(400);
    const multiline = await ask(room, room.a, '첫 줄\n둘째 줄');
    expect(multiline.status).toBe(200);
  });

  it('answers 401 for a bad token and 404 for an unknown room', async () => {
    const room = await chatRoom();
    expect((await ask(room, { id: '', token: 'nope' }, 'hi')).status).toBe(401);
    const missing = await api.call('chat', {
      params: { roomId: 'AAAAAAAAAAAAAAAAAAAAAA' },
      token: 'x',
      json: { content: 'hi' },
    });
    expect(missing.status).toBe(404);
  });

  it('needs both participants to allow AI', async () => {
    const room = await pairedRoom(api);
    await api.call('updateMe', {
      params: { roomId: room.roomId },
      token: room.a.token,
      json: { aiConsent: true },
    });
    const res = await ask(room, room.a, 'hi');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ai_consent_required');
    expect(await quotaUsed(room)).toBe(0);
  });

  it('allows one answer at a time per room, and a busy room costs no quota', async () => {
    await withApi({ LLM_FAKE_DELAY_MS: '150' }, async (on) => {
      const room = await chatRoom(on);
      const first = await openChat(room, room.a, on);
      expect((await first.frames.next()).value.type).toBe('meta');

      const busy = await ask(room, room.b, '나도 물어볼래', on);
      expect(busy.status).toBe(409);
      expect(busy.body.code).toBe('chat_busy');
      expect(await quotaUsed(room, on)).toBe(1);

      expect((await rest(first)).at(-1).type).toBe('done');
    });
  });

  it('keeps generating and saves the whole answer after the client disconnects', async () => {
    await withApi({ LLM_FAKE_DELAY_MS: '150' }, async (on) => {
      const room = await chatRoom(on);
      const stream = await openChat(room, room.a, on);
      const meta = (await stream.frames.next()).value;
      stream.disconnect();

      const messages = await settled(room, on);
      const answer = messages.find((m: any) => m.id === meta.assistantMessageId);
      expect(answer.status).toBe('complete');
      expect(answer.content).toMatch(/^기록을 보니 둘이 스쳤던 것 같아\. \[E-[a-z0-9]{6}\]$/);
    });
  });

  it('ends the stream without done when a kick wipes the history mid-answer', async () => {
    await withApi({ LLM_FAKE_DELAY_MS: '150' }, async (on) => {
      const room = await chatRoom(on);
      const stream = await openChat(room, room.a, on);
      await stream.frames.next();
      const kick = await on.call('removePartner', {
        params: { roomId: room.roomId, participantId: room.b.id },
        token: room.a.token,
      });
      expect(kick.status).toBe(200);
      const tail = await rest(stream);
      expect(tail.map((f) => f.type)).not.toContain('done');
      expect(await on.sql('SELECT 1 FROM chat_messages WHERE room_id = $1', [room.roomId])).toEqual([]);
    });
  });

  it('stops at the hourly room quota without touching the daily counter', async () => {
    await withApi({ CHAT_ROOM_HOURLY_LIMIT: '1' }, async (on) => {
      const room = await chatRoom(on);
      expect((await ask(room, room.a, 'one', on)).status).toBe(200);
      const usage = await usageToday();
      const res = await ask(room, room.a, 'two', on);
      expect(res.status).toBe(429);
      expect(res.body.code).toBe('room_chat_quota_exceeded');
      expect(Date.parse(res.body.resetAt)).toBeGreaterThan(Date.now());
      expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(3500);
      expect(await usageToday()).toBe(usage);
    });
  });

  it('stops at the daily service quota and rolls back the room reservation', async () => {
    const used = await usageToday();
    await withApi({ CHAT_DAILY_LIMIT: String(used + 1) }, async (on) => {
      const room = await chatRoom(on);
      expect((await ask(room, room.a, 'one', on)).status).toBe(200);
      const res = await ask(room, room.a, 'two', on);
      expect(res.status).toBe(429);
      expect(res.body.code).toBe('global_chat_quota_exceeded');
      expect(res.body.resetAt).toMatch(/T15:00:00\.000Z$/);
      expect(await quotaUsed(room, on)).toBe(1);
      expect((await history(room, {}, on)).body.messages).toHaveLength(2);
    });
  });

  it('passes a provider 429 through with Retry-After and keeps the failed answer', async () => {
    await withApi({ LLM_FAKE_SCENARIO: 'rate_limited' }, async (on) => {
      const room = await chatRoom(on);
      const res = await ask(room, room.a, 'hi', on);
      expect(res.status).toBe(429);
      expect(res.body.code).toBe('upstream_rate_limited');
      expect(res.body.resetAt).toBeUndefined();
      expect(res.headers.get('retry-after')).toBe('7');
      expect((await settled(room, on)).map((m: any) => m.status)).toEqual(['complete', 'failed']);
      expect(await quotaUsed(room, on)).toBe(1);
    });
  });

  it('answers 502 when the provider fails or says nothing before the first token', async () => {
    for (const scenario of ['error', 'empty']) {
      await withApi({ LLM_FAKE_SCENARIO: scenario }, async (on) => {
        const room = await chatRoom(on);
        const res = await ask(room, room.a, 'hi', on);
        expect(res.status).toBe(502);
        expect(res.body.code).toBe('upstream_error');
      });
    }
  });

  it('answers 504 when the first token misses its deadline', async () => {
    await withApi(
      { LLM_FAKE_DELAY_MS: '300', LLM_FIRST_TOKEN_TIMEOUT_MS: '100' },
      async (on) => {
        const room = await chatRoom(on);
        const res = await ask(room, room.a, 'hi', on);
        expect(res.status).toBe(504);
        expect(res.body.code).toBe('upstream_timeout');
        expect((await settled(room, on))[1].status).toBe('failed');
      },
    );
  });

  it('ends a started answer with an error frame and keeps the partial text', async () => {
    await withApi({ LLM_FAKE_SCENARIO: 'mid_error' }, async (on) => {
      const room = await chatRoom(on);
      const res = await ask(room, room.a, 'hi', on);
      expect(res.status).toBe(200);
      const all = frames(res);
      expect(all.map((f) => f.type)).toEqual(['meta', 'text', 'error']);
      expect(all[2]).toEqual({
        type: 'error',
        code: 'upstream_error',
        requestId: res.headers.get('x-request-id'),
      });
      const [, answer] = await settled(room, on);
      expect(answer).toMatchObject({ status: 'failed', content: '기록을 보니 ' });
    });
  });

  it('reports a stall between chunks as upstream_timeout', async () => {
    await withApi(
      { LLM_FAKE_DELAY_MS: '200', LLM_FIRST_TOKEN_TIMEOUT_MS: '2000', LLM_IDLE_TIMEOUT_MS: '100' },
      async (on) => {
        const room = await chatRoom(on);
        const all = frames(await ask(room, room.a, 'hi', on));
        expect(all.at(-1)).toMatchObject({ type: 'error', code: 'upstream_timeout' });
      },
    );
  });

  it('answers 503 when no LLM provider is configured', async () => {
    await withApi({ LLM_PROVIDER: '' }, async (on) => {
      const room = await chatRoom(on);
      const res = await ask(room, room.a, 'hi', on);
      expect(res.status).toBe(503);
      expect(res.body.code).toBe('server_misconfigured');
      expect(await quotaUsed(room, on)).toBe(0);
    });
  });
});

async function seedMessages(room: PairedRoom, n: number): Promise<string[]> {
  const ids = Array.from({ length: n }, () => randomUUID());
  for (const [i, id] of ids.entries()) {
    await api.sql(
      `INSERT INTO chat_messages (id, room_id, role, author_id, content, status)
       VALUES ($1, $2, 'user', $3, $4, 'complete')`,
      [id, room.roomId, room.a.id, `질문 ${i}`],
    );
  }
  return ids;
}

describe('listChatMessages', () => {
  const ids = (res: CallResult) => res.body.messages.map((m: any) => m.id);

  it('pages backwards from the latest and forwards from a known id, oldest first', async () => {
    const room = await pairedRoom(api);
    const all = await seedMessages(room, 5);

    const latest = await history(room, { limit: 2 });
    expect(latest.status).toBe(200);
    expect(ids(latest)).toEqual(all.slice(3));
    expect(latest.body.hasMore).toBe(true);

    const older = await history(room, { limit: 2, before: all[3] });
    expect(ids(older)).toEqual(all.slice(1, 3));
    expect(older.body.hasMore).toBe(true);
    const oldest = await history(room, { limit: 2, before: all[1] });
    expect(ids(oldest)).toEqual([all[0]]);
    expect(oldest.body.hasMore).toBe(false);

    const newer = await history(room, { limit: 3, after: all[0] });
    expect(ids(newer)).toEqual(all.slice(1, 4));
    expect(newer.body.hasMore).toBe(true);
    const newest = await history(room, { after: all[3] });
    expect(ids(newest)).toEqual([all[4]]);
    expect(newest.body.hasMore).toBe(false);
  });

  it('turns an answer left streaming for over 2 minutes into failed, and frees the room', async () => {
    const room = await chatRoom();
    await api.sql(
      `INSERT INTO chat_messages (id, room_id, role, status, content, updated_at)
       VALUES ($1, $2, 'assistant', 'streaming', '반쯤', now() - interval '3 minutes')`,
      [randomUUID(), room.roomId],
    );
    const { body } = await history(room);
    expect(body.messages.map((m: any) => [m.status, m.content])).toEqual([['failed', '반쯤']]);
    expect((await ask(room, room.a, 'hi')).status).toBe(200);
  });

  it('rejects both cursors at once, malformed values and ids from elsewhere', async () => {
    const room = await pairedRoom(api);
    const [mine] = await seedMessages(room, 1);
    const other = await pairedRoom(api);
    const [theirs] = await seedMessages(other, 1);
    const bad: Record<string, string | number>[] = [
      { before: mine, after: mine },
      { before: 'not-a-uuid' },
      { limit: 0 },
      { limit: 101 },
      { limit: 'ten' },
      { after: theirs },
      { before: randomUUID() },
    ];
    for (const query of bad) {
      const res = await history(room, query);
      expect(res.status, JSON.stringify(query)).toBe(400);
      expect(res.body.code).toBe('validation_failed');
    }
  });

  it('answers 401 for a bad token and 404 for an unknown room', async () => {
    const room = await pairedRoom(api);
    const anon = await api.call('listChatMessages', { params: { roomId: room.roomId }, token: 'x' });
    expect(anon.status).toBe(401);
    const missing = await api.call('listChatMessages', {
      params: { roomId: 'AAAAAAAAAAAAAAAAAAAAAA' },
      token: 'x',
    });
    expect(missing.status).toBe(404);
  });
});
