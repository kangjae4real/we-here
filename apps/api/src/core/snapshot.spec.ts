import { OPERATIONS, validatorFor } from '../contract/index.js';
import { analyze } from './analysis.js';
import type {
  LocalDate,
  LocalDateTime,
  ParticipantId,
  PhotoId,
  Slot,
} from './domain.js';
import { labelKey } from './geo.js';
import { analysisInput, type RoomPhoto, toSnapshot } from './snapshot.js';

const MET_ON = '2024-03-02' as LocalDate;
const SEOYEON = '6f1c2a9e-1c7b-4c1e-9a40-0b6f6e1f3a11' as ParticipantId;
const DOYUN = '0d8b7c55-2e14-4f7a-8a6e-1b2c3d4e5f60' as ParticipantId;

let serial = 0;
function photo(
  slot: Slot,
  takenLocal: string,
  lat: number,
  lng: number,
  over: Partial<RoomPhoto> = {},
): RoomPhoto {
  serial += 1;
  return {
    id: `00000000-0000-4000-8000-${String(serial).padStart(12, '0')}` as PhotoId,
    participantId: slot === 'A' ? SEOYEON : DOYUN,
    slot,
    dedupeKey: serial.toString(16).padStart(64, '0'),
    lat,
    lng,
    takenLocal: takenLocal as LocalDateTime,
    tzOffsetMin: 540,
    timeSource: 'kr_bounds',
    uncertain: false,
    uploadedAt: new Date('2024-03-12T10:04:31.000Z'),
    hasThumb: false,
    ...over,
  };
}

function snapshotOf(photos: RoomPhoto[], labels = new Map<string, string>()) {
  return toSnapshot({
    revision: 7,
    metOn: MET_ON,
    photos,
    analysis: analyze(analysisInput(photos, MET_ON)),
    labels,
    thumbUrl: (id) => `/thumbs/${id}?exp=1&sig=x`,
  });
}

const snapshotSchema =
  OPERATIONS.getSnapshot.responses['200'].content['application/json'].schema;

describe('toSnapshot', () => {
  const a = photo('A', '2022-04-09T15:12:00', 37.5284, 126.9341, { hasThumb: true });
  const b = photo('B', '2022-04-09T15:20:00', 37.5275, 126.9363);
  const tokyo = photo('B', '2023-01-05T12:00:00', 35.6812, 139.7671, {
    tzOffsetMin: 540,
    timeSource: 'offset',
  });
  const after1 = photo('A', '2024-03-10T18:05:00', 37.5446, 127.0557);
  const after2 = photo('B', '2024-03-11T09:00:00', 37.5446, 127.0557);

  it('maps the analysis onto the contract shape', () => {
    const s = snapshotOf([after2, b, tokyo, a, after1]);
    const validate = validatorFor(snapshotSchema);
    expect(validate(s), JSON.stringify(validate.errors)).toBe(true);
    expect(s.revision).toBe(7);
    expect(s.criteria).toEqual({ radiusM: 250, windowMin: 10, mergeGapMin: 30 });
  });

  it('puts slot A on side a, keys sides by participant and lists act 2 by encounter id', () => {
    const s = snapshotOf([b, a]);
    expect(s.encounters).toHaveLength(1);
    const [e] = s.encounters;
    expect(e.a).toEqual({ participantId: SEOYEON, photoId: a.id, takenLocal: a.takenLocal });
    expect(e.b).toEqual({ participantId: DOYUN, photoId: b.id, takenLocal: b.takenLocal });
    expect(e.gapMin).toBe(8);
    expect(Number.isInteger(e.distanceM)).toBe(true);
    expect(s.story.act2.encounterIds).toEqual([e.id]);
  });

  it('rounds centers to 4 decimals', () => {
    const [e] = snapshotOf([a, b]).encounters;
    expect(e.center).toEqual({ lat: 37.528, lng: 126.9352 });
    const cell = snapshotOf([after1]).heatmap.cells[0];
    expect(String(cell.lat).split('.')[1].length).toBeLessThanOrEqual(4);
  });

  it('writes 해외 outside Korea and the cached name, else null, inside it', () => {
    const labels = new Map([[labelKey(a), '여의도동']]);
    const s = snapshotOf([a, b, tokyo], labels);
    const place = (id: string) => s.photos.find((p) => p.id === id)?.placeLabel;
    expect(place(tokyo.id)).toBe('해외');
    expect(place(a.id)).toBe('여의도동');
    expect(place(b.id)).toBeNull();
    expect(s.stats.newest).toEqual({ takenLocal: tokyo.takenLocal, placeLabel: '해외' });
    expect(s.stats.oldest).toEqual({ takenLocal: a.takenLocal, placeLabel: '여의도동' });
  });

  it('signs a thumbnail URL only for photos that have one, and derives takenUtc from the offset', () => {
    const s = snapshotOf([a, b]);
    expect(s.photos.map((p) => p.thumbUrl)).toEqual([`/thumbs/${a.id}?exp=1&sig=x`, null]);
    expect(s.photos[0].takenUtc).toBe('2022-04-09T06:12:00Z');
    expect(s.photos[0].uploadedAt).toBe('2024-03-12T10:04:31.000Z');
  });

  it('counts after-meeting days per cell, ranks the top list and starts act 3 at metOn', () => {
    const s = snapshotOf([after1, after2]);
    expect(s.heatmap.cells).toHaveLength(1);
    expect(s.heatmap.cells[0]).toMatchObject({ days: 2, weight: 1 });
    expect(s.heatmap.top).toEqual([
      { rank: 1, cellId: s.heatmap.cells[0].cellId, placeLabel: null, days: 2 },
    ]);
    expect(s.story.act3).toEqual({ from: MET_ON, placeCount: 1, dayCount: 2 });
    expect(s.stats.afterMetPlaceCount).toBe(1);
  });

  it('gives an empty room null stats and empty lists', () => {
    const s = snapshotOf([]);
    expect(s.stats).toEqual({ oldest: null, newest: null, afterMetPlaceCount: 0 });
    expect(s.photos).toEqual([]);
    expect(s.closest).toEqual([]);
  });
});
