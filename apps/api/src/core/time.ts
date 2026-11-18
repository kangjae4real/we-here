import type { LocalDate, LocalDateTime } from './domain.js';
import { inKorea } from './geo.js';

export const KST_OFFSET_MIN = 540;
const OFFSET_MIN = -720;
const OFFSET_MAX = 840;
const MINUTE = 60_000;
const DAY_MIN = 1440;

export type TimeSource = 'offset' | 'kr_bounds' | 'gps' | 'assumed_kst';

export interface CorrectedTime {
  takenLocal: LocalDateTime;
  tzOffsetMin: number;
  timeSource: TimeSource;
  uncertain: boolean;
}

export interface ExifClock {
  dateTimeOriginal: string;
  offsetTimeOriginal?: string;
  gpsDateStamp?: string;
  gpsTimeStamp?: string;
  lat: number;
  lng: number;
}

export type TimeResult =
  | { ok: true; time: CorrectedTime }
  | { ok: false; field: 'dateTimeOriginal' | 'offsetTimeOriginal' };

export function kstDate(nowMs: number): LocalDate {
  return new Date(nowMs + KST_OFFSET_MIN * MINUTE)
    .toISOString()
    .slice(0, 10) as LocalDate;
}

export function nextKstMidnightMs(nowMs: number): number {
  const day = 86_400_000;
  const offset = KST_OFFSET_MIN * MINUTE;
  return Math.floor((nowMs + offset) / day) * day + day - offset;
}

export function correctTime(m: ExifClock, nowMs: number): TimeResult {
  const local = parseExifDateTime(m.dateTimeOriginal);
  const maxYear = new Date(nowMs).getUTCFullYear() + 1;
  if (!local || local.year < 1990 || local.year > maxYear) {
    return { ok: false, field: 'dateTimeOriginal' };
  }
  const takenLocal = local.text as LocalDateTime;
  const at = (
    tzOffsetMin: number,
    timeSource: TimeSource,
    uncertain: boolean,
  ): TimeResult => ({
    ok: true,
    time: { takenLocal, tzOffsetMin, timeSource, uncertain },
  });

  if (m.offsetTimeOriginal !== undefined) {
    const offset = parseOffset(m.offsetTimeOriginal);
    if (offset === null) return { ok: false, field: 'offsetTimeOriginal' };
    return at(offset, 'offset', false);
  }
  if (inKorea(m)) return at(KST_OFFSET_MIN, 'kr_bounds', false);

  const gpsMs = parseGpsUtc(m.gpsDateStamp, m.gpsTimeStamp);
  if (gpsMs !== null) {
    const gapMin = wrapIntoOffsetRange((local.asUtcMs - gpsMs) / MINUTE);
    const offset = Math.round(gapMin / 15) * 15;
    return at(offset, 'gps', Math.abs(gapMin - offset) > 5);
  }
  return at(KST_OFFSET_MIN, 'assumed_kst', true);
}

function wrapIntoOffsetRange(gapMin: number): number {
  if (gapMin > OFFSET_MAX) {
    return gapMin - Math.ceil((gapMin - OFFSET_MAX) / DAY_MIN) * DAY_MIN;
  }
  if (gapMin < OFFSET_MIN) {
    return gapMin + Math.ceil((OFFSET_MIN - gapMin) / DAY_MIN) * DAY_MIN;
  }
  return gapMin;
}

interface CivilTime {
  year: number;
  text: string;
  asUtcMs: number;
}

function parseExifDateTime(raw: string): CivilTime | null {
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(raw);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
  const asUtcMs = civilMs(y, mo, d, h, mi, s);
  if (asUtcMs === null) return null;
  return {
    year: y,
    text: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`,
    asUtcMs,
  };
}

function parseOffset(raw: string): number | null {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(raw);
  if (!m) return null;
  const minutes = Number(m[2]) * 60 + Number(m[3]);
  const offset = m[1] === '-' ? -minutes : minutes;
  const valid =
    Number(m[3]) < 60 && offset >= OFFSET_MIN && offset <= OFFSET_MAX;
  return valid ? offset : null;
}

function parseGpsUtc(date?: string, time?: string): number | null {
  const d = date && /^(\d{4}):(\d{2}):(\d{2})$/.exec(date);
  const t = time && /^(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/.exec(time);
  if (!d || !t) return null;
  const [y, mo, day] = d.slice(1).map(Number);
  const [h, mi, s] = t.slice(1, 4).map(Number);
  return civilMs(y, mo, day, h, mi, s);
}

function civilMs(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  s: number,
): number | null {
  if (h > 23 || mi > 59 || s > 59) return null;
  const ms = Date.UTC(y, mo - 1, d, h, mi, s);
  const back = new Date(ms);
  const same =
    back.getUTCFullYear() === y &&
    back.getUTCMonth() === mo - 1 &&
    back.getUTCDate() === d;
  return same ? ms : null;
}
