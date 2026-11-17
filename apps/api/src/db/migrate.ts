import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export const MIGRATIONS_DIR = fileURLToPath(
  new URL('../../migrations/', import.meta.url),
);

const LOCK_KEY = 0x7765686572;

export async function migrate(
  databaseUrl: string,
  dir = MIGRATIONS_DIR,
): Promise<string[]> {
  const files = (await readdir(dir)).filter((f) => /^\d{4}_.*\.sql$/.test(f));
  files.sort();
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const done = new Set(
      (
        await client.query<{ name: string }>(
          'SELECT name FROM schema_migrations',
        )
      ).rows.map((r) => r.name),
    );
    const applied: string[] = [];
    for (const file of files.filter((f) => !done.has(f))) {
      const sql = await readFile(`${dir}/${file}`, 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [
          file,
        ]);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed`, { cause: e });
      }
      applied.push(file);
    }
    return applied;
  } finally {
    await client.end();
  }
}
