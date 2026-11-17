import type { LocalDate } from './domain.js';

export const KST_OFFSET_MIN = 540;

/** Today's calendar date in Korea. */
export function kstDate(nowMs: number): LocalDate {
  return new Date(nowMs + KST_OFFSET_MIN * 60_000)
    .toISOString()
    .slice(0, 10) as LocalDate;
}
