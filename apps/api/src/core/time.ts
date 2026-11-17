import type { LocalDate, LocalDateTime } from './domain.js';
import { inKorea } from './geo.js';

export const KST_OFFSET_MIN = 540;
const OFFSET_MIN = -720;
const OFFSET_MAX = 840;
const MINUTE = 60_000;
const DAY_MIN = 1440;

export type TimeSource = 'offset' | 'kr_bounds' | 'gps' | 'assumed_kst';

/** A photo's wall-clock time and the zone the server settled on (E11). */
export interface CorrectedTime {
  takenLocal: LocalDateTime;
  /** Local time minus UTC, in minutes. */
  tzOffsetMin: number;
  timeSource: TimeSource;
  uncertain: boolean;
}

/** The raw EXIF strings and position the correction reads. */
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

/** Today's calendar date in Korea. */
export function kstDate(nowMs: number): LocalDate {
  return new Date(nowMs + KST_OFFSET_MIN * MINUTE)
    .toISOString()
    .slice(0, 10) as LocalDate;
}

/**
 * E11 and E12. The zone comes from, in order: OffsetTimeOriginal, the Korea
 * box, the gap to the GPS clock (UTC) rounded to 15 minutes, and finally an
 * assumed KST. The local time itself must be a real calendar instant in
 * 1990..(this UTC year + 1).
 */
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

/** A GPS stamp from the wrong day still names the zone: move the gap by whole days into [-720, 840]. */
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
  /** The wall clock read as if it were UTC. */
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

/** Unparseable GPS fields are not an error; the correction just skips that step. */
function parseGpsUtc(date?: string, time?: string): number | null {
  const d = date && /^(\d{4}):(\d{2}):(\d{2})$/.exec(date);
  const t = time && /^(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/.exec(time);
  if (!d || !t) return null;
  const [y, mo, day] = d.slice(1).map(Number);
  const [h, mi, s] = t.slice(1, 4).map(Number);
  return civilMs(y, mo, day, h, mi, s);
}

/** Null unless every field names a real calendar instant. */
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
