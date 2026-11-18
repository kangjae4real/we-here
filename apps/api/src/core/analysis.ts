import { createHash } from 'node:crypto';
import {
  type CellId,
  type LatLng,
  cellCenter,
  cellOf,
  haversineM,
  midpoint,
  neighborCells,
} from './geo.js';

export type Slot = 'A' | 'B';
export type EncounterId = `E-${string}`;
export type ClosestId = `C-${string}`;

export interface PhotoFact extends LatLng {
  id: string;
  slot: Slot;
  takenLocal: string;
  takenUtcMs: number;
  uncertain: boolean;
  dedupeKey: string;
}

export interface AnalysisInput {
  photos: readonly PhotoFact[];
  metOn: string;
}

export interface PhotoPair {
  a: PhotoFact;
  b: PhotoFact;
  distanceM: number;
  gapMin: number;
}

export interface Encounter extends PhotoPair {
  id: EncounterId;
  center: LatLng;
  uncertain: boolean;
}

export interface ClosestMoment extends PhotoPair {
  id: ClosestId;
  center: LatLng;
}

export interface Act1Item extends PhotoPair {
  cellId: CellId;
  center: LatLng;
  sameDay: boolean;
}

export interface HeatCell {
  cellId: CellId;
  center: LatLng;
  days: number;
  weight: number;
}

export interface Analysis {
  encounters: Encounter[];
  closest: ClosestMoment[];
  act1: { total: number; items: Act1Item[] };
  heatmap: { cells: HeatCell[]; top: HeatCell[] };
  act3: { placeCount: number; dayCount: number };
  stats: { oldest: PhotoFact | null; newest: PhotoFact | null };
  labelPoints: LatLng[];
}

export const CRITERIA = { radiusM: 250, windowMin: 10, mergeGapMin: 30 } as const;

const MINUTE_MS = 60_000;
const RADIUS_M = CRITERIA.radiusM;
const WINDOW_MS = CRITERIA.windowMin * MINUTE_MS;
const MERGE_GAP_MS = CRITERIA.mergeGapMin * MINUTE_MS;
const MERGE_RADIUS_M = 500;
const SAME_PLACE_M = 150;
const CLOSEST_WINDOW_MS = 24 * 60 * MINUTE_MS;
const CLOSEST_MAX = 3;
const ACT1_MAX = 10;
const TOP_MAX = 10;
const MIN_WEIGHT = 0.1;

interface Measured {
  a: PhotoFact;
  b: PhotoFact;
  m: number;
  gapMs: number;
}

export function analyze({ photos, metOn }: AnalysisInput): Analysis {
  const byTime = [...photos].sort((x, y) => x.takenUtcMs - y.takenUtcMs || byText(x.id, y.id));
  const before = byTime.filter((p) => localDate(p) < metOn);
  const A = before.filter((p) => p.slot === 'A');
  const B = before.filter((p) => p.slot === 'B');

  const candidates = encounterCandidates(A, B);
  const encounters = groupEncounters(candidates);
  const closest = encounters.length > 0 ? [] : closestMoments(A, B);
  const act1 = act1Cards(A, B, candidates);
  const { heatmap, act3 } = afterMeeting(byTime.filter((p) => localDate(p) >= metOn));
  const stats = { oldest: byTime.at(0) ?? null, newest: byTime.at(-1) ?? null };

  return {
    encounters,
    closest,
    act1,
    heatmap,
    act3,
    stats,
    labelPoints: [
      ...encounters.map((e) => e.center),
      ...closest.map((c) => c.center),
      ...act1.items.map((i) => i.center),
      ...heatmap.top.map((c) => c.center),
      ...[stats.oldest, stats.newest].filter((p) => p !== null).map(({ lat, lng }) => ({ lat, lng })),
    ],
  };
}

function encounterCandidates(A: readonly PhotoFact[], B: readonly PhotoFact[]): Measured[] {
  const found: Measured[] = [];
  for (const [a, b] of pairsWithin(A, B, WINDOW_MS)) {
    const m = haversineM(a, b);
    if (m <= RADIUS_M) found.push({ a, b, m, gapMs: gapMs(a, b) });
  }
  return found;
}

function groupEncounters(candidates: Measured[]): Encounter[] {
  const groups: { anchor: LatLng; lastMs: number; best: Measured }[] = [];
  for (const c of candidates.sort((x, y) => earlierMs(x) - earlierMs(y) || x.m - y.m)) {
    const mid = midpoint(c.a, c.b);
    const group = groups.at(-1);
    if (group && earlierMs(c) - group.lastMs <= MERGE_GAP_MS && haversineM(mid, group.anchor) <= MERGE_RADIUS_M) {
      group.lastMs = earlierMs(c);
      if (c.m < group.best.m) group.best = c;
    } else {
      groups.push({ anchor: mid, lastMs: earlierMs(c), best: c });
    }
  }
  return groups.map(({ best }) => ({
    ...toPair(best),
    id: pairId('E-', best),
    center: midpoint(best.a, best.b),
    uncertain: best.a.uncertain || best.b.uncertain,
  }));
}

function closestMoments(A: readonly PhotoFact[], B: readonly PhotoFact[]): ClosestMoment[] {
  const picks: Measured[] = [];
  while (picks.length < CLOSEST_MAX) {
    let best: Measured | undefined;
    let bestScore = Infinity;
    for (const [a, b] of pairsWithin(A, B, CLOSEST_WINDOW_MS)) {
      if (picks.some((p) => sameScene(p, a, b))) continue;
      const m = haversineM(a, b);
      const score = m / RADIUS_M + gapMs(a, b) / WINDOW_MS;
      if (score < bestScore) {
        bestScore = score;
        best = { a, b, m, gapMs: gapMs(a, b) };
      }
    }
    if (!best) break;
    picks.push(best);
  }
  return picks.map((p) => ({ ...toPair(p), id: pairId('C-', p), center: midpoint(p.a, p.b) }));
}

function sameScene(pick: Measured, a: PhotoFact, b: PhotoFact): boolean {
  if (pick.a.id === a.id || pick.b.id === b.id) return true;
  return (
    Math.abs(pick.a.takenUtcMs - a.takenUtcMs) <= MERGE_GAP_MS &&
    Math.abs(pick.b.takenUtcMs - b.takenUtcMs) <= MERGE_GAP_MS
  );
}

function act1Cards(
  A: readonly PhotoFact[],
  B: readonly PhotoFact[],
  candidates: readonly Measured[],
): Analysis['act1'] {
  const encounterCells = new Set(candidates.map((c) => cellOf(midpoint(c.a, c.b))));
  const bByCell = new Map<CellId, PhotoFact[]>();
  for (const b of B) {
    const inCell = bByCell.get(cellOf(b));
    if (inCell) inCell.push(b);
    else bByCell.set(cellOf(b), [b]);
  }

  const best = new Map<CellId, Measured>();
  for (const a of A) {
    for (const near of neighborCells(cellOf(a))) {
      for (const b of bByCell.get(near) ?? []) {
        if (isSharedPhoto(a, b)) continue;
        const m = haversineM(a, b);
        if (m > SAME_PLACE_M) continue;
        const cell = cellOf(midpoint(a, b));
        if (encounterCells.has(cell)) continue;
        const gap = gapMs(a, b);
        const current = best.get(cell);
        if (!current || gap < current.gapMs || (gap === current.gapMs && m < current.m)) {
          best.set(cell, { a, b, m, gapMs: gap });
        }
      }
    }
  }

  const items = [...best]
    .sort(([xCell, x], [yCell, y]) => x.gapMs - y.gapMs || byText(xCell, yCell))
    .slice(0, ACT1_MAX)
    .map(([cell, p]) => ({
      ...toPair(p),
      cellId: cell,
      center: cellCenter(cell),
      sameDay: localDate(p.a) === localDate(p.b),
    }));
  return { total: best.size, items };
}

function afterMeeting(after: readonly PhotoFact[]): Pick<Analysis, 'heatmap' | 'act3'> {
  const daysByCell = new Map<CellId, Set<string>>();
  const allDays = new Set<string>();
  for (const p of after) {
    const cell = cellOf(p);
    const days = daysByCell.get(cell) ?? new Set<string>();
    days.add(localDate(p));
    daysByCell.set(cell, days);
    allDays.add(localDate(p));
  }

  const counted = [...daysByCell]
    .map(([cell, days]) => ({ cellId: cell, days: days.size }))
    .sort((x, y) => y.days - x.days || byText(x.cellId, y.cellId));
  const maxDays = counted[0]?.days ?? 1;
  const cells = counted.map((c) => ({
    ...c,
    center: cellCenter(c.cellId),
    weight: Math.max(MIN_WEIGHT, c.days / maxDays),
  }));
  return {
    heatmap: { cells, top: cells.slice(0, TOP_MAX) },
    act3: { placeCount: cells.length, dayCount: allDays.size },
  };
}

function* pairsWithin(
  A: readonly PhotoFact[],
  B: readonly PhotoFact[],
  windowMs: number,
): Generator<[PhotoFact, PhotoFact]> {
  for (const a of A) {
    for (let j = firstAtOrAfter(B, a.takenUtcMs - windowMs); j < B.length; j++) {
      const b = B[j];
      if (b.takenUtcMs > a.takenUtcMs + windowMs) break;
      if (!isSharedPhoto(a, b)) yield [a, b];
    }
  }
}

function firstAtOrAfter(sorted: readonly PhotoFact[], ms: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid].takenUtcMs < ms) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function pairId<P extends 'E-' | 'C-'>(prefix: P, { a, b }: Measured): `${P}${string}` {
  const [lo, hi] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
  const hex = createHash('sha1').update(`${lo}:${hi}`).digest('hex');
  return `${prefix}${BigInt(`0x${hex}`).toString(36).slice(0, 6)}`;
}

const isSharedPhoto = (a: PhotoFact, b: PhotoFact) => a.dedupeKey === b.dedupeKey;
const localDate = (p: PhotoFact) => p.takenLocal.slice(0, 10);
const gapMs = (a: PhotoFact, b: PhotoFact) => Math.abs(a.takenUtcMs - b.takenUtcMs);
const earlierMs = (p: Measured) => Math.min(p.a.takenUtcMs, p.b.takenUtcMs);
const byText = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0);

function toPair({ a, b, m, gapMs: gap }: Measured): PhotoPair {
  return { a, b, distanceM: Math.round(m), gapMin: Math.round(gap / MINUTE_MS) };
}
