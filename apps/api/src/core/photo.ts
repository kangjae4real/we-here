import type { W } from '../contract/index.js';
import type { PhotoId } from './domain.js';
import { type CorrectedTime, correctTime } from './time.js';

export type PhotoMeta = W<'PhotoMeta'>;
export type PhotoErrorCode = W<'PhotoErrorCode'>;
export type UploadResult = W<'UploadResult'>;

export const THUMB_MAX_BYTES = 40_960;

export interface PhotoFact extends CorrectedTime {
  dedupeKey: string;
  lat: number;
  lng: number;
}

export type ItemVerdict =
  | {
      clientIndex: number;
      dedupeKey: string;
      ok: true;
      fact: PhotoFact;
      thumb: Uint8Array | null;
    }
  | {
      clientIndex: number;
      dedupeKey: string;
      ok: false;
      error: { code: PhotoErrorCode; field?: string };
    };

export interface StoredPhoto {
  id: PhotoId;
  thumbBytes: number | null;
}

export interface NewPhoto extends PhotoFact {
  id: PhotoId;
  thumb: Uint8Array | null;
}

export interface UploadPlan {
  results: UploadResult[];
  inserts: NewPhoto[];
  thumbFills: { id: PhotoId; thumb: Uint8Array }[];
}

export function judgeItem(
  meta: PhotoMeta,
  thumb: Uint8Array | undefined,
  nowMs: number,
): ItemVerdict {
  const { clientIndex, dedupeKey } = meta;
  const fail = (code: PhotoErrorCode, field: string): ItemVerdict => ({
    clientIndex,
    dedupeKey,
    ok: false,
    error: { code, field },
  });
  if (meta.lat === 0 && meta.lng === 0) return fail('invalid_lat', 'lat');
  const time = correctTime(meta, nowMs);
  if (!time.ok) return fail('invalid_datetime', time.field);
  if (thumb) {
    const field = `thumb_${clientIndex}`;
    if (thumb.length > THUMB_MAX_BYTES) return fail('thumb_too_large', field);
    if (!isJpeg(thumb)) return fail('thumb_not_jpeg', field);
  }
  return {
    clientIndex,
    dedupeKey,
    ok: true,
    fact: { dedupeKey, lat: meta.lat, lng: meta.lng, ...time.time },
    thumb: thumb ?? null,
  };
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export function planUpload(i: {
  verdicts: readonly ItemVerdict[];
  stored: ReadonlyMap<string, StoredPhoto>;
  storedCount: number;
  limit: number;
  newId: () => PhotoId;
}): UploadPlan {
  const results: UploadResult[] = [];
  const inserts = new Map<string, NewPhoto>();
  const fills = new Map<string, { id: PhotoId; thumb: Uint8Array }>();
  let room = i.limit - i.storedCount;

  for (const v of i.verdicts) {
    const base = { clientIndex: v.clientIndex, dedupeKey: v.dedupeKey };
    if (!v.ok) {
      results.push({ ...base, status: 'error', error: v.error });
      continue;
    }
    const stored = i.stored.get(v.dedupeKey);
    if (stored) {
      results.push({ ...base, status: 'duplicate', photoId: stored.id });
      const best =
        fills.get(v.dedupeKey)?.thumb.length ?? stored.thumbBytes ?? 0;
      if (v.thumb && v.thumb.length > best) {
        fills.set(v.dedupeKey, { id: stored.id, thumb: v.thumb });
      }
      continue;
    }
    const planned = inserts.get(v.dedupeKey);
    if (planned) {
      results.push({ ...base, status: 'duplicate', photoId: planned.id });
      if (v.thumb && v.thumb.length > (planned.thumb?.length ?? 0)) {
        planned.thumb = v.thumb;
      }
      continue;
    }
    if (room <= 0) {
      results.push({
        ...base,
        status: 'error',
        error: { code: 'photo_limit_reached' },
      });
      continue;
    }
    const id = i.newId();
    inserts.set(v.dedupeKey, { ...v.fact, id, thumb: v.thumb });
    room--;
    results.push({ ...base, status: 'saved', photoId: id });
  }

  return {
    results,
    inserts: [...inserts.values()],
    thumbFills: [...fills.values()],
  };
}
