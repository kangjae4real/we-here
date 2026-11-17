import type { AddressInfo } from 'node:net';
import pg from 'pg';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
import {
  OPERATIONS,
  type OperationId,
  type OperationSpec,
  validatorFor,
} from '../src/contract/index.js';
import { TEST_DATABASE_URL, TEST_ENV } from './env.js';
import { record } from './ledger.js';

export interface CallRequest {
  params?: Record<string, string>;
  query?: Record<string, string | number>;
  token?: string;
  headers?: Record<string, string>;
  json?: unknown;
  /** Raw body for malformed input and multipart. */
  body?: string | FormData;
}

export interface CallResult {
  status: number;
  headers: Headers;
  body: any;
}

export interface Api {
  /** Calls one contract operation and fails the test unless the response matches the YAML exactly. */
  call(op: OperationId, req?: CallRequest): Promise<CallResult>;
  /** Off-contract request (unknown routes); only the global headers are checked. */
  raw(method: string, path: string, init?: RequestInit): Promise<CallResult>;
  sql<R = any>(text: string, params?: unknown[]): Promise<R[]>;
  readonly baseUrl: string;
  close(): Promise<void>;
}

const JSON_MEDIA = new Set(['application/json', 'application/problem+json']);

export async function startApi(
  o: { env?: Record<string, string> } = {},
): Promise<Api> {
  const parsed = readConfig({ ...TEST_ENV, ...o.env });
  if (!parsed.ok) throw new Error(parsed.problems.join('; '));
  const app = await createApp(parsed.config, ['error']);
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL });

  async function call(op: OperationId, req: CallRequest = {}) {
    const spec: OperationSpec = OPERATIONS[op];
    const path = spec.path.replace(/\{(\w+)\}/g, (_, name: string) => {
      const value = req.params?.[name];
      if (value === undefined) throw new Error(`${op}: missing param ${name}`);
      return encodeURIComponent(value);
    });
    const url = new URL(path, baseUrl);
    for (const [k, v] of Object.entries(req.query ?? {})) {
      url.searchParams.set(k, String(v));
    }
    const headers = new Headers(req.headers);
    if (req.token !== undefined) headers.set('X-Participant-Token', req.token);
    let body = req.body;
    if (req.json !== undefined) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(req.json);
    } else if (typeof body === 'string') {
      headers.set('Content-Type', 'application/json');
    }
    const res = await fetch(url, {
      method: spec.method.toUpperCase(),
      headers,
      body,
    });
    const result = await read(res);
    checkGlobalHeaders(op, result);
    checkAgainstContract(op, spec, result);
    record(op, result.status);
    return result;
  }

  async function raw(method: string, path: string, init: RequestInit = {}) {
    const result = await read(
      await fetch(new URL(path, baseUrl), { ...init, method }),
    );
    checkGlobalHeaders(`${method} ${path}`, result);
    return result;
  }

  return {
    call,
    raw,
    baseUrl,
    async sql(text, params) {
      return (await pool.query(text, params)).rows;
    },
    async close() {
      await app.close();
      await pool.end();
    },
  };
}

function mediaOf(headers: Headers): string {
  return (headers.get('content-type') ?? '').split(';')[0].trim();
}

async function read(res: Response): Promise<CallResult> {
  const media = mediaOf(res.headers);
  const body = JSON_MEDIA.has(media)
    ? await res.json()
    : media.startsWith('image/')
      ? new Uint8Array(await res.arrayBuffer())
      : await res.text();
  return { status: res.status, headers: res.headers, body };
}

function checkGlobalHeaders(label: string, r: CallResult): void {
  const fail = (msg: string) => {
    throw new Error(`${label} ${r.status}: ${msg}`);
  };
  const requestId = r.headers.get('x-request-id');
  if (!requestId) fail('missing x-request-id');
  if (r.headers.get('x-content-type-options') !== 'nosniff') {
    fail('missing X-Content-Type-Options: nosniff');
  }
  const media = mediaOf(r.headers);
  if (JSON_MEDIA.has(media) || media === 'application/x-ndjson') {
    if (r.headers.get('cache-control') !== 'no-store') {
      fail(`Cache-Control is ${r.headers.get('cache-control')}, not no-store`);
    }
  }
  if (media === 'application/problem+json' && r.body.requestId !== requestId) {
    fail(`problem requestId ${r.body.requestId} != header ${requestId}`);
  }
}

function checkAgainstContract(
  op: OperationId,
  spec: OperationSpec,
  r: CallResult,
): void {
  const fail = (msg: string) => {
    throw new Error(
      `${op} ${r.status} breaks the contract: ${msg}\n${JSON.stringify(r.body)}`,
    );
  };
  const response =
    spec.responses[String(r.status)] ??
    (r.status >= 500 ? spec.responses.default : undefined);
  if (!response) return fail('status is not documented');

  const media = mediaOf(r.headers);
  const content = response.content[media];
  if (!content) return fail(`content-type ${media} is not documented`);
  if (JSON_MEDIA.has(media)) {
    const validate = validatorFor(content.schema);
    if (!validate(r.body)) fail(JSON.stringify(validate.errors));
  }

  for (const [name, header] of Object.entries(response.headers ?? {})) {
    const value = r.headers.get(name);
    if (value === null) fail(`missing documented header ${name}`);
    const typed = /^\d+$/.test(value!) ? Number(value) : value;
    const validate = validatorFor(header.schema);
    if (!validate(typed)) fail(`header ${name}=${value} does not match`);
  }
}
