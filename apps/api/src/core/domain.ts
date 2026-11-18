type Brand<T, B extends string> = T & { readonly __brand: B };

export type RoomId = Brand<string, 'RoomId'>;
export type ParticipantId = Brand<string, 'ParticipantId'>;
export type PhotoId = Brand<string, 'PhotoId'>;
export type MessageId = Brand<string, 'MessageId'>;
export type LocalDate = Brand<string, 'LocalDate'>;
export type LocalDateTime = Brand<string, 'LocalDateTime'>;
export type Slot = 'A' | 'B';

const ROOM_ID = /^[A-Za-z0-9_-]{22}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function asRoomId(raw: string): RoomId | null {
  return ROOM_ID.test(raw) ? (raw as RoomId) : null;
}

/** Lowercased so ids compare equal to what Postgres returns. */
export function asUuid<T extends ParticipantId | PhotoId | MessageId>(
  raw: string,
): T | null {
  const id = raw.toLowerCase();
  return UUID.test(id) ? (id as T) : null;
}

export function vacantSlot(taken: readonly { slot: Slot }[]): Slot | null {
  if (!taken.some((m) => m.slot === 'A')) return 'A';
  if (!taken.some((m) => m.slot === 'B')) return 'B';
  return null;
}
