import { Injectable } from '@nestjs/common';
import type { ErrorCode } from '../contract/index.js';
import {
  asRoomId,
  type LocalDate,
  type ParticipantId,
  type RoomId,
  type Slot,
} from '../core/domain.js';
import { Db, type Isolation, type Sql } from '../db/db.js';
import { ApiError } from '../http/problem.js';
import { hashToken } from './secrets.js';

export interface RoomRow {
  id: RoomId;
  name: string;
  metOn: LocalDate;
  inviteSecret: string;
  revision: number;
  expiresAt: Date;
}

export interface Member {
  id: ParticipantId;
  slot: Slot;
  nickname: string;
  aiConsent: boolean;
}

export interface GuestScope {
  q: Sql;
  room: RoomRow;
  members: Member[];
}

export interface MemberScope extends GuestScope {
  me: Member;
}

export type Outcome<T> =
  | { kind: 'unchanged'; value: T }
  | { kind: 'bump'; build: (revision: number) => T }
  | { kind: 'deleteRoom'; value: T };

export const unchanged = <T>(value: T): Outcome<T> => ({
  kind: 'unchanged',
  value,
});
export const bump = <T>(build: (revision: number) => T): Outcome<T> => ({
  kind: 'bump',
  build,
});
export const deleteRoom = <T>(value: T): Outcome<T> => ({
  kind: 'deleteRoom',
  value,
});

const GUEST = Symbol('guest');
type Credential = string | undefined | typeof GUEST;

type Opened<T> = { ok: true; value: T } | { ok: false; code: ErrorCode };

@Injectable()
export class RoomAccess {
  constructor(private readonly db: Db) {}

  read<T>(
    roomId: string,
    token: string | undefined,
    fn: (r: MemberScope) => Promise<T>,
  ): Promise<T> {
    return this.open('repeatable read', roomId, token, (r) =>
      fn(r as MemberScope),
    );
  }

  readAsGuest<T>(roomId: string, fn: (r: GuestScope) => Promise<T>) {
    return this.open('repeatable read', roomId, GUEST, fn);
  }

  async write<T>(
    roomId: string,
    token: string | undefined,
    fn: (w: MemberScope) => Promise<Outcome<T>>,
  ): Promise<T> {
    return this.open('read committed', roomId, token, async (w) =>
      apply(w, await fn(w as MemberScope)),
    );
  }

  writeAsGuest<T>(
    roomId: string,
    fn: (w: GuestScope) => Promise<Outcome<T>>,
  ): Promise<T> {
    return this.open('read committed', roomId, GUEST, async (w) =>
      apply(w, await fn(w)),
    );
  }

  private async open<T>(
    isolation: Isolation,
    rawRoomId: string,
    credential: Credential,
    fn: (scope: GuestScope | MemberScope) => Promise<T>,
  ): Promise<T> {
    const roomId = asRoomId(rawRoomId);
    if (!roomId) throw new ApiError('room_not_found');
    const locking = isolation === 'read committed';

    const opened = await this.db.tx(
      isolation,
      async (q): Promise<Opened<T>> => {
        const room = await q.one<RoomRow & { expired: boolean }>(
          `SELECT id, name, met_on AS "metOn", invite_secret AS "inviteSecret",
                revision, expires_at AS "expiresAt", expires_at <= now() AS expired
           FROM rooms WHERE id = $1 ${locking ? 'FOR UPDATE' : ''}`,
          [roomId],
        );
        if (!room) {
          const tomb = await q.one(
            'SELECT 1 FROM room_tombstones WHERE room_id = $1',
            [roomId],
          );
          return { ok: false, code: tomb ? 'room_expired' : 'room_not_found' };
        }
        if (room.expired) {
          if (locking) await purgeExpired(q, roomId);
          return { ok: false, code: 'room_expired' };
        }
        const rows = await q.rows<Member & { isMe: boolean | null }>(
          `SELECT id, slot, nickname, ai_consent AS "aiConsent", token_hash = $2 AS "isMe"
           FROM participants WHERE room_id = $1 ORDER BY slot`,
          [
            roomId,
            typeof credential === 'string' ? hashToken(credential) : null,
          ],
        );
        const members: Member[] = rows;
        const { expired: _, ...roomRow } = room;
        const scope: GuestScope = { q, room: roomRow, members };
        if (credential === GUEST) {
          return { ok: true, value: await fn(scope) };
        }
        const me = rows.find((r) => r.isMe);
        if (!me) return { ok: false, code: 'invalid_token' };
        return { ok: true, value: await fn({ ...scope, me }) };
      },
    );

    if (opened.ok) return opened.value;
    if (opened.code === 'room_expired' && !locking) {
      await this.db.tx('read committed', (q) => purgeExpired(q, roomId));
    }
    throw new ApiError(opened.code);
  }
}

async function apply<T>({ q, room }: GuestScope, o: Outcome<T>): Promise<T> {
  switch (o.kind) {
    case 'unchanged':
      return o.value;
    case 'bump': {
      const row = await q.one<{ revision: number }>(
        'UPDATE rooms SET revision = revision + 1 WHERE id = $1 RETURNING revision',
        [room.id],
      );
      return o.build(row!.revision);
    }
    case 'deleteRoom':
      await q.exec('DELETE FROM rooms WHERE id = $1', [room.id]);
      return o.value;
  }
}

async function purgeExpired(q: Sql, roomId: RoomId): Promise<void> {
  const deleted = await q.exec(
    'DELETE FROM rooms WHERE id = $1 AND expires_at <= now()',
    [roomId],
  );
  if (deleted) {
    await q.exec(
      'INSERT INTO room_tombstones (room_id) VALUES ($1) ON CONFLICT DO NOTHING',
      [roomId],
    );
  }
}
