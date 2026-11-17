import {
  Ajv2020,
  type ErrorObject,
  type ValidateFunction,
} from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  type FieldIssue,
  type FieldIssueCode,
  InvalidInput,
} from '../core/input.js';
import { CONTRACT_SCHEMA, OPERATIONS } from './openapi.gen.js';
import type { components, operations } from './types.gen.js';

export { OPERATIONS };

export type W<K extends keyof components['schemas']> = components['schemas'][K];
export type ErrorCode = W<'ErrorCode'>;
export type OperationId = keyof operations;
export type JsonBody<Op extends OperationId> = operations[Op] extends {
  requestBody: { content: { 'application/json': infer B } };
}
  ? B
  : never;

export type JsonSchema = { [key: string]: unknown } | boolean;

export interface OperationSpec {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  parameters: {
    name: string;
    in: 'path' | 'query' | 'header';
    required?: boolean;
    schema: JsonSchema;
  }[];
  requestBody: { contentType: string; schema: JsonSchema } | null;
  responses: Record<
    string,
    {
      headers?: Record<string, { schema: JsonSchema }>;
      content: Record<string, { schema: JsonSchema }>;
    }
  >;
}

export const ajv = new Ajv2020({ allErrors: true });
addFormats.default(ajv);
ajv.addSchema(CONTRACT_SCHEMA);

const compiled = new WeakMap<object, ValidateFunction>();

/** One compiled validator per schema object; the schemas come from the generated contract. */
export function validatorFor(schema: JsonSchema): ValidateFunction {
  if (typeof schema === 'boolean') return ajv.compile(schema);
  let fn = compiled.get(schema);
  if (!fn) {
    fn = ajv.compile(schema);
    compiled.set(schema, fn);
  }
  return fn;
}

const ISSUE_CODE: Record<string, FieldIssueCode> = {
  required: 'required',
  type: 'invalid_type',
  minLength: 'too_short',
  minItems: 'too_short',
  maxLength: 'too_long',
  maxItems: 'too_long',
  minimum: 'out_of_range',
  maximum: 'out_of_range',
  additionalProperties: 'unknown_field',
};

export function issuesOf(errors: readonly ErrorObject[]): FieldIssue[] {
  const seen = new Map<string, FieldIssue>();
  for (const e of errors) {
    const path = e.instancePath.split('/').slice(1);
    if (e.keyword === 'required') path.push(e.params.missingProperty);
    if (e.keyword === 'additionalProperties')
      path.push(e.params.additionalProperty);
    const issue: FieldIssue = {
      field: path.join('.') || 'body',
      code: ISSUE_CODE[e.keyword] ?? 'invalid_format',
    };
    seen.set(`${issue.field}:${issue.code}`, issue);
  }
  return [...seen.values()];
}

/** Validates a JSON request body against the operation's YAML schema. */
export function parseJsonBody<Op extends OperationId>(
  op: Op,
  body: unknown,
): JsonBody<Op> {
  const spec: OperationSpec = OPERATIONS[op];
  if (!spec.requestBody) throw new Error(`${op} has no request body`);
  const validate = validatorFor(spec.requestBody.schema);
  if (!validate(body)) throw new InvalidInput(issuesOf(validate.errors ?? []));
  return body as JsonBody<Op>;
}
