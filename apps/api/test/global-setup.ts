import { rmSync } from 'node:fs';
import pg from 'pg';
import { migrate } from '../src/db/migrate.js';
import { TEST_DATABASE_URL } from './env.js';
import { coverage, LEDGER, REQUIRE_FULL_COVERAGE } from './ledger.js';

export default async function setup() {
  const url = new URL(TEST_DATABASE_URL);
  const name = url.pathname.slice(1);
  const admin = new pg.Client({
    connectionString: Object.assign(new URL(url), { pathname: '/postgres' })
      .href,
  });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }
  await migrate(TEST_DATABASE_URL);
  rmSync(LEDGER, { force: true });

  return () => {
    const { documented, missing } = coverage();
    console.log(
      `Contract coverage: ${documented.length - missing.length}/${documented.length} (operation, status) pairs`,
    );
    if (missing.length) console.log(`Not exercised: ${missing.join(', ')}`);
    if (REQUIRE_FULL_COVERAGE && missing.length) {
      throw new Error(
        `Contract coverage gate: ${missing.length} pairs missing`,
      );
    }
  };
}
