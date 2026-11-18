import type { W } from '../contract/index.js';
import {
  type Analysis,
  type AnalysisInput,
  CRITERIA,
  type PhotoFact,
} from './analysis.js';
import type {
  LocalDate,
  LocalDateTime,
  ParticipantId,
  PhotoId,
  Slot,
} from './domain.js';
import { inKorea, type LatLng, labelKey } from './geo.js';
import type { TimeSource } from './time.js';

export interface RoomPhoto {
  id: PhotoId;
  participantId: ParticipantId;
  slot: Slot;
  dedupeKey: string;
  lat: number;
  lng: number;
  takenLocal: LocalDateTime;
  tzOffsetMin: number;
  timeSource: TimeSource;
  uncertain: boolean;
  uploadedAt: Date;
  hasThumb: boolean;
}

export type Labels = ReadonlyMap<string, string>;

export const ABROAD = '해외';

export function placeOf(labels: Labels, p: LatLng): string | null {
  return inKorea(p) ? (labels.get(labelKey(p)) ?? null) : ABROAD;
}

export function takenUtcMs(p: {
  takenLocal: LocalDateTime;
  tzOffsetMin: number;
}): number {
  return Date.parse(`${p.takenLocal}Z`) - p.tzOffsetMin * 60_000;
}

export function analysisInput(
  photos: readonly RoomPhoto[],
  metOn: LocalDate,
): AnalysisInput {
  return {
    metOn,
    photos: photos.map((p) => ({
      id: p.id,
      slot: p.slot,
      lat: p.lat,
      lng: p.lng,
      takenLocal: p.takenLocal,
      takenUtcMs: takenUtcMs(p),
      uncertain: p.uncertain,
      dedupeKey: p.dedupeKey,
    })),
  };
}

export interface SnapshotParts {
  revision: number;
  metOn: LocalDate;
  photos: readonly RoomPhoto[];
  analysis: Analysis;
  labels: Labels;
  thumbUrl: (photoId: PhotoId) => string;
}

const round4 = (x: number) => Math.round(x * 1e4) / 1e4;
const point = (p: LatLng): LatLng => ({ lat: round4(p.lat), lng: round4(p.lng) });
const isoUtc = (ms: number) => new Date(ms).toISOString().replace('.000Z', 'Z');

export function toSnapshot(s: SnapshotParts): W<'Snapshot'> {
  const { analysis: an, labels } = s;
  const byId = new Map(s.photos.map((p) => [p.id as string, p]));
  const side = (p: PhotoFact): W<'MomentSide'> => ({
    participantId: byId.get(p.id)!.participantId,
    photoId: p.id,
    takenLocal: p.takenLocal,
  });
  const place = (p: LatLng) => placeOf(labels, p);
  const brief = (p: PhotoFact | null): W<'PhotoBrief'> | null =>
    p && { takenLocal: p.takenLocal, placeLabel: place(p) };

  const photos = [...s.photos]
    .sort((x, y) => takenUtcMs(x) - takenUtcMs(y) || (x.id < y.id ? -1 : 1))
    .map(
      (p): W<'Photo'> => ({
        id: p.id,
        participantId: p.participantId,
        dedupeKey: p.dedupeKey,
        lat: p.lat,
        lng: p.lng,
        takenLocal: p.takenLocal,
        takenUtc: isoUtc(takenUtcMs(p)),
        tzOffsetMin: p.tzOffsetMin,
        timeSource: p.timeSource,
        uncertain: p.uncertain,
        placeLabel: place(p),
        thumbUrl: p.hasThumb ? s.thumbUrl(p.id) : null,
        uploadedAt: p.uploadedAt.toISOString(),
      }),
    );

  return {
    revision: s.revision,
    criteria: { ...CRITERIA },
    stats: {
      oldest: brief(an.stats.oldest),
      newest: brief(an.stats.newest),
      afterMetPlaceCount: an.act3.placeCount,
    },
    photos,
    encounters: an.encounters.map((e) => ({
      id: e.id,
      a: side(e.a),
      b: side(e.b),
      distanceM: e.distanceM,
      gapMin: e.gapMin,
      center: point(e.center),
      placeLabel: place(e.center),
      uncertain: e.uncertain,
    })),
    closest: an.closest.map((c) => ({
      id: c.id,
      a: side(c.a),
      b: side(c.b),
      distanceM: c.distanceM,
      gapMin: c.gapMin,
      placeLabel: place(c.center),
    })),
    heatmap: {
      cells: an.heatmap.cells.map((c) => ({
        cellId: c.cellId,
        ...point(c.center),
        days: c.days,
        weight: c.weight,
        placeLabel: place(c.center),
      })),
      top: an.heatmap.top.map((c, i) => ({
        rank: i + 1,
        cellId: c.cellId,
        placeLabel: place(c.center),
        days: c.days,
      })),
    },
    story: {
      act1: {
        total: an.act1.total,
        items: an.act1.items.map((i) => ({
          cellId: i.cellId,
          placeLabel: place(i.center),
          a: side(i.a),
          b: side(i.b),
          sameDay: i.sameDay,
          gapMin: i.gapMin,
        })),
      },
      act2: { encounterIds: an.encounters.map((e) => e.id) },
      act3: {
        from: s.metOn,
        placeCount: an.act3.placeCount,
        dayCount: an.act3.dayCount,
      },
    },
  };
}
