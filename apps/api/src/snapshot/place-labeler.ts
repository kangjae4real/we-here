import { inKorea, type LatLng, labelKey } from '../core/geo.js';
import type { Labels } from '../core/snapshot.js';
import type { Sql } from '../db/db.js';
import type { ReverseGeocoder } from './geocoders.js';

export interface LabelCache {
  read(keys: readonly string[]): Promise<Map<string, string>>;
  write(entries: ReadonlyMap<string, string>): Promise<void>;
}

export function sqlLabelCache(q: Sql): LabelCache {
  return {
    async read(keys) {
      const rows = await q.rows<{ key: string; label: string }>(
        'SELECT key, label FROM geocode_cache WHERE key = ANY($1)',
        [keys],
      );
      return new Map(rows.map((r) => [r.key, r.label]));
    },
    async write(entries) {
      await q.exec(
        `INSERT INTO geocode_cache (key, label)
         SELECT * FROM unnest($1::text[], $2::text[])
         ON CONFLICT (key) DO UPDATE SET label = excluded.label, fetched_at = now()`,
        [[...entries.keys()], [...entries.values()]],
      );
    },
  };
}

export interface LabelBudget {
  concurrency: number;
  totalMs: number;
}

export const LABEL_BUDGET: LabelBudget = { concurrency: 4, totalMs: 3000 };

export class PlaceLabeler {
  constructor(
    private readonly geocoder: ReverseGeocoder,
    private readonly cache: LabelCache,
    private readonly budget: LabelBudget = LABEL_BUDGET,
  ) {}

  async label(
    live: readonly LatLng[],
    cachedOnly: readonly LatLng[],
  ): Promise<Labels> {
    const keys = new Set(
      [...live, ...cachedOnly].filter(inKorea).map(labelKey),
    );
    const cached = await this.cache.read([...keys]);
    const misses = new Map<string, LatLng>();
    for (const p of live) {
      const key = labelKey(p);
      if (inKorea(p) && !cached.has(key)) misses.set(key, p);
    }
    const found = await this.lookUp([...misses]);
    if (found.size) {
      await this.cache.write(found).catch(() => {});
    }
    return new Map([...cached, ...found]);
  }

  private async lookUp(
    queue: [string, LatLng][],
  ): Promise<Map<string, string>> {
    const found = new Map<string, string>();
    if (!queue.length) return found;
    const ctl = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<void>((resolve) => {
      timer = setTimeout(() => {
        ctl.abort();
        resolve();
      }, this.budget.totalMs);
    });
    const worker = async () => {
      for (let next = queue.shift(); next && !ctl.signal.aborted; next = queue.shift()) {
        const [key, p] = next;
        try {
          const name = await this.geocoder.reverse(p, ctl.signal);
          if (name && !ctl.signal.aborted) found.set(key, name);
        } catch {}
      }
    };
    const workers = Array.from(
      { length: Math.min(this.budget.concurrency, queue.length) },
      worker,
    );
    await Promise.race([Promise.all(workers), deadline]);
    clearTimeout(timer);
    ctl.abort();
    return found;
  }
}
