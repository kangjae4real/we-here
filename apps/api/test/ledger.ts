import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { OPERATIONS, type OperationId } from '../src/contract/index.js';

/** One `operationId status` line per harness call. A file survives vitest's per-file worker isolation. */
export const LEDGER = fileURLToPath(new URL('.ledger', import.meta.url));

/** Teardown fails when a documented (operation, status) pair went unexercised. */
export const REQUIRE_FULL_COVERAGE = true;

/** Documented pairs no test can reach on purpose. */
export const EXEMPT: ReadonlySet<string> = new Set<`${OperationId} ${string}`>(
  [],
);

export function record(op: OperationId, status: number): void {
  appendFileSync(LEDGER, `${op} ${status}\n`);
}

export function coverage(): { documented: string[]; missing: string[] } {
  const seen = new Set(
    existsSync(LEDGER) ? readFileSync(LEDGER, 'utf8').split('\n') : [],
  );
  const documented = Object.entries(OPERATIONS).flatMap(([op, spec]) =>
    Object.keys(spec.responses)
      .filter((status) => status !== 'default')
      .map((status) => `${op} ${status}`),
  );
  const missing = documented.filter((p) => !seen.has(p) && !EXEMPT.has(p));
  return { documented, missing };
}
