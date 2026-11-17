export type FieldIssueCode =
  | 'required'
  | 'invalid_type'
  | 'invalid_format'
  | 'too_short'
  | 'too_long'
  | 'out_of_range'
  | 'unknown_field';

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
