import { randomUUID } from 'node:crypto';
import { newRoom, pairedRoom, revisionOf } from './fixtures.js';
import { type Api, startApi } from './harness.js';

const MISSING_ROOM = 'AAAAAAAAAAAAAAAAAAAAAA';

let api: Api;
beforeAll(async () => {
  api = await startApi();
});
afterAll(() => api.close());

async function addChatHistory(roomId: string, authorId: string) {
  const [msg] = await api.sql<{ id: string }>(
    `INSERT INTO chat_messages (id, room_id, role, author_id, content, status)
     VALUES (gen_random_uuid(), $1, 'user', $2, 'hi', 'complete') RETURNING id`,
    [roomId, authorId],
  );
  await api.sql('INSERT INTO chat_reservations (room_id) VALUES ($1)', [
    roomId,
  ]);
  return msg.id;
}

describe('createRoom', () => {
  it('creates the room with its creator in slot A', async () => {
    const res = await api.call('createRoom', {
      json: {
        name: '  우리 둘의 지도 ',
        nickname: '서연',
        metOn: '2024-03-02',
      },
    });
    expect(res.status).toBe(201);
    expect(res.body.revision).toBe(1);
    const days =
      (Date.parse(res.body.expiresAt) - Date.now()) / (24 * 3600 * 1000);
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);

    const room = await api.call('getRoom', {
      params: { roomId: res.body.roomId },
      token: res.body.token,
    });
    expect(room.body).toMatchObject({
      name: '우리 둘의 지도',
      meId: res.body.participantId,
      inviteSecret: res.body.inviteSecret,
      participants: [
        { slot: 'A', nickname: '서연', photoCount: 0, aiConsent: false },
      ],
      chat: { used: 0, limit: 30 },
      chatLastMessageId: null,
      photoLimit: 2000,
    });
  });

  it('rejects what the schema and the refiners rule out, naming each field', async () => {
    const tomorrow = new Date(Date.now() + 9 * 3600e3 + 24 * 3600e3)
      .toISOString()
      .slice(0, 10);
    const res = await api.call('createRoom', {
      json: { name: '   ', nickname: 'a\u0007b', metOn: tomorrow },
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('validation_failed');
    expect(res.body.errors).toEqual([
      { field: 'name', code: 'too_short' },
      { field: 'nickname', code: 'control_chars' },
      { field: 'metOn', code: 'out_of_range' },
    ]);
  });

  it('rejects unknown fields, impossible dates and malformed JSON', async () => {
    const extra = await api.call('createRoom', {
      json: { name: 'x', nickname: 'y', metOn: '2023-02-29', admin: true },
    });
    expect(extra.status).toBe(400);
    expect(extra.body.errors).toEqual(
      expect.arrayContaining([
        { field: 'admin', code: 'unknown_field' },
        { field: 'metOn', code: 'invalid_format' },
      ]),
    );
    const malformed = await api.call('createRoom', { body: '{"name":' });
    expect(malformed.status).toBe(400);
    expect(malformed.body.code).toBe('validation_failed');
  });
});

describe('rate limits', () => {
  let limited: Api;
  beforeAll(async () => {
    limited = await startApi({
      env: {
        ROOM_CREATE_LIMIT_PER_HOUR: '2',
        INVITE_PREVIEW_LIMIT_PER_HOUR: '1',
      },
    });
  });
  afterAll(() => limited.close());

  it('limits room creation per IP and says when to retry', async () => {
    await newRoom(limited);
    await newRoom(limited);
    const res = await limited.call('createRoom', {
      json: { name: 'x', nickname: 'y', metOn: '2024-03-02' },
    });
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('rate_limited');
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(3500);
  });

  it('limits joins and invite previews in their own buckets', async () => {
    const roomId = MISSING_ROOM;
    const join = () =>
      limited.call('joinRoom', {
        params: { roomId },
        json: { nickname: 'x', inviteSecret: MISSING_ROOM },
      });
    expect((await join()).status).toBe(404);
    expect((await join()).status).toBe(404);
    expect((await join()).status).toBe(429);

    const preview = () =>
      limited.call('getInvitePreview', {
        params: { roomId },
        headers: { 'X-Invite-Secret': MISSING_ROOM },
      });
    expect((await preview()).status).toBe(404);
    expect((await preview()).status).toBe(429);
  });
});

describe('getInvitePreview', () => {
  it('shows the open seat to a holder of the invite secret', async () => {
    const room = await newRoom(api);
    const res = await api.call('getInvitePreview', {
      params: { roomId: room.roomId },
      headers: { 'X-Invite-Secret': room.inviteSecret },
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      roomId: room.roomId,
      name: '우리 둘의 지도',
      inviterNickname: '서연',
      metOn: '2024-03-02',
      status: 'open',
      vacantSlot: 'B',
    });
  });

  it('says full once both seats are taken', async () => {
    const room = await pairedRoom(api);
    const res = await api.call('getInvitePreview', {
      params: { roomId: room.roomId },
      headers: { 'X-Invite-Secret': room.inviteSecret },
    });
    expect(res.body).toMatchObject({ status: 'full', vacantSlot: null });
  });

  it('refuses a wrong or missing secret with 403', async () => {
    const room = await newRoom(api);
    const wrong = await api.call('getInvitePreview', {
      params: { roomId: room.roomId },
      headers: { 'X-Invite-Secret': MISSING_ROOM },
    });
    expect(wrong.status).toBe(403);
    expect(wrong.body.code).toBe('invite_invalid');
    const missing = await api.call('getInvitePreview', {
      params: { roomId: room.roomId },
    });
    expect(missing.body.code).toBe('invite_invalid');
  });

  it('answers 404 room_not_found for an unknown or malformed room id', async () => {
    for (const roomId of [MISSING_ROOM, 'short']) {
      const res = await api.call('getInvitePreview', {
        params: { roomId },
        headers: { 'X-Invite-Secret': MISSING_ROOM },
      });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('room_not_found');
    }
  });
});

describe('joinRoom', () => {
  it('seats the guest in B and bumps the revision', async () => {
    const room = await newRoom(api);
    const res = await api.call('joinRoom', {
      params: { roomId: room.roomId },
      json: { nickname: ' 도윤 ', inviteSecret: room.inviteSecret },
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      roomId: room.roomId,
      slot: 'B',
      revision: 2,
    });
    const view = await api.call('getRoom', {
      params: { roomId: room.roomId },
      token: res.body.token,
    });
    expect(view.body.meId).toBe(res.body.participantId);
    expect(view.body.inviteSecret).toBeNull();
    expect(view.body.participants.map((p: any) => p.nickname)).toEqual([
      '서연',
      '도윤',
    ]);
  });

  it('lets exactly one of two simultaneous guests in', async () => {
    const room = await newRoom(api);
    const results = await Promise.all(
      ['x', 'y'].map((nickname) =>
        api.call('joinRoom', {
          params: { roomId: room.roomId },
          json: { nickname, inviteSecret: room.inviteSecret },
        }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409)!.body.code).toBe('room_full');
    expect(await revisionOf(api, room)).toBe(2);
  });

  it('refuses a wrong secret, a bad nickname and a missing room', async () => {
    const room = await newRoom(api);
    const wrong = await api.call('joinRoom', {
      params: { roomId: room.roomId },
      json: { nickname: 'x', inviteSecret: MISSING_ROOM },
    });
    expect(wrong.status).toBe(403);
    const bad = await api.call('joinRoom', {
      params: { roomId: room.roomId },
      json: { nickname: 'x'.repeat(21), inviteSecret: room.inviteSecret },
    });
    expect(bad.status).toBe(400);
    expect(bad.body.errors).toEqual([{ field: 'nickname', code: 'too_long' }]);
    const missing = await api.call('joinRoom', {
      params: { roomId: MISSING_ROOM },
      json: { nickname: 'x', inviteSecret: room.inviteSecret },
    });
    expect(missing.status).toBe(404);
  });
});

describe('getRoom', () => {
  it('answers 401 invalid_token for a missing or foreign token', async () => {
    const room = await newRoom(api);
    const other = await newRoom(api);
    for (const token of [undefined, other.a.token, 'garbage']) {
      const res = await api.call('getRoom', {
        params: { roomId: room.roomId },
        token,
      });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('invalid_token');
    }
  });

  it('reports the latest chat message and the hourly quota', async () => {
    const room = await pairedRoom(api);
    const id = await addChatHistory(room.roomId, room.b.id);
    const res = await api.call('getRoom', {
      params: { roomId: room.roomId },
      token: room.a.token,
    });
    expect(res.body.chatLastMessageId).toBe(id);
    expect(res.body.chat.used).toBe(1);
    const resetIn = Date.parse(res.body.chat.resetAt) - Date.now();
    expect(resetIn).toBeGreaterThan(3500e3);
    expect(resetIn).toBeLessThanOrEqual(3600e3);
  });

  it('answers 404 room_not_found for an unknown room', async () => {
    const res = await api.call('getRoom', {
      params: { roomId: MISSING_ROOM },
      token: 'x',
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('room_not_found');
  });
});

describe('expiry', () => {
  it('purges an expired room and keeps answering room_expired', async () => {
    const room = await pairedRoom(api);
    await api.sql(
      "UPDATE rooms SET expires_at = now() - interval '1 second' WHERE id = $1",
      [room.roomId],
    );
    for (let i = 0; i < 2; i++) {
      const res = await api.call('getRoom', {
        params: { roomId: room.roomId },
        token: room.a.token,
      });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('room_expired');
    }
    expect(
      await api.sql('SELECT 1 FROM participants WHERE room_id = $1', [
        room.roomId,
      ]),
    ).toEqual([]);
    const join = await api.call('joinRoom', {
      params: { roomId: room.roomId },
      json: { nickname: 'x', inviteSecret: room.inviteSecret },
    });
    expect(join.body.code).toBe('room_expired');
  });
});

describe('updateRoom', () => {
  it('bumps the revision only when metOn changes', async () => {
    const room = await pairedRoom(api);
    const change = await api.call('updateRoom', {
      params: { roomId: room.roomId },
      token: room.b.token,
      json: { metOn: '2024-03-05' },
    });
    expect(change.status).toBe(200);
    expect(change.body).toEqual({
      roomId: room.roomId,
      metOn: '2024-03-05',
      revision: 3,
    });
    const same = await api.call('updateRoom', {
      params: { roomId: room.roomId },
      token: room.a.token,
      json: { metOn: '2024-03-05' },
    });
    expect(same.body.revision).toBe(3);
  });

  it('rejects dates before 1990 and answers 401 and 404', async () => {
    const room = await newRoom(api);
    const early = await api.call('updateRoom', {
      params: { roomId: room.roomId },
      token: room.a.token,
      json: { metOn: '1989-12-31' },
    });
    expect(early.status).toBe(400);
    const edge = await api.call('updateRoom', {
      params: { roomId: room.roomId },
      token: room.a.token,
      json: { metOn: '1990-01-01' },
    });
    expect(edge.status).toBe(200);
    const anon = await api.call('updateRoom', {
      params: { roomId: room.roomId },
      json: { metOn: '2024-01-01' },
    });
    expect(anon.status).toBe(401);
    const missing = await api.call('updateRoom', {
      params: { roomId: MISSING_ROOM },
      token: room.a.token,
      json: { metOn: '2024-01-01' },
    });
    expect(missing.status).toBe(404);
  });
});

describe('updateMe', () => {
  it('records AI consent and bumps only on change', async () => {
    const room = await newRoom(api);
    const on = await api.call('updateMe', {
      params: { roomId: room.roomId },
      token: room.a.token,
      json: { aiConsent: true },
    });
    expect(on.status).toBe(200);
    expect(on.body).toEqual({
      participantId: room.a.id,
      aiConsent: true,
      revision: 2,
    });
    const again = await api.call('updateMe', {
      params: { roomId: room.roomId },
      token: room.a.token,
      json: { aiConsent: true },
    });
    expect(again.body.revision).toBe(2);
  });

  it('answers 400, 401 and 404', async () => {
    const room = await newRoom(api);
    const bad = await api.call('updateMe', {
      params: { roomId: room.roomId },
      token: room.a.token,
      json: { aiConsent: 'yes' },
    });
    expect(bad.status).toBe(400);
    expect(bad.body.errors).toEqual([
      { field: 'aiConsent', code: 'invalid_type' },
    ]);
    const anon = await api.call('updateMe', {
      params: { roomId: room.roomId },
      json: { aiConsent: true },
    });
    expect(anon.status).toBe(401);
    const missing = await api.call('updateMe', {
      params: { roomId: MISSING_ROOM },
      json: { aiConsent: true },
    });
    expect(missing.status).toBe(404);
  });
});

describe('leaveRoom', () => {
  it('frees my seat, wipes chat history, keeps the quota and rotates the invite', async () => {
    const room = await pairedRoom(api);
    await addChatHistory(room.roomId, room.a.id);
    const res = await api.call('leaveRoom', {
      params: { roomId: room.roomId },
      token: room.b.token,
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deletedPhotoCount: 0, roomDeleted: false });

    const view = await api.call('getRoom', {
      params: { roomId: room.roomId },
      token: room.a.token,
    });
    expect(view.body.revision).toBe(3);
    expect(view.body.participants).toHaveLength(1);
    expect(view.body.chatLastMessageId).toBeNull();
    expect(view.body.chat.used).toBe(1);
    expect(view.body.inviteSecret).not.toBe(room.inviteSecret);

    const gone = await api.call('getRoom', {
      params: { roomId: room.roomId },
      token: room.b.token,
    });
    expect(gone.status).toBe(401);
    const oldLink = await api.call('joinRoom', {
      params: { roomId: room.roomId },
      json: { nickname: 'x', inviteSecret: room.inviteSecret },
    });
    expect(oldLink.status).toBe(403);
  });

  it('hands slot A to the next guest after the creator leaves', async () => {
    const room = await pairedRoom(api);
    await api.call('leaveRoom', {
      params: { roomId: room.roomId },
      token: room.a.token,
    });
    const view = await api.call('getRoom', {
      params: { roomId: room.roomId },
      token: room.b.token,
    });
    const preview = await api.call('getInvitePreview', {
      params: { roomId: room.roomId },
      headers: { 'X-Invite-Secret': view.body.inviteSecret },
    });
    expect(preview.body).toMatchObject({
      inviterNickname: '도윤',
      vacantSlot: 'A',
    });
  });

  it('deletes the room when the last person leaves', async () => {
    const room = await newRoom(api);
    const res = await api.call('leaveRoom', {
      params: { roomId: room.roomId },
      token: room.a.token,
    });
    expect(res.body).toEqual({ deletedPhotoCount: 0, roomDeleted: true });
    const after = await api.call('getRoom', {
      params: { roomId: room.roomId },
      token: room.a.token,
    });
    expect(after.body.code).toBe('room_not_found');
  });

  it('answers 401 and 404', async () => {
    const room = await newRoom(api);
    expect(
      (await api.call('leaveRoom', { params: { roomId: room.roomId } })).status,
    ).toBe(401);
    expect(
      (await api.call('leaveRoom', { params: { roomId: MISSING_ROOM } }))
        .status,
    ).toBe(404);
  });
});

describe('removePartner', () => {
  it('frees the partner seat with a fresh invite and wipes chat history', async () => {
    const room = await pairedRoom(api);
    await addChatHistory(room.roomId, room.b.id);
    const res = await api.call('removePartner', {
      params: { roomId: room.roomId, participantId: room.b.id.toUpperCase() },
      token: room.a.token,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ deletedPhotoCount: 0, revision: 3 });
    expect(res.body.inviteSecret).not.toBe(room.inviteSecret);

    const kicked = await api.call('getRoom', {
      params: { roomId: room.roomId },
      token: room.b.token,
    });
    expect(kicked.status).toBe(401);
    expect(
      await api.sql('SELECT 1 FROM chat_messages WHERE room_id = $1', [
        room.roomId,
      ]),
    ).toEqual([]);
    expect(
      await api.sql('SELECT 1 FROM chat_reservations WHERE room_id = $1', [
        room.roomId,
      ]),
    ).toHaveLength(1);

    const oldLink = await api.call('joinRoom', {
      params: { roomId: room.roomId },
      json: { nickname: 'x', inviteSecret: room.inviteSecret },
    });
    expect(oldLink.status).toBe(403);
    const newLink = await api.call('joinRoom', {
      params: { roomId: room.roomId },
      json: { nickname: 'x', inviteSecret: res.body.inviteSecret },
    });
    expect(newLink.status).toBe(201);
    expect(newLink.body.slot).toBe('B');
  });

  it('refuses to remove yourself', async () => {
    const room = await pairedRoom(api);
    const res = await api.call('removePartner', {
      params: { roomId: room.roomId, participantId: room.a.id },
      token: room.a.token,
    });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([{ field: 'participantId', code: 'self' }]);
  });

  it('answers 404 participant_not_found for someone not in the room', async () => {
    const room = await pairedRoom(api);
    for (const participantId of [randomUUID(), 'not-a-uuid']) {
      const res = await api.call('removePartner', {
        params: { roomId: room.roomId, participantId },
        token: room.a.token,
      });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('participant_not_found');
    }
  });

  it('checks the token before the participant', async () => {
    const room = await pairedRoom(api);
    const res = await api.call('removePartner', {
      params: { roomId: room.roomId, participantId: randomUUID() },
    });
    expect(res.status).toBe(401);
  });
});
