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
  | 'conflict'
  | 'self'
  | 'not_found';

export interface FieldIssue {
  field: string;
  code: FieldIssueCode;
}

export class InvalidInput extends Error {
  constructor(readonly issues: readonly FieldIssue[]) {
    super(issues.map((i) => `${i.field}:${i.code}`).join(', '));
  }
}

export const MET_ON_MIN = '1990-01-01';

const CONTROL = /\p{Cc}/u;

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
