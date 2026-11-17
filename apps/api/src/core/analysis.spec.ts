import { createHash } from 'node:crypto';
import { type PhotoFact, type Slot, analyze } from './analysis.js';
import { type LatLng, cellOf } from './geo.js';

const MET_ON = '2024-03-02';
const KST_OFFSET_MS = 9 * 3_600_000;
const M_PER_DEG = (6_371_008.8 * Math.PI) / 180;
const HONGDAE: LatLng = { lat: 37.5563, lng: 126.9236 };

const north = (from: LatLng, m: number): LatLng => ({ lat: from.lat + m / M_PER_DEG, lng: from.lng });

let serial = 0;
function shot(slot: Slot, takenLocal: string, at: LatLng, extra: Partial<PhotoFact> = {}): PhotoFact {
  serial += 1;
  return {
    id: `00000000-0000-4000-8000-${String(serial).padStart(12, '0')}`,
    slot,
    lat: at.lat,
    lng: at.lng,
    takenLocal,
    takenUtcMs: Date.parse(`${takenLocal}Z`) - KST_OFFSET_MS,
    uncertain: false,
    dedupeKey: `key-${serial}`,
    ...extra,
  };
}

const run = (...photos: PhotoFact[]) => analyze({ metOn: MET_ON, photos });

describe('encounters', () => {
  it('pairs photos 249 m apart but not 251 m apart', () => {
    const near = run(shot('A', '2024-03-01T15:00:00', HONGDAE), shot('B', '2024-03-01T15:00:00', north(HONGDAE, 249)));
    const far = run(shot('A', '2024-03-01T15:00:00', HONGDAE), shot('B', '2024-03-01T15:00:00', north(HONGDAE, 251)));
    expect(near.encounters.map((e) => e.distanceM)).toEqual([249]);
    expect(far.encounters).toEqual([]);
  });

  it('pairs photos 9 minutes apart but not 11 minutes apart', () => {
    const within = run(shot('A', '2024-03-01T15:00:00', HONGDAE), shot('B', '2024-03-01T15:09:00', HONGDAE));
    const outside = run(shot('A', '2024-03-01T15:00:00', HONGDAE), shot('B', '2024-03-01T15:11:00', HONGDAE));
    expect(within.encounters.map((e) => e.gapMin)).toEqual([9]);
    expect(outside.encounters).toEqual([]);
  });

  it('keeps 08:00, 08:25 and 08:50 a few km apart as three moments in time order (E14)', () => {
    const places = [HONGDAE, north(HONGDAE, 3000), north(HONGDAE, 6000)];
    const photos = ['08:00', '08:25', '08:50'].flatMap((time, i) => [
      shot('A', `2024-03-01T${time}:00`, places[i]),
      shot('B', `2024-03-01T${time}:00`, north(places[i], 30)),
    ]);
    expect(run(...photos.reverse()).encounters.map((e) => e.a.takenLocal)).toEqual([
      '2024-03-01T08:00:00',
      '2024-03-01T08:25:00',
      '2024-03-01T08:50:00',
    ]);
  });

  it('chains candidates at one place into one moment shown by its closest, then earliest, pair', () => {
    const { encounters } = run(
      shot('A', '2024-03-01T08:00:00', HONGDAE),
      shot('B', '2024-03-01T08:00:00', north(HONGDAE, 120)),
      shot('A', '2024-03-01T08:25:00', HONGDAE),
      shot('B', '2024-03-01T08:26:00', north(HONGDAE, 40)),
      shot('A', '2024-03-01T08:50:00', HONGDAE),
      shot('B', '2024-03-01T08:50:00', north(HONGDAE, 40)),
    );
    expect(encounters).toHaveLength(1);
    expect(encounters[0]).toMatchObject({ distanceM: 40, gapMin: 1, a: { takenLocal: '2024-03-01T08:25:00' } });
  });

  it('chains a 30-minute gap but splits a 31-minute gap', () => {
    const moments = (second: string) =>
      run(
        shot('A', '2024-03-01T08:00:00', HONGDAE),
        shot('B', '2024-03-01T08:00:00', north(HONGDAE, 20)),
        shot('A', `2024-03-01T${second}:00`, HONGDAE),
        shot('B', `2024-03-01T${second}:00`, north(HONGDAE, 20)),
      ).encounters.length;
    expect(moments('08:30')).toBe(1);
    expect(moments('08:31')).toBe(2);
  });

  it('measures drift from the first candidate, so a walk past 500 m starts a new moment', () => {
    const { encounters } = run(
      shot('A', '2024-03-01T08:00:00', HONGDAE),
      shot('B', '2024-03-01T08:00:00', north(HONGDAE, 20)),
      shot('A', '2024-03-01T08:10:00', north(HONGDAE, 300)),
      shot('B', '2024-03-01T08:10:00', north(HONGDAE, 320)),
      shot('A', '2024-03-01T08:20:00', north(HONGDAE, 600)),
      shot('B', '2024-03-01T08:20:00', north(HONGDAE, 620)),
    );
    expect(encounters.map((e) => e.a.takenLocal)).toEqual(['2024-03-01T08:00:00', '2024-03-01T08:20:00']);
  });

  it('ignores a shared copy of one photo in moments, near misses and act 1 (E1)', () => {
    const mine = shot('A', '2024-03-01T15:00:00', HONGDAE);
    const sharedCopy = shot('B', '2024-03-01T15:00:00', HONGDAE, { dedupeKey: mine.dedupeKey });
    const theirOwn = shot('B', '2024-03-01T15:00:00', HONGDAE);
    expect(run(mine, sharedCopy)).toMatchObject({ encounters: [], closest: [], act1: { total: 0 } });
    expect(run(mine, theirOwn).encounters).toHaveLength(1);
  });

  it('puts the slot A photo in a and the slot B photo in b, centred between them', () => {
    const b = shot('B', '2024-03-01T14:58:00', north(HONGDAE, 100));
    const a = shot('A', '2024-03-01T15:00:00', HONGDAE);
    const [encounter] = run(b, a).encounters;
    expect(encounter).toMatchObject({ a: { id: a.id }, b: { id: b.id }, gapMin: 2 });
    expect(encounter.center.lat).toBeCloseTo(north(HONGDAE, 50).lat, 9);
  });

  it('is uncertain when either photo of the shown pair has an assumed time', () => {
    const certain = run(shot('A', '2024-03-01T15:00:00', HONGDAE), shot('B', '2024-03-01T15:02:00', HONGDAE));
    const assumed = run(
      shot('A', '2024-03-01T15:00:00', HONGDAE),
      shot('B', '2024-03-01T15:02:00', HONGDAE, { uncertain: true }),
    );
    expect(certain.encounters[0].uncertain).toBe(false);
    expect(assumed.encounters[0].uncertain).toBe(true);
  });
});

describe('met day', () => {
  it('counts the met day itself as after meeting', () => {
    const dayBefore = run(shot('A', '2024-03-01T15:00:00', HONGDAE), shot('B', '2024-03-01T15:00:00', HONGDAE));
    const metDay = run(shot('A', '2024-03-02T15:00:00', HONGDAE), shot('B', '2024-03-02T15:00:00', HONGDAE));
    expect(dayBefore.encounters).toHaveLength(1);
    expect(dayBefore.heatmap.cells).toEqual([]);
    expect(metDay.encounters).toEqual([]);
    expect(metDay.heatmap.cells.map((c) => c.days)).toEqual([1]);
  });

  it('drops a pair across midnight when the later photo falls on the met day', () => {
    const photos = [shot('A', '2024-03-01T23:55:00', HONGDAE), shot('B', '2024-03-02T00:03:00', north(HONGDAE, 50))];
    expect(analyze({ metOn: '2024-03-02', photos }).encounters).toEqual([]);
    expect(analyze({ metOn: '2024-03-03', photos }).encounters).toHaveLength(1);
  });

  it('keeps a before-meeting moment even when a closer pair follows on the met day', () => {
    const { encounters } = run(
      shot('A', '2024-03-01T23:50:00', HONGDAE),
      shot('B', '2024-03-01T23:52:00', north(HONGDAE, 200)),
      shot('A', '2024-03-02T00:05:00', HONGDAE),
      shot('B', '2024-03-02T00:06:00', north(HONGDAE, 10)),
    );
    expect(encounters.map((e) => e.distanceM)).toEqual([200]);
  });

  it('pairs photos across the date line by instant and judges each by its own local date', () => {
    const instant = Date.parse('2024-02-28T20:00:00Z');
    const fiji = shot('A', '2024-02-29T08:00:00', { lat: 0, lng: 179.9995 }, { takenUtcMs: instant });
    const bakerIsland = shot('B', '2024-02-28T08:00:00', { lat: 0, lng: -179.9995 }, { takenUtcMs: instant });

    const bothBefore = analyze({ metOn: '2024-03-02', photos: [fiji, bakerIsland] });
    expect(bothBefore.encounters).toHaveLength(1);
    expect(bothBefore.encounters[0]).toMatchObject({ distanceM: 111, gapMin: 0 });
    expect(Math.abs(bothBefore.encounters[0].center.lng)).toBeGreaterThan(179.99);

    expect(analyze({ metOn: '2024-02-29', photos: [fiji, bakerIsland] }).encounters).toEqual([]);
  });
});

describe('stable ids', () => {
  it('derives a moment id from its photo pair, whatever the input order or unrelated photos', () => {
    const b = shot('B', '2024-03-01T15:03:00', north(HONGDAE, 60));
    const a = shot('A', '2024-03-01T15:00:00', HONGDAE);
    expect(b.id < a.id).toBe(true);
    const unrelated = [
      shot('A', '2023-07-01T10:00:00', north(HONGDAE, 9000)),
      shot('B', '2023-09-01T10:00:00', north(HONGDAE, 20000)),
    ];
    const [lo, hi] = [a.id, b.id].sort();
    const hex = createHash('sha1').update(`${lo}:${hi}`).digest('hex');
    const expected = `E-${BigInt(`0x${hex}`).toString(36).slice(0, 6)}`;

    const forward = run(a, b, ...unrelated);
    expect(forward.encounters.map((e) => e.id)).toEqual([expected]);
    expect(expected).toMatch(/^E-[a-z0-9]{6}$/);
    expect(run(...[...unrelated].reverse(), b, a)).toEqual(forward);
    expect(run(b, a).encounters[0].id).toBe(expected);
  });
});

describe('closest moments', () => {
  const nearMisses = () => [
    shot('A', '2023-01-01T12:00:00', HONGDAE),
    shot('B', '2023-01-01T12:00:00', north(HONGDAE, 300)),
    shot('A', '2023-01-05T12:00:00', HONGDAE),
    shot('B', '2023-01-05T12:30:00', north(HONGDAE, 100)),
    shot('A', '2023-01-09T12:00:00', HONGDAE),
    shot('B', '2023-01-09T12:05:00', north(HONGDAE, 1000)),
    shot('A', '2023-01-13T12:00:00', HONGDAE),
    shot('B', '2023-01-13T14:00:00', north(HONGDAE, 50)),
  ];

  it('shows the three lowest scores of metres/250 + minutes/10 when nothing crossed', () => {
    const { closest, labelPoints } = run(...nearMisses());
    expect(closest.map((c) => [c.distanceM, c.gapMin])).toEqual([
      [300, 0],
      [100, 30],
      [1000, 5],
    ]);
    expect(new Set(closest.map((c) => c.id)).size).toBe(3);
    expect(closest.every((c) => /^C-[a-z0-9]{6}$/.test(c.id))).toBe(true);
    expect(labelPoints).toEqual(expect.arrayContaining(closest.map((c) => c.center)));
  });

  it('stays empty when the room has a moment', () => {
    const crossed = [shot('A', '2023-02-01T12:00:00', HONGDAE), shot('B', '2023-02-01T12:00:00', north(HONGDAE, 20))];
    const result = run(...nearMisses(), ...crossed);
    expect(result.encounters).toHaveLength(1);
    expect(result.closest).toEqual([]);
  });

  it('looks up to 24 hours apart and no further', () => {
    const a = shot('A', '2023-01-01T12:00:00', HONGDAE);
    expect(run(a, shot('B', '2023-01-02T12:00:00', HONGDAE)).closest.map((c) => c.gapMin)).toEqual([1440]);
    expect(run(a, shot('B', '2023-01-02T12:01:00', HONGDAE)).closest).toEqual([]);
  });

  it('shows a burst of shots from one scene as one card', () => {
    const burstA = [0, 1, 2, 3, 4].map((i) => shot('A', `2023-01-01T14:0${i}:00`, HONGDAE));
    const burstB = [0, 1, 2, 3, 4].map((i) => shot('B', `2023-01-01T14:4${i}:00`, north(HONGDAE, 100)));
    const later = [shot('A', '2023-01-10T12:00:00', HONGDAE), shot('B', '2023-01-10T13:00:00', north(HONGDAE, 100))];
    const { closest } = run(...burstA, ...burstB, ...later);
    expect(closest.map((c) => c.a.takenLocal.slice(0, 10))).toEqual(['2023-01-01', '2023-01-10']);
  });
});

describe('act 1', () => {
  it('treats visits 10 m apart across a cell edge as the same place (E13)', () => {
    const step = 180 / 2 ** 17;
    const edgeLat = -90 + Math.ceil((HONGDAE.lat + 90) / step) * step;
    const a = shot('A', '2023-05-01T10:00:00', { lat: edgeLat - 5 / M_PER_DEG, lng: HONGDAE.lng });
    const b = shot('B', '2023-08-01T10:00:00', { lat: edgeLat + 5 / M_PER_DEG, lng: HONGDAE.lng });
    expect(cellOf(a)).not.toBe(cellOf(b));

    const { act1 } = run(a, b);
    expect(act1.total).toBe(1);
    expect(act1.items[0]).toMatchObject({ distanceM: 10, sameDay: false, a: { id: a.id }, b: { id: b.id } });
  });

  it('counts visits up to 150 m apart as one place', () => {
    const visits = (m: number) =>
      run(shot('A', '2023-05-01T10:00:00', HONGDAE), shot('B', '2023-08-01T10:00:00', north(HONGDAE, m))).act1.total;
    expect(visits(140)).toBe(1);
    expect(visits(160)).toBe(0);
  });

  it('marks a same-day near miss with its gap in minutes', () => {
    const { act1 } = run(
      shot('A', '2021-10-03T13:00:00', HONGDAE),
      shot('B', '2021-10-03T16:10:00', north(HONGDAE, 30)),
    );
    expect(act1.items.map((i) => [i.sameDay, i.gapMin])).toEqual([[true, 190]]);
  });

  it('keeps the closest-in-time pair per place, smallest gap first, ten places at most', () => {
    const places = Array.from({ length: 12 }, (_, i) => north(HONGDAE, i * 1000));
    const photos = places.flatMap((place, i) => [
      shot('A', '2023-01-01T10:00:00', place),
      shot('B', `2023-01-01T${String(11 + i).padStart(2, '0')}:00:00`, place),
    ]);
    photos.push(shot('B', '2023-01-01T10:20:00', places[11]));

    const { act1 } = run(...photos);
    expect(act1.total).toBe(12);
    expect(act1.items.map((i) => i.gapMin)).toEqual([20, 60, 120, 180, 240, 300, 360, 420, 480, 540]);
    expect(act1.items[0].cellId).toBe(cellOf(places[11]));
  });

  it('leaves out a place where the two crossed paths', () => {
    const elsewhere = north(HONGDAE, 5000);
    const { encounters, act1 } = run(
      shot('A', '2023-03-01T09:00:00', HONGDAE),
      shot('B', '2023-03-01T09:01:00', HONGDAE),
      shot('A', '2023-06-01T09:00:00', HONGDAE),
      shot('A', '2023-03-05T09:00:00', elsewhere),
      shot('B', '2023-04-05T09:00:00', elsewhere),
    );
    expect(encounters).toHaveLength(1);
    expect(act1.items.map((i) => i.cellId)).toEqual([cellOf(elsewhere)]);
  });
});

describe('heatmap and act 3', () => {
  const daily = (slot: Slot, days: number, at: LatLng) =>
    Array.from({ length: days }, (_, i) => shot(slot, `2024-05-${String(i + 1).padStart(2, '0')}T12:00:00`, at));

  it('counts a burst of 50 photos on one day as one day', () => {
    const burst = Array.from({ length: 50 }, (_, i) =>
      shot('A', `2024-04-01T12:${String(i).padStart(2, '0')}:00`, HONGDAE),
    );
    const { heatmap, act3 } = run(...burst);
    expect(heatmap.cells.map((c) => [c.cellId, c.days, c.weight])).toEqual([[cellOf(HONGDAE), 1, 1]]);
    expect(act3).toEqual({ placeCount: 1, dayCount: 1 });
  });

  it('counts a day when either participant was there, not only days together (O20)', () => {
    const elsewhere = north(HONGDAE, 5000);
    const { heatmap, act3 } = run(
      shot('A', '2024-04-01T12:00:00', HONGDAE),
      shot('B', '2024-04-02T12:00:00', HONGDAE),
      shot('A', '2024-04-03T12:00:00', HONGDAE),
      shot('B', '2024-04-03T12:30:00', HONGDAE),
      shot('B', '2024-04-04T12:00:00', elsewhere),
    );
    expect(heatmap.cells.map((c) => [c.cellId, c.days])).toEqual([
      [cellOf(HONGDAE), 3],
      [cellOf(elsewhere), 1],
    ]);
    expect(act3).toEqual({ placeCount: 2, dayCount: 4 });
  });

  it('scales weight to the busiest place with a floor of 0.1', () => {
    const { heatmap } = run(
      ...daily('A', 20, HONGDAE),
      ...daily('B', 10, north(HONGDAE, 3000)),
      ...daily('A', 1, north(HONGDAE, 6000)),
    );
    expect(heatmap.cells.map((c) => c.weight)).toEqual([1, 0.5, 0.1]);
  });

  it('ranks the top ten places by days', () => {
    const photos = Array.from({ length: 12 }, (_, i) => daily('A', i + 1, north(HONGDAE, i * 1000))).flat();
    const { heatmap } = run(...photos);
    expect(heatmap.cells).toHaveLength(12);
    expect(heatmap.top.map((c) => c.days)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
    expect(heatmap.top[0].cellId).toBe(cellOf(north(HONGDAE, 11000)));
  });
});

describe('room shapes', () => {
  it('returns an empty analysis for a room with no photos', () => {
    expect(run()).toEqual({
      encounters: [],
      closest: [],
      act1: { total: 0, items: [] },
      heatmap: { cells: [], top: [] },
      act3: { placeCount: 0, dayCount: 0 },
      stats: { oldest: null, newest: null },
      labelPoints: [],
    });
  });

  it('analyses one participant alone without inventing moments', () => {
    const result = run(
      shot('A', '2023-01-01T10:00:00', HONGDAE),
      shot('A', '2023-01-01T10:05:00', HONGDAE),
      shot('A', '2024-04-01T10:00:00', HONGDAE),
    );
    expect(result).toMatchObject({
      encounters: [],
      closest: [],
      act1: { total: 0, items: [] },
      act3: { placeCount: 1, dayCount: 1 },
    });
  });

  it('reports the oldest and newest photo across both participants and the met day', () => {
    const oldest = shot('B', '2019-06-02T14:20:00', HONGDAE);
    const newest = shot('A', '2024-03-10T18:05:00', north(HONGDAE, 3000));
    expect(run(shot('A', '2022-01-01T10:00:00', HONGDAE), newest, oldest).stats).toEqual({ oldest, newest });
  });

  it('asks for a place name at every named item: moments, act 1, top places and the record tab', () => {
    const elsewhere = north(HONGDAE, 5000);
    const lastTrip = north(HONGDAE, 9000);
    const result = run(
      shot('A', '2023-03-01T09:00:00', HONGDAE),
      shot('B', '2023-03-01T09:01:00', north(HONGDAE, 30)),
      shot('A', '2023-03-05T09:00:00', elsewhere),
      shot('B', '2023-04-05T09:00:00', elsewhere),
      shot('A', '2024-04-01T12:00:00', lastTrip),
    );
    const named = [
      result.encounters[0].center,
      result.act1.items[0].center,
      result.heatmap.top[0].center,
      HONGDAE,
      lastTrip,
    ];
    expect(result.labelPoints).toHaveLength(named.length);
    expect(result.labelPoints).toEqual(expect.arrayContaining(named));
  });
});
