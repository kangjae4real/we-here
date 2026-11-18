import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { OPERATIONS, type OperationId } from '../src/contract/index.js';

export const LEDGER = fileURLToPath(new URL('.ledger', import.meta.url));

export const REQUIRE_FULL_COVERAGE = true;

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
