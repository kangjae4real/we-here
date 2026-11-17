import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { RoomId } from '../core/domain.js';

/** 128-bit base64url, 22 chars: room ids and invite secrets. */
export const newRoomId = () => randomBytes(16).toString('base64url') as RoomId;
export const newInviteSecret = () => randomBytes(16).toString('base64url');
/** 256-bit base64url. Only its SHA-256 is stored. */
export const newToken = () => randomBytes(32).toString('base64url');

export function hashToken(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}

export function sameSecret(given: string | undefined, stored: string): boolean {
  if (given === undefined) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
}
