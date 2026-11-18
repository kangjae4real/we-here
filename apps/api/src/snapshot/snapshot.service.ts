import { Inject, Injectable } from '@nestjs/common';
import { CONFIG, type Config } from '../config.js';
import type { W } from '../contract/index.js';
import { type Analysis, analyze } from '../core/analysis.js';
import type { LocalDate, RoomId } from '../core/domain.js';
import {
  analysisInput,
  type Labels,
  type RoomPhoto,
  toSnapshot,
} from '../core/snapshot.js';
import { thumbExp, thumbPath } from '../core/thumb.js';
import type { Sql } from '../db/db.js';
import { RoomAccess } from '../rooms/room-access.js';
import { PlaceLabeler } from './place-labeler.js';

export function readRoomPhotos(q: Sql, roomId: RoomId): Promise<RoomPhoto[]> {
  return q.rows<RoomPhoto>(
    `SELECT p.id, p.participant_id AS "participantId", pa.slot,
            p.dedupe_key AS "dedupeKey", p.lat, p.lng,
            p.taken_local AS "takenLocal", p.tz_offset_min AS "tzOffsetMin",
            p.time_source AS "timeSource", p.uncertain,
            p.uploaded_at AS "uploadedAt",
            EXISTS (SELECT 1 FROM photo_thumbs t WHERE t.photo_id = p.id) AS "hasThumb"
       FROM photos p JOIN participants pa ON pa.id = p.participant_id
      WHERE p.room_id = $1`,
    [roomId],
  );
}

export interface LabelledAnalysis {
  analysis: Analysis;
  labels: Labels;
}

@Injectable()
export class SnapshotService {
  constructor(
    private readonly access: RoomAccess,
    private readonly labeler: PlaceLabeler,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  async snapshot(
    roomId: string,
    token: string | undefined,
  ): Promise<W<'Snapshot'>> {
    const { room, photos } = await this.access.read(
      roomId,
      token,
      async ({ q, room }) => ({ room, photos: await readRoomPhotos(q, room.id) }),
    );
    const { analysis, labels } = await this.analyze(photos, room.metOn);
    const exp = thumbExp(Date.now(), room.expiresAt.getTime());
    return toSnapshot({
      revision: room.revision,
      metOn: room.metOn,
      photos,
      analysis,
      labels,
      thumbUrl: (id) => thumbPath(this.config.thumbSigningSecret, id, exp),
    });
  }

  async analyze(
    photos: readonly RoomPhoto[],
    metOn: LocalDate,
  ): Promise<LabelledAnalysis> {
    const analysis = analyze(analysisInput(photos, metOn));
    const labels = await this.labeler.label(analysis.labelPoints, [
      ...photos,
      ...analysis.heatmap.cells.map((c) => c.center),
    ]);
    return { analysis, labels };
  }
}
