import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { CONFIG, type Config } from '../config.js';
import type { W } from '../contract/index.js';
import {
  asUuid,
  type LocalDate,
  type ParticipantId,
  vacantSlot,
} from '../core/domain.js';
import { InvalidInput } from '../core/input.js';
import { Db, type Sql } from '../db/db.js';
import { ApiError } from '../http/problem.js';
import {
  bump,
  deleteRoom,
  type MemberScope,
  RoomAccess,
  unchanged,
} from './room-access.js';
import {
  hashToken,
  newInviteSecret,
  newRoomId,
  newToken,
  sameSecret,
} from './secrets.js';

export interface NewRoom {
  name: string;
  nickname: string;
  metOn: LocalDate;
}

@Injectable()
export class RoomsService {
  constructor(
    private readonly db: Db,
    private readonly access: RoomAccess,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  async createRoom(input: NewRoom): Promise<W<'CreateRoomResponse'>> {
    const roomId = newRoomId();
    const participantId = randomUUID();
    const token = newToken();
    const inviteSecret = newInviteSecret();
    const expiresAt = await this.db.tx('read committed', async (q) => {
      const room = await q.one<{ expiresAt: Date }>(
        `INSERT INTO rooms (id, name, met_on, invite_secret, expires_at)
         VALUES ($1, $2, $3, $4, now() + interval '30 days')
         RETURNING expires_at AS "expiresAt"`,
        [roomId, input.name, input.metOn, inviteSecret],
      );
      await q.exec(
        `INSERT INTO participants (id, room_id, slot, nickname, token_hash)
         VALUES ($1, $2, 'A', $3, $4)`,
        [participantId, roomId, input.nickname, hashToken(token)],
      );
      return room!.expiresAt;
    });
    return {
      roomId,
      participantId,
      token,
      inviteSecret,
      expiresAt: expiresAt.toISOString(),
      revision: 1,
    };
  }

  getInvitePreview(
    roomId: string,
    secret: string | undefined,
  ): Promise<W<'InvitePreview'>> {
    return this.access.readAsGuest(roomId, async ({ room, members }) => {
      if (!sameSecret(secret, room.inviteSecret)) {
        throw new ApiError('invite_invalid');
      }
      const slot = vacantSlot(members);
      return {
        roomId: room.id,
        name: room.name,
        inviterNickname: members[0].nickname,
        metOn: room.metOn,
        status: slot ? 'open' : 'full',
        vacantSlot: slot,
      };
    });
  }

  joinRoom(
    roomId: string,
    input: { nickname: string; inviteSecret: string },
  ): Promise<W<'JoinRoomResponse'>> {
    return this.access.writeAsGuest(roomId, async ({ q, room, members }) => {
      if (!sameSecret(input.inviteSecret, room.inviteSecret)) {
        throw new ApiError('invite_invalid');
      }
      const slot = vacantSlot(members);
      if (!slot) throw new ApiError('room_full');
      const participantId = randomUUID();
      const token = newToken();
      await q.exec(
        `INSERT INTO participants (id, room_id, slot, nickname, token_hash)
         VALUES ($1, $2, $3, $4, $5)`,
        [participantId, room.id, slot, input.nickname, hashToken(token)],
      );
      return bump((revision) => ({
        roomId: room.id,
        participantId,
        token,
        slot,
        revision,
      }));
    });
  }

  getRoom(roomId: string, token: string | undefined): Promise<W<'Room'>> {
    return this.access.read(roomId, token, async ({ q, room, members, me }) => {
      const counts = await q.rows<{ id: ParticipantId; n: number }>(
        `SELECT participant_id AS id, count(*) AS n
           FROM photos WHERE room_id = $1 GROUP BY participant_id`,
        [room.id],
      );
      const last = await q.one<{ id: string }>(
        'SELECT id FROM chat_messages WHERE room_id = $1 ORDER BY seq DESC LIMIT 1',
        [room.id],
      );
      return {
        roomId: room.id,
        name: room.name,
        metOn: room.metOn,
        expiresAt: room.expiresAt.toISOString(),
        revision: room.revision,
        meId: me.id,
        participants: members.map((m) => ({
          id: m.id,
          nickname: m.nickname,
          slot: m.slot,
          photoCount: counts.find((c) => c.id === m.id)?.n ?? 0,
          aiConsent: m.aiConsent,
        })),
        inviteSecret: vacantSlot(members) ? room.inviteSecret : null,
        chat: await readRoomQuota(q, room.id, this.config.chatRoomHourlyLimit),
        chatLastMessageId: last?.id ?? null,
        photoLimit: this.config.photoLimitPerParticipant,
      };
    });
  }

  updateRoom(
    roomId: string,
    token: string | undefined,
    metOn: LocalDate,
  ): Promise<W<'UpdateRoomResponse'>> {
    return this.access.write(roomId, token, async ({ q, room }) => {
      const changed = await q.exec(
        'UPDATE rooms SET met_on = $2 WHERE id = $1 AND met_on <> $2',
        [room.id, metOn],
      );
      const result = (revision: number) => ({
        roomId: room.id,
        metOn,
        revision,
      });
      return changed ? bump(result) : unchanged(result(room.revision));
    });
  }

  updateMe(
    roomId: string,
    token: string | undefined,
    aiConsent: boolean,
  ): Promise<W<'UpdateMeResponse'>> {
    return this.access.write(roomId, token, async ({ q, room, me }) => {
      const changed = await q.exec(
        'UPDATE participants SET ai_consent = $2 WHERE id = $1 AND ai_consent <> $2',
        [me.id, aiConsent],
      );
      const result = (revision: number) => ({
        participantId: me.id,
        aiConsent,
        revision,
      });
      return changed ? bump(result) : unchanged(result(room.revision));
    });
  }

  leaveRoom(
    roomId: string,
    token: string | undefined,
  ): Promise<W<'LeaveRoomResponse'>> {
    return this.access.write<W<'LeaveRoomResponse'>>(
      roomId,
      token,
      async (scope) => {
        const deletedPhotoCount = await vacate(scope, scope.me.id);
        if (scope.members.length === 1) {
          return deleteRoom({ deletedPhotoCount, roomDeleted: true });
        }
        await rotateInvite(scope);
        return bump(() => ({ deletedPhotoCount, roomDeleted: false }));
      },
    );
  }

  removePartner(
    roomId: string,
    token: string | undefined,
    rawParticipantId: string,
  ): Promise<W<'RemovePartnerResponse'>> {
    return this.access.write(roomId, token, async (scope) => {
      const id = asUuid<ParticipantId>(rawParticipantId);
      if (id === scope.me.id) {
        throw new InvalidInput([{ field: 'participantId', code: 'self' }]);
      }
      if (!scope.members.some((m) => m.id === id)) {
        throw new ApiError('participant_not_found');
      }
      const deletedPhotoCount = await vacate(scope, id!);
      const inviteSecret = await rotateInvite(scope);
      return bump((revision) => ({
        deletedPhotoCount,
        inviteSecret,
        revision,
      }));
    });
  }
}

/**
 * Frees a seat: the participant's photos, the participant, and the room's
 * chat history (answers may quote the leaver's photos). Chat reservations
 * stay, so leaving does not refill the hourly quota.
 */
async function vacate({ q, room }: MemberScope, id: ParticipantId) {
  const deletedPhotoCount = await q.exec(
    'DELETE FROM photos WHERE participant_id = $1',
    [id],
  );
  await q.exec('DELETE FROM chat_messages WHERE room_id = $1', [room.id]);
  await q.exec('DELETE FROM participants WHERE id = $1', [id]);
  return deletedPhotoCount;
}

/** A freed seat gets a new invite secret, so links sent before stop working. */
async function rotateInvite({ q, room }: MemberScope): Promise<string> {
  const secret = newInviteSecret();
  await q.exec('UPDATE rooms SET invite_secret = $2 WHERE id = $1', [
    room.id,
    secret,
  ]);
  return secret;
}

/** Reservations in the last hour; resets when the oldest one turns an hour old. */
export async function readRoomQuota(
  q: Sql,
  roomId: string,
  limit: number,
): Promise<W<'ChatQuota'>> {
  const row = await q.one<{ used: number; resetAt: Date }>(
    `SELECT count(*) AS used,
            coalesce(min(created_at), now() - interval '1 hour') + interval '1 hour' AS "resetAt"
       FROM chat_reservations
      WHERE room_id = $1 AND created_at > now() - interval '1 hour'`,
    [roomId],
  );
  return { used: row!.used, limit, resetAt: row!.resetAt.toISOString() };
}
