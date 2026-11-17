import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ErrorCode } from '../contract/index.js';
import { type FieldIssue, InvalidInput } from '../core/input.js';

export const PROBLEMS = {
  invalid_token: { status: 401, title: 'Invalid participant token' },
  room_not_found: { status: 404, title: 'Room not found' },
  room_expired: { status: 404, title: 'Room expired' },
  room_full: { status: 409, title: 'Room is full' },
  invite_invalid: { status: 403, title: 'Invite is no longer valid' },
  not_owner: { status: 403, title: 'Not your photo' },
  thumb_signature_invalid: { status: 403, title: 'Bad thumbnail signature' },
  thumb_signature_expired: { status: 403, title: 'Thumbnail link expired' },
  photo_not_found: { status: 404, title: 'Photo not found' },
  participant_not_found: { status: 404, title: 'Participant not found' },
  validation_failed: { status: 400, title: 'Validation failed' },
  batch_too_large: { status: 413, title: 'Batch too large' },
  room_chat_quota_exceeded: { status: 429, title: 'Room chat quota exceeded' },
  global_chat_quota_exceeded: {
    status: 429,
    title: 'Daily chat quota exceeded',
  },
  rate_limited: { status: 429, title: 'Too many requests' },
  ai_consent_required: {
    status: 403,
    title: 'Both participants must allow AI',
  },
  chat_busy: { status: 409, title: 'Another answer is in progress' },
  upstream_rate_limited: { status: 429, title: 'AI provider is busy' },
  upstream_timeout: { status: 504, title: 'AI provider timed out' },
  upstream_error: { status: 502, title: 'AI provider failed' },
  server_misconfigured: { status: 503, title: 'Server misconfigured' },
  internal_error: { status: 500, title: 'Internal error' },
} as const satisfies Record<ErrorCode, { status: number; title: string }>;

export interface ProblemOptions {
  /** Overrides the code's usual status (health uses 503, unknown routes 404). */
  status?: number;
  detail?: string;
  errors?: readonly FieldIssue[];
  headers?: Record<string, string>;
  /** Extra top-level members the contract adds to this problem, e.g. `resetAt` or `checks`. */
  members?: Record<string, unknown>;
}

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly options: ProblemOptions = {},
  ) {
    super(options.detail ?? code);
  }
}

/** Maps anything thrown while serving a request to the problem it becomes. Unknown errors become 500. */
export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (e instanceof InvalidInput) {
    return new ApiError('validation_failed', { errors: e.issues });
  }
  const status = clientErrorStatus(e);
  if (status === 404) {
    return new ApiError('validation_failed', {
      status: 404,
      detail: 'No such route',
    });
  }
  if (status !== undefined) {
    return new ApiError('validation_failed', {
      detail: 'Malformed request',
      errors: [{ field: 'body', code: 'invalid_format' }],
    });
  }
  return new ApiError('internal_error');
}

/** 4xx raised below our handlers: Nest routing, Nest's mapping of body-parser and URI errors, raw body-parser errors. */
function clientErrorStatus(e: unknown): number | undefined {
  const status =
    e instanceof HttpException
      ? e.getStatus()
      : (e as { status?: unknown } | null)?.status;
  return typeof status === 'number' && status >= 400 && status < 500
    ? status
    : undefined;
}

export function sendProblem(res: Response, error: ApiError): void {
  const { status = PROBLEMS[error.code].status, ...o } = error.options;
  const requestId = String(res.locals.requestId);
  for (const [name, value] of Object.entries(o.headers ?? {})) {
    res.setHeader(name, value);
  }
  res
    .status(status)
    .type('application/problem+json')
    .send(
      JSON.stringify({
        type: `https://we-here.app/problems/${error.code}`,
        title: PROBLEMS[error.code].title,
        status,
        code: error.code,
        requestId,
        ...(o.detail === undefined ? {} : { detail: o.detail }),
        ...(o.errors ? { errors: o.errors } : {}),
        ...o.members,
      }),
    );
}

/** The only error writer. Once a stream has started, it can only end the response. */
@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger('Problem');

  catch(e: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const error = toApiError(e);
    if (error.code === 'internal_error' && !(e instanceof ApiError)) {
      this.logger.error(
        `requestId=${String(res.locals.requestId)}`,
        e instanceof Error ? e.stack : String(e),
      );
    }
    if (res.headersSent) {
      res.end();
      return;
    }
    sendProblem(res, error);
  }
}
