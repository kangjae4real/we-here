import type { PhotoId } from './domain.js';
import {
  type ItemVerdict,
  judgeItem,
  type PhotoMeta,
  planUpload,
  type StoredPhoto,
  THUMB_MAX_BYTES,
} from './photo.js';

const NOW = Date.parse('2026-11-17T00:00:00Z');
const key = (n: number) => n.toString(16).padStart(64, '0');
const jpeg = (size: number) => {
  const bytes = new Uint8Array(size);
  bytes.set([0xff, 0xd8, 0xff]);
  return bytes;
};
const meta = (
  clientIndex: number,
  over: Partial<PhotoMeta> = {},
): PhotoMeta => ({
  clientIndex,
  dedupeKey: key(clientIndex),
  lat: 37.52845,
  lng: 126.93412,
  dateTimeOriginal: '2022:04:09 15:12:03',
  ...over,
});

describe('judgeItem', () => {
  it('turns a valid item into a fact with its corrected time', () => {
    const v = judgeItem(meta(0), jpeg(100), NOW);
    expect(v).toMatchObject({
      ok: true,
      fact: {
        dedupeKey: key(0),
        lat: 37.52845,
        takenLocal: '2022-04-09T15:12:03',
        timeSource: 'kr_bounds',
      },
    });
  });

  it('rejects (0, 0) as having no location', () => {
    expect(
      judgeItem(meta(0, { lat: 0, lng: 0 }), undefined, NOW),
    ).toMatchObject({
      ok: false,
      error: { code: 'invalid_lat', field: 'lat' },
    });
  });

  it('reports a bad time against the EXIF field', () => {
    const v = judgeItem(
      meta(0, { dateTimeOriginal: '2023:02:29 00:00:00' }),
      undefined,
      NOW,
    );
    expect(v).toMatchObject({
      ok: false,
      error: { code: 'invalid_datetime', field: 'dateTimeOriginal' },
    });
  });

  it('accepts a 40960-byte JPEG thumbnail and refuses one byte more', () => {
    expect(judgeItem(meta(3), jpeg(THUMB_MAX_BYTES), NOW).ok).toBe(true);
    expect(judgeItem(meta(3), jpeg(THUMB_MAX_BYTES + 1), NOW)).toMatchObject({
      error: { code: 'thumb_too_large', field: 'thumb_3' },
    });
  });

  it('refuses a thumbnail that is not a JPEG', () => {
    expect(
      judgeItem(meta(1), new Uint8Array([0x89, 0x50, 0x4e]), NOW),
    ).toMatchObject({
      error: { code: 'thumb_not_jpeg', field: 'thumb_1' },
    });
  });
});

describe('planUpload', () => {
  const ok = (
    i: number,
    dedupe = i,
    thumb: Uint8Array | null = null,
  ): ItemVerdict => {
    const v = judgeItem(
      meta(i, { dedupeKey: key(dedupe) }),
      thumb ?? undefined,
      NOW,
    );
    if (!v.ok) throw new Error('fixture must be valid');
    return v;
  };
  const ids = () => {
    let n = 0;
    return () =>
      `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` as PhotoId;
  };
  const plan = (
    verdicts: ItemVerdict[],
    o: {
      stored?: [number, StoredPhoto][];
      storedCount?: number;
      limit?: number;
    } = {},
  ) =>
    planUpload({
      verdicts,
      stored: new Map((o.stored ?? []).map(([k, s]) => [key(k), s])),
      storedCount: o.storedCount ?? 0,
      limit: o.limit ?? 2000,
      newId: ids(),
    });
  const STORED_ID = 'aaaaaaaa-0000-4000-8000-000000000000' as PhotoId;

  it('saves new keys and keeps request order in the results', () => {
    const p = plan([ok(0), ok(1)]);
    expect(p.results.map((r) => [r.clientIndex, r.status])).toEqual([
      [0, 'saved'],
      [1, 'saved'],
    ]);
    expect(p.inserts).toHaveLength(2);
  });

  it('collapses a key repeated in the batch into one insert with the largest thumbnail', () => {
    const p = plan([ok(0, 7, jpeg(10)), ok(1, 7, jpeg(30)), ok(2, 7)]);
    expect(p.results.map((r) => r.status)).toEqual([
      'saved',
      'duplicate',
      'duplicate',
    ]);
    expect(new Set(p.results.map((r) => r.photoId)).size).toBe(1);
    expect(p.inserts).toHaveLength(1);
    expect(p.inserts[0].thumb).toHaveLength(30);
  });

  it('marks stored keys duplicate and fills a missing or smaller thumbnail only', () => {
    const missing = plan([ok(0, 5, jpeg(10))], {
      stored: [[5, { id: STORED_ID, thumbBytes: null }]],
    });
    expect(missing.results[0]).toMatchObject({
      status: 'duplicate',
      photoId: STORED_ID,
    });
    expect(missing.inserts).toEqual([]);
    expect(missing.thumbFills).toEqual([{ id: STORED_ID, thumb: jpeg(10) }]);

    const smaller = plan(
      [ok(0, 5, jpeg(10)), ok(1, 5, jpeg(40)), ok(2, 5, jpeg(20))],
      {
        stored: [[5, { id: STORED_ID, thumbBytes: 20 }]],
      },
    );
    expect(smaller.thumbFills.map((f) => f.thumb.length)).toEqual([40]);

    const larger = plan([ok(0, 5, jpeg(10))], {
      stored: [[5, { id: STORED_ID, thumbBytes: 10 }]],
    });
    expect(larger.thumbFills).toEqual([]);
  });

  it('fills the limit exactly in request order, then refuses', () => {
    const p = plan([ok(0), ok(1), ok(2), ok(3, 1)], {
      storedCount: 3,
      limit: 5,
    });
    expect(p.results.map((r) => r.status)).toEqual([
      'saved',
      'saved',
      'error',
      'duplicate',
    ]);
    expect(p.results[2].error).toEqual({ code: 'photo_limit_reached' });
    expect(p.inserts).toHaveLength(2);
  });

  it('refuses a repeat of a key that already hit the limit', () => {
    const p = plan([ok(0), ok(1, 0)], { storedCount: 5, limit: 5 });
    expect(p.results.map((r) => r.error?.code)).toEqual([
      'photo_limit_reached',
      'photo_limit_reached',
    ]);
  });

  it('passes item errors through without spending the limit', () => {
    const bad = judgeItem(meta(0, { lat: 0, lng: 0 }), undefined, NOW);
    const p = plan([bad, ok(1)], { limit: 1 });
    expect(p.results.map((r) => r.status)).toEqual(['error', 'saved']);
  });
});
