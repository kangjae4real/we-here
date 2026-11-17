import { pairedRoom, revisionOf, uploadShots } from './fixtures.js';
import { type Api, startApi } from './harness.js';

let api: Api;
beforeAll(async () => {
  api = await startApi();
});
afterAll(() => api.close());

const snapshot = (roomId: string, token?: string) =>
  api.call('getSnapshot', { params: { roomId }, token });

const YEOUIDO = { lat: 37.5284, lng: 126.9341 };
const NEARBY = { lat: 37.5275, lng: 126.9363 };
const SEONGSU = { lat: 37.5446, lng: 127.0557 };

describe('getSnapshot', () => {
  it('returns photos and the analysis, with live place names for what is on screen', async () => {
    const room = await pairedRoom(api);
    const [aPhoto] = await uploadShots(api, room, room.a, [
      { ...YEOUIDO, at: '2022:04:09 15:12:00', thumb: true },
      { ...SEONGSU, at: '2024:03:10 18:05:00' },
    ]);
    const [bPhoto] = await uploadShots(api, room, room.b, [
      { ...NEARBY, at: '2022:04:09 15:20:00' },
      { ...SEONGSU, at: '2024:03:11 09:00:00' },
      { lat: 35.6812, lng: 139.7671, at: '2023:01:05 12:00:00', offset: '+09:00' },
    ]);
    const revision = await revisionOf(api, room);

    const res = await snapshot(room.roomId, room.b.token);
    expect(res.status).toBe(200);
    const s = res.body;
    expect(s.revision).toBe(revision);
    expect(s.photos).toHaveLength(5);
    expect(s.encounters).toHaveLength(1);
    const [e] = s.encounters;
    expect(e).toMatchObject({
      a: { participantId: room.a.id, photoId: aPhoto },
      b: { participantId: room.b.id, photoId: bPhoto },
      gapMin: 8,
      placeLabel: '가상동 37.528,126.935',
    });
    expect(s.story.act2.encounterIds).toEqual([e.id]);
    expect(s.closest).toEqual([]);
    expect(s.heatmap.top).toEqual([
      expect.objectContaining({ rank: 1, days: 2, placeLabel: '가상동 37.545,127.056' }),
    ]);
    expect(s.story.act3).toEqual({ from: '2024-03-02', placeCount: 1, dayCount: 2 });
    expect(s.stats.oldest.placeLabel).toBe('가상동 37.528,126.934');

    const byId = new Map(s.photos.map((p: any) => [p.id, p]));
    expect((byId.get(aPhoto) as any).thumbUrl).toMatch(
      new RegExp(`^/thumbs/${aPhoto}\\?exp=\\d+&sig=[0-9a-f]{64}$`),
    );
    expect((byId.get(bPhoto) as any).thumbUrl).toBeNull();
    expect(s.photos.filter((p: any) => p.placeLabel === '해외')).toHaveLength(1);
  });

  it('caches names it found without bumping the revision, so cached-only places fill in next time', async () => {
    const room = await pairedRoom(api);
    await uploadShots(api, room, room.a, [
      { lat: 37.6001, lng: 127.1001, at: '2020:03:10 18:05:00' },
      { lat: 37.6101, lng: 127.1101, at: '2020:03:12 18:05:00' },
      { lat: 37.6201, lng: 127.1201, at: '2020:03:14 18:05:00' },
    ]);
    const first = (await snapshot(room.roomId, room.a.token)).body;
    const middle = first.photos[1];
    expect(middle.placeLabel).toBeNull();

    await api.sql(
      `INSERT INTO geocode_cache (key, label) VALUES ('37.610,127.110', '중간동')`,
    );
    const second = (await snapshot(room.roomId, room.a.token)).body;
    expect(second.photos[1].placeLabel).toBe('중간동');
    expect(second.revision).toBe(first.revision);
    const keys = await api.sql(
      `SELECT key FROM geocode_cache WHERE key IN ('37.600,127.100', '37.620,127.120') ORDER BY key`,
    );
    expect(keys.map((k) => k.key)).toEqual(['37.600,127.100', '37.620,127.120']);
  });

  it('shows the closest moments when the two never crossed paths', async () => {
    const room = await pairedRoom(api);
    await uploadShots(api, room, room.a, [{ ...YEOUIDO, at: '2022:04:09 15:12:00' }]);
    await uploadShots(api, room, room.b, [{ ...SEONGSU, at: '2022:04:09 17:00:00' }]);
    const s = (await snapshot(room.roomId, room.a.token)).body;
    expect(s.encounters).toEqual([]);
    expect(s.closest).toHaveLength(1);
    expect(s.closest[0].gapMin).toBe(108);
  });

  it('never names a photo it does not list, while uploads race it', async () => {
    const room = await pairedRoom(api);
    await uploadShots(api, room, room.a, [{ ...YEOUIDO, at: '2022:04:09 15:12:00' }]);
    const uploads = Array.from({ length: 5 }, (_, i) =>
      uploadShots(api, room, room.b, [
        { ...NEARBY, at: `2022:04:09 15:1${i}:00` },
      ]),
    );
    const reads = Array.from({ length: 5 }, () => snapshot(room.roomId, room.a.token));
    const [, snapshots] = await Promise.all([Promise.all(uploads), Promise.all(reads)]);
    for (const { body } of snapshots) {
      const ids = new Set(body.photos.map((p: any) => p.id));
      for (const e of body.encounters) {
        expect(ids.has(e.a.photoId) && ids.has(e.b.photoId)).toBe(true);
      }
    }
  });

  it('answers 401 for a missing or foreign token', async () => {
    const room = await pairedRoom(api);
    const other = await pairedRoom(api);
    expect((await snapshot(room.roomId)).status).toBe(401);
    const res = await snapshot(room.roomId, other.a.token);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('invalid_token');
  });

  it('answers 404 for an unknown room', async () => {
    const res = await snapshot('AAAAAAAAAAAAAAAAAAAAAA', 'x');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('room_not_found');
  });
});
