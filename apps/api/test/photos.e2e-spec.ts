import { randomUUID } from 'node:crypto';
import { signThumb, thumbExp } from '../src/core/thumb.js';
import { THUMB_SECRET } from './env.js';
import {
  form,
  jpeg,
  key,
  newRoom,
  type PairedRoom,
  pairedRoom,
  revisionOf,
} from './fixtures.js';
import { type Api, type CallResult, startApi } from './harness.js';

const meta = (clientIndex: number, over: Record<string, unknown> = {}) => ({
  clientIndex,
  dedupeKey: key(clientIndex),
  lat: 37.52845,
  lng: 126.93412,
  dateTimeOriginal: '2022:04:09 15:12:03',
  ...over,
});

let api: Api;
beforeAll(async () => {
  api = await startApi();
});
afterAll(() => api.close());

const upload = (
  room: { roomId: string },
  token: string | undefined,
  body: FormData,
  on = api,
) => on.call('uploadPhotos', { params: { roomId: room.roomId }, token, body });

function signedThumb(
  photoId: string,
  exp = thumbExp(Date.now(), Date.now() + 864e5),
) {
  return {
    params: { photoId },
    query: { exp, sig: signThumb(THUMB_SECRET, photoId, exp) },
  };
}

const statuses = (res: CallResult) =>
  res.body.results.map((r: any) => r.error?.code ?? r.status);

describe('uploadPhotos', () => {
  it('saves each photo, rounds coordinates to 4 decimals and bumps the revision once', async () => {
    const room = await newRoom(api);
    const res = await upload(
      room,
      room.a.token,
      form([meta(0), meta(1)], { 1: jpeg(500) }),
    );
    expect(res.status).toBe(200);
    expect(res.body.revision).toBe(2);
    expect(statuses(res)).toEqual(['saved', 'saved']);
    const [row] = await api.sql(
      `SELECT lat, lng, taken_local::text AS t, time_source FROM photos WHERE id = $1`,
      [res.body.results[0].photoId],
    );
    expect(row).toEqual({
      lat: '37.5285',
      lng: '126.9341',
      t: '2022-04-09 15:12:03',
      time_source: 'kr_bounds',
    });
  });

  it('accepts meta sent as a JSON file part', async () => {
    const room = await newRoom(api);
    const res = await upload(room, room.a.token, form([meta(0)], {}, true));
    expect(statuses(res)).toEqual(['saved']);
  });

  it('answers duplicates without a bump, but fills a missing or smaller thumbnail with one', async () => {
    const room = await newRoom(api);
    const first = await upload(room, room.a.token, form([meta(0)]));
    const id = first.body.results[0].photoId;

    const same = await upload(room, room.a.token, form([meta(0)]));
    expect(same.body.results).toEqual([
      { clientIndex: 0, dedupeKey: key(0), status: 'duplicate', photoId: id },
    ]);
    expect(same.body.revision).toBe(2);

    const filled = await upload(
      room,
      room.a.token,
      form([meta(0)], { 0: jpeg(300) }),
    );
    expect(filled.body.revision).toBe(3);
    const smaller = await upload(
      room,
      room.a.token,
      form([meta(0)], { 0: jpeg(200) }),
    );
    expect(smaller.body.revision).toBe(3);

    const thumb = await api.call('getThumbnail', signedThumb(id));
    expect(thumb.body).toHaveLength(300);
  });

  it('stores a key once when two overlapping batches race', async () => {
    const room = await newRoom(api);
    const batch = () =>
      upload(room, room.a.token, form([meta(0), meta(1), meta(2)]));
    const [x, y] = await Promise.all([batch(), batch()]);
    expect([...statuses(x), ...statuses(y)].sort()).toEqual([
      'duplicate',
      'duplicate',
      'duplicate',
      'saved',
      'saved',
      'saved',
    ]);
    expect(
      await api.sql('SELECT 1 FROM photos WHERE room_id = $1', [room.roomId]),
    ).toHaveLength(3);
  });

  it('fails only the bad photos and names their EXIF field', async () => {
    const room = await newRoom(api);
    const res = await upload(
      room,
      room.a.token,
      form(
        [
          meta(0),
          meta(1, { dedupeKey: 'XYZ' }),
          meta(2, { lat: 91 }),
          meta(3, { dateTimeOriginal: '2023:02:29 10:00:00' }),
          meta(4, { offsetTimeOriginal: '+15:00' }),
          meta(5),
          meta(6),
          meta(7, { lat: 0, lng: 0 }),
        ],
        { 5: new Uint8Array([1, 2, 3]), 6: jpeg(40_961) },
      ),
    );
    expect(res.status).toBe(200);
    expect(res.body.results.map((r: any) => [r.status, r.error])).toEqual([
      ['saved', undefined],
      ['error', { code: 'invalid_dedupe_key', field: 'dedupeKey' }],
      ['error', { code: 'invalid_lat', field: 'lat' }],
      ['error', { code: 'invalid_datetime', field: 'dateTimeOriginal' }],
      ['error', { code: 'invalid_datetime', field: 'offsetTimeOriginal' }],
      ['error', { code: 'thumb_not_jpeg', field: 'thumb_5' }],
      ['error', { code: 'thumb_too_large', field: 'thumb_6' }],
      ['error', { code: 'invalid_lat', field: 'lat' }],
    ]);
    expect(res.body.results[1].dedupeKey).toBe('XYZ');
  });

  it('stops at the per-participant limit in request order', async () => {
    const capped = await startApi({
      env: { PHOTO_LIMIT_PER_PARTICIPANT: '3' },
    });
    try {
      const room = await newRoom(capped);
      const res = await upload(
        room,
        room.a.token,
        form([meta(0), meta(1), meta(2), meta(3)]),
        capped,
      );
      expect(statuses(res)).toEqual([
        'saved',
        'saved',
        'saved',
        'photo_limit_reached',
      ]);
      const again = await upload(
        room,
        room.a.token,
        form([meta(4), meta(0)]),
        capped,
      );
      expect(statuses(again)).toEqual(['photo_limit_reached', 'duplicate']);
      const view = await capped.call('getRoom', {
        params: { roomId: room.roomId },
        token: room.a.token,
      });
      expect(view.body.photoLimit).toBe(3);
      expect(view.body.participants[0].photoCount).toBe(3);
    } finally {
      await capped.close();
    }
  });

  it('rejects malformed batches with 400', async () => {
    const room = await newRoom(api);
    const cases: [FormData, { field: string; code: string }][] = [
      [form('not json'), { field: 'meta', code: 'invalid_format' }],
      [form({ a: 1 }), { field: 'meta', code: 'invalid_type' }],
      [form([]), { field: 'meta', code: 'too_short' }],
      [
        form([meta(0), meta(0, { dedupeKey: key(9) })]),
        { field: 'meta.1.clientIndex', code: 'conflict' },
      ],
      [
        form([meta(0, { gps: true })]),
        { field: 'meta.0.gps', code: 'unknown_field' },
      ],
      [
        form([meta(0)], { 4: jpeg(10) }),
        { field: 'thumb_4', code: 'unknown_field' },
      ],
    ];
    for (const [body, issue] of cases) {
      const res = await upload(room, room.a.token, body);
      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual([issue]);
    }
    const extra = form([meta(0)]);
    extra.set('note', 'hi');
    expect((await upload(room, room.a.token, extra)).status).toBe(400);
  });

  it('rejects more than 50 photos or more than 2 MB with 413', async () => {
    const room = await newRoom(api);
    const many = Array.from({ length: 51 }, (_, i) => meta(i));
    const tooMany = await upload(room, room.a.token, form(many));
    expect(tooMany.status).toBe(413);
    expect(tooMany.body.code).toBe('batch_too_large');

    const thumbs = Object.fromEntries(
      Array.from({ length: 50 }, (_, i) => [i, jpeg(40_960)]),
    );
    const fifty = Array.from({ length: 50 }, (_, i) => meta(i));
    const heavy = await upload(room, room.a.token, form(fifty, thumbs));
    expect(heavy.status).toBe(200);
    const huge = await upload(
      room,
      room.a.token,
      form([meta(0)], { 0: jpeg(2_200_000) }),
    );
    expect(huge.status).toBe(413);
  });

  it('answers 401 without a token and 404 for an unknown room', async () => {
    const room = await newRoom(api);
    expect((await upload(room, undefined, form([meta(0)]))).status).toBe(401);
    const missing = await upload(
      { roomId: 'AAAAAAAAAAAAAAAAAAAAAA' },
      'x',
      form([meta(0)]),
    );
    expect(missing.status).toBe(404);
  });
});

describe('deleting photos', () => {
  let room: PairedRoom;
  let mine: string;
  let theirs: string;
  beforeEach(async () => {
    room = await pairedRoom(api);
    const a = await upload(room, room.a.token, form([meta(0), meta(1)]));
    const b = await upload(room, room.b.token, form([meta(0)]));
    mine = a.body.results[0].photoId;
    theirs = b.body.results[0].photoId;
  });

  it('deletes one of my photos', async () => {
    const before = await revisionOf(api, room);
    const res = await api.call('deletePhoto', {
      params: { roomId: room.roomId, photoId: mine },
      token: room.a.token,
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deletedCount: 1, revision: before + 1 });
    const again = await api.call('deletePhoto', {
      params: { roomId: room.roomId, photoId: mine },
      token: room.a.token,
    });
    expect(again.status).toBe(404);
    expect(again.body.code).toBe('photo_not_found');
  });

  it("refuses the partner's photo and photos outside this room", async () => {
    const res = await api.call('deletePhoto', {
      params: { roomId: room.roomId, photoId: theirs },
      token: room.a.token,
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('not_owner');

    const other = await newRoom(api);
    const elsewhere = await upload(other, other.a.token, form([meta(0)]));
    for (const photoId of [
      elsewhere.body.results[0].photoId,
      randomUUID(),
      'nope',
    ]) {
      const r = await api.call('deletePhoto', {
        params: { roomId: room.roomId, photoId },
        token: room.a.token,
      });
      expect(r.status).toBe(404);
      expect(r.body.code).toBe('photo_not_found');
    }
    const anon = await api.call('deletePhoto', {
      params: { roomId: room.roomId, photoId: mine },
    });
    expect(anon.status).toBe(401);
  });

  it('deletes all of my photos and leaves the partner alone', async () => {
    const before = await revisionOf(api, room);
    const res = await api.call('deleteMyPhotos', {
      params: { roomId: room.roomId },
      token: room.a.token,
    });
    expect(res.body).toEqual({ deletedCount: 2, revision: before + 1 });
    const none = await api.call('deleteMyPhotos', {
      params: { roomId: room.roomId },
      token: room.a.token,
    });
    expect(none.body).toEqual({ deletedCount: 0, revision: before + 1 });
    expect(
      await api.sql('SELECT 1 FROM photos WHERE id = $1', [theirs]),
    ).toHaveLength(1);

    expect(
      (await api.call('deleteMyPhotos', { params: { roomId: room.roomId } }))
        .status,
    ).toBe(401);
    expect(
      (
        await api.call('deleteMyPhotos', {
          params: { roomId: 'AAAAAAAAAAAAAAAAAAAAAA' },
        })
      ).status,
    ).toBe(404);
  });

  it('counts my photos when I leave', async () => {
    const res = await api.call('leaveRoom', {
      params: { roomId: room.roomId },
      token: room.a.token,
    });
    expect(res.body).toEqual({ deletedPhotoCount: 2, roomDeleted: false });
  });

  it('leaves no photos behind when a kick races an upload', async () => {
    const [up, kick] = await Promise.all([
      upload(room, room.b.token, form([meta(5), meta(6)])),
      api.call('removePartner', {
        params: { roomId: room.roomId, participantId: room.b.id },
        token: room.a.token,
      }),
    ]);
    expect(kick.status).toBe(200);
    expect([200, 401]).toContain(up.status);
    expect(
      await api.sql('SELECT 1 FROM photos WHERE participant_id = $1', [
        room.b.id,
      ]),
    ).toEqual([]);
  });
});

describe('getThumbnail', () => {
  let room: PairedRoom;
  let withThumb: string;
  let without: string;
  beforeAll(async () => {
    room = await pairedRoom(api);
    const res = await upload(
      room,
      room.a.token,
      form([meta(0), meta(1)], { 0: jpeg(777, 7) }),
    );
    [withThumb, without] = res.body.results.map((r: any) => r.photoId);
  });

  it('serves the JPEG for a valid signature with a private one-day cache', async () => {
    const res = await api.call('getThumbnail', signedThumb(withThumb));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(res.headers.get('cache-control')).toBe('private, max-age=86400');
    expect(Buffer.from(res.body)).toEqual(Buffer.from(jpeg(777, 7)));
  });

  it('refuses a tampered or missing signature with 403 thumb_signature_invalid', async () => {
    const good = signedThumb(withThumb);
    const variants = [
      { ...good, query: { ...good.query, exp: good.query.exp + 3600 } },
      { ...good, params: { photoId: without } },
      { params: { photoId: withThumb }, query: {} },
    ];
    for (const req of variants) {
      const res = await api.call('getThumbnail', req);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('thumb_signature_invalid');
    }
  });

  it('refuses an expired signature with 403 thumb_signature_expired', async () => {
    const exp = Math.floor(Date.now() / 1000) - 1;
    const res = await api.call('getThumbnail', signedThumb(withThumb, exp));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('thumb_signature_expired');
  });

  it('answers 404 photo_not_found for a photo without a thumbnail or one deleted', async () => {
    const res = await api.call('getThumbnail', signedThumb(without));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('photo_not_found');
    const ghost = await api.call('getThumbnail', signedThumb(randomUUID()));
    expect(ghost.body.code).toBe('photo_not_found');
  });

  it('answers 404 room_expired once the room has expired', async () => {
    const other = await newRoom(api);
    const up = await upload(
      other,
      other.a.token,
      form([meta(0)], { 0: jpeg(100) }),
    );
    await api.sql(
      "UPDATE rooms SET expires_at = now() - interval '1 second' WHERE id = $1",
      [other.roomId],
    );
    const res = await api.call(
      'getThumbnail',
      signedThumb(up.body.results[0].photoId),
    );
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('room_expired');
  });
});
