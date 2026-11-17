import type { LocalDate } from './domain.js';
import { kstDate } from './time.js';

export type FieldIssueCode =
  | 'required'
  | 'invalid_type'
  | 'invalid_format'
  | 'too_short'
  | 'too_long'
  | 'out_of_range'
  | 'unknown_field'
  | 'control_chars'
  | 'self';

export interface FieldIssue {
  field: string;
  code: FieldIssueCode;
}

/** Rejected input. The HTTP shell turns it into 400 `validation_failed` with `errors`. */
export class InvalidInput extends Error {
  constructor(readonly issues: readonly FieldIssue[]) {
    super(issues.map((i) => `${i.field}:${i.code}`).join(', '));
  }
}

export const MET_ON_MIN = '1990-01-01';

// C0, DEL and C1 control characters.
const CONTROL = /\p{Cc}/u;

/**
 * The rules a JSON schema cannot say. Ajv has already checked type and the raw
 * maxLength, and trimming never lengthens, so only emptiness and control
 * characters remain.
 */
export function cleanText(
  raw: string,
  field: string,
  issues: FieldIssue[],
): string {
  const value = raw.trim();
  if (value.length === 0) issues.push({ field, code: 'too_short' });
  else if (CONTROL.test(value)) issues.push({ field, code: 'control_chars' });
  return value;
}

/** Ajv's `format: date` has already checked the calendar; this adds 1990-01-01..today in KST. */
export function checkMetOn(
  raw: string,
  nowMs: number,
  issues: FieldIssue[],
): LocalDate {
  if (raw < MET_ON_MIN || raw > kstDate(nowMs)) {
    issues.push({ field: 'metOn', code: 'out_of_range' });
  }
  return raw as LocalDate;
}

export function orThrow<T>(value: T, issues: readonly FieldIssue[]): T {
  if (issues.length) throw new InvalidInput(issues);
  return value;
}
