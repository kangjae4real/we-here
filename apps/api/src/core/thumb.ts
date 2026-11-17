import { createHmac, timingSafeEqual } from 'node:crypto';

const HOUR_S = 3600;
const MAX_TTL_S = 24 * HOUR_S;

/**
 * The expiry to sign: rounded up to the hour so the URL, and the browser's
 * cached image, stay the same for an hour. At most 24 h away and never past
 * the room's own expiry.
 */
export function thumbExp(nowMs: number, roomExpiresAtMs: number): number {
  const hourly =
    Math.ceil((nowMs / 1000 + MAX_TTL_S - HOUR_S) / HOUR_S) * HOUR_S;
  return Math.min(hourly, Math.floor(roomExpiresAtMs / 1000));
}

export function signThumb(
  secret: string,
  photoId: string,
  exp: number,
): string {
  return createHmac('sha256', secret).update(`${photoId}.${exp}`).digest('hex');
}

/** Relative path the snapshot hands out; the web app prefixes /api/v1. */
export function thumbPath(
  secret: string,
  photoId: string,
  exp: number,
): string {
  return `/thumbs/${photoId}?exp=${exp}&sig=${signThumb(secret, photoId, exp)}`;
}

export type ThumbCheck =
  'ok' | 'thumb_signature_invalid' | 'thumb_signature_expired';

/** Signature first, then expiry. An exp further out than we ever sign is invalid, not merely unexpired. */
export function verifyThumb(
  secret: string,
  photoId: string,
  exp: string | undefined,
  sig: string | undefined,
  nowMs: number,
): ThumbCheck {
  if (!exp || !/^\d{1,12}$/.test(exp) || !sig || !/^[0-9a-f]{64}$/.test(sig)) {
    return 'thumb_signature_invalid';
  }
  const expected = Buffer.from(signThumb(secret, photoId, Number(exp)), 'hex');
  if (!timingSafeEqual(expected, Buffer.from(sig, 'hex'))) {
    return 'thumb_signature_invalid';
  }
  const expS = Number(exp);
  const nowS = nowMs / 1000;
  if (expS > nowS + MAX_TTL_S) return 'thumb_signature_invalid';
  if (expS <= nowS) return 'thumb_signature_expired';
  return 'ok';
}
