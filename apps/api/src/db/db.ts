import type { OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';

export interface Sql {
  rows<R>(text: string, params?: readonly unknown[]): Promise<R[]>;
  one<R>(text: string, params?: readonly unknown[]): Promise<R | undefined>;
  /** Returns the affected row count. */
  exec(text: string, params?: readonly unknown[]): Promise<number>;
}

export type Isolation = 'read committed' | 'repeatable read';

const INT8 = 20;
const NUMERIC = 1700;
const DATE = 1082;
const TIMESTAMP = 1114;

/** Dates and wall-clock timestamps stay strings so no timezone ever shifts them. */
const types = {
  getTypeParser(oid: number, format?: string) {
    switch (oid) {
      case INT8:
      case NUMERIC:
        return Number;
      case DATE:
        return (s: string) => s;
      case TIMESTAMP:
        return (s: string) => s.replace(' ', 'T');
      default:
        return pg.types.getTypeParser(oid, format as 'text');
    }
  },
};

function sqlOf(client: pg.Pool | pg.PoolClient): Sql {
  return {
    async rows<R>(text: string, params?: readonly unknown[]) {
      return (await client.query(text, params as unknown[])).rows as R[];
    },
    async one<R>(text: string, params?: readonly unknown[]) {
      return (await client.query(text, params as unknown[])).rows[0] as
        R | undefined;
    },
    async exec(text: string, params?: readonly unknown[]) {
      return (await client.query(text, params as unknown[])).rowCount ?? 0;
    },
  };
}

export class Db implements OnModuleDestroy {
  private readonly pool: pg.Pool;
  /** Autocommit queries outside any transaction. */
  readonly q: Sql;

  constructor(url: string) {
    this.pool = new pg.Pool({
      connectionString: url,
      connectionTimeoutMillis: 3000,
      types,
    });
    // An idle client dying (DB restart) must not crash the process; the next query reconnects.
    this.pool.on('error', () => {});
    this.q = sqlOf(this.pool);
  }

  async tx<T>(isolation: Isolation, fn: (q: Sql) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    let broken: Error | undefined;
    try {
      await client.query(`BEGIN ISOLATION LEVEL ${isolation}`);
      const result = await fn(sqlOf(client));
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK').catch((rollbackError: Error) => {
        broken = rollbackError;
      });
      throw e;
    } finally {
      client.release(broken);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
