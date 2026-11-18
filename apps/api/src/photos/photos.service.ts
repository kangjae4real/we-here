import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { CONFIG, type Config } from '../config.js';
import type { W } from '../contract/index.js';
import { asUuid, type PhotoId } from '../core/domain.js';
import {
  type ItemVerdict,
  planUpload,
  type StoredPhoto,
} from '../core/photo.js';
import { verifyThumb } from '../core/thumb.js';
import { Db } from '../db/db.js';
import { ApiError } from '../http/problem.js';
import { bump, RoomAccess, unchanged } from '../rooms/room-access.js';

@Injectable()
export class PhotosService {
  constructor(
    private readonly db: Db,
    private readonly access: RoomAccess,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  uploadPhotos(
    roomId: string,
    token: string | undefined,
    verdicts: ItemVerdict[],
  ): Promise<W<'UploadPhotosResponse'>> {
    return this.access.write(roomId, token, async ({ q, room, me }) => {
      const keys = verdicts.flatMap((v) => (v.ok ? [v.dedupeKey] : []));
      const stored = await q.rows<StoredPhoto & { dedupeKey: string }>(
        `SELECT p.id, p.dedupe_key AS "dedupeKey", octet_length(t.jpeg) AS "thumbBytes"
           FROM photos p LEFT JOIN photo_thumbs t ON t.photo_id = p.id
          WHERE p.participant_id = $1 AND p.dedupe_key = ANY($2)`,
        [me.id, keys],
      );
      const count = await q.one<{ n: number }>(
        'SELECT count(*) AS n FROM photos WHERE participant_id = $1',
        [me.id],
      );
      const plan = planUpload({
        verdicts,
        stored: new Map(stored.map((s) => [s.dedupeKey, s])),
        storedCount: count!.n,
        limit: this.config.photoLimitPerParticipant,
        newId: () => randomUUID() as PhotoId,
      });

      const p = plan.inserts;
      if (p.length) {
        await q.exec(
          `INSERT INTO photos (id, room_id, participant_id, dedupe_key, lat, lng,
                               taken_local, tz_offset_min, time_source, uncertain)
           SELECT id, $1, $2, k, la, ln, tl, tz, ts, u
             FROM unnest($3::uuid[], $4::text[], $5::numeric[], $6::numeric[],
                         $7::timestamp[], $8::int[], $9::text[], $10::bool[])
                  AS t(id, k, la, ln, tl, tz, ts, u)`,
          [
            room.id,
            me.id,
            p.map((x) => x.id),
            p.map((x) => x.dedupeKey),
            p.map((x) => x.lat),
            p.map((x) => x.lng),
            p.map((x) => x.takenLocal),
            p.map((x) => x.tzOffsetMin),
            p.map((x) => x.timeSource),
            p.map((x) => x.uncertain),
          ],
        );
      }
      const thumbs = [
        ...p.flatMap((x) => (x.thumb ? [{ id: x.id, thumb: x.thumb }] : [])),
        ...plan.thumbFills,
      ];
      if (thumbs.length) {
        await q.exec(
          `INSERT INTO photo_thumbs (photo_id, jpeg)
           SELECT * FROM unnest($1::uuid[], $2::bytea[])
           ON CONFLICT (photo_id) DO UPDATE SET jpeg = excluded.jpeg`,
          [thumbs.map((t) => t.id), thumbs.map((t) => Buffer.from(t.thumb))],
        );
      }

      const result = (revision: number) => ({
        revision,
        results: plan.results,
      });
      return p.length || plan.thumbFills.length
        ? bump(result)
        : unchanged(result(room.revision));
    });
  }

  deleteMyPhotos(
    roomId: string,
    token: string | undefined,
  ): Promise<W<'DeletePhotosResponse'>> {
    return this.access.write(roomId, token, async ({ q, room, me }) => {
      const deletedCount = await q.exec(
        'DELETE FROM photos WHERE participant_id = $1',
        [me.id],
      );
      const result = (revision: number) => ({ deletedCount, revision });
      return deletedCount ? bump(result) : unchanged(result(room.revision));
    });
  }

  deletePhoto(
    roomId: string,
    token: string | undefined,
    rawPhotoId: string,
  ): Promise<W<'DeletePhotosResponse'>> {
    return this.access.write(roomId, token, async ({ q, room, me }) => {
      const id = asUuid<PhotoId>(rawPhotoId);
      const photo = id
        ? await q.one<{ owner: string }>(
            'SELECT participant_id AS owner FROM photos WHERE id = $1 AND room_id = $2',
            [id, room.id],
          )
        : undefined;
      if (!photo) throw new ApiError('photo_not_found');
      if (photo.owner !== me.id) throw new ApiError('not_owner');
      await q.exec('DELETE FROM photos WHERE id = $1', [id]);
      return bump((revision) => ({ deletedCount: 1, revision }));
    });
  }

  /** Authenticated by the signature alone; `<img>` cannot send a token. */
  async getThumbnail(
    rawPhotoId: string,
    exp: string | undefined,
    sig: string | undefined,
  ): Promise<Buffer> {
    const check = verifyThumb(
      this.config.thumbSigningSecret,
      rawPhotoId,
      exp,
      sig,
      Date.now(),
    );
    if (check !== 'ok') throw new ApiError(check);
    const id = asUuid<PhotoId>(rawPhotoId);
    const row = id
      ? await this.db.q.one<{ jpeg: Buffer; roomExpired: boolean }>(
          `SELECT t.jpeg, r.expires_at <= now() AS "roomExpired"
             FROM photo_thumbs t
             JOIN photos p ON p.id = t.photo_id
             JOIN rooms r ON r.id = p.room_id
            WHERE t.photo_id = $1`,
          [id],
        )
      : undefined;
    if (!row) throw new ApiError('photo_not_found');
    if (row.roomExpired) throw new ApiError('room_expired');
    return row.jpeg;
  }
}
