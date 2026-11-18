import type { LatLng } from '../core/geo.js';
import { labelKey } from '../core/geo.js';
import type { ReverseGeocoder } from './geocoders.js';
import { type LabelCache, PlaceLabeler } from './place-labeler.js';

const SEOUL: LatLng = { lat: 37.5446, lng: 127.0557 };
const TOKYO: LatLng = { lat: 35.6812, lng: 139.7671 };
const at = (i: number): LatLng => ({ lat: 37.5 + i * 0.01, lng: 127 });

function memoryCache(initial: [string, string][] = []) {
  const store = new Map(initial);
  const writes: string[][] = [];
  const cache: LabelCache = {
    read: async (keys) =>
      new Map(keys.flatMap((k) => (store.has(k) ? [[k, store.get(k)!]] : []))),
    write: async (entries) => {
      writes.push([...entries.keys()]);
      for (const [k, v] of entries) store.set(k, v);
    },
  };
  return { cache, store, writes };
}

function recorder(answer: (p: LatLng) => Promise<string | null>) {
  const asked: string[] = [];
  let inFlight = 0;
  let peak = 0;
  const geocoder: ReverseGeocoder = {
    async reverse(p) {
      asked.push(labelKey(p));
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      try {
        return await answer(p);
      } finally {
        inFlight -= 1;
      }
    },
  };
  return { geocoder, asked, peak: () => peak };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('PlaceLabeler', () => {
  it('looks up live misses once each, caches the names and returns them', async () => {
    const { cache, store } = memoryCache();
    const g = recorder(async (p) => `동 ${labelKey(p)}`);
    const labels = await new PlaceLabeler(g.geocoder, cache).label([SEOUL, SEOUL], []);
    expect(g.asked).toEqual([labelKey(SEOUL)]);
    expect(labels.get(labelKey(SEOUL))).toBe(`동 ${labelKey(SEOUL)}`);
    expect(store.get(labelKey(SEOUL))).toBe(`동 ${labelKey(SEOUL)}`);
  });

  it('reads cached-only points from the cache and never looks them up', async () => {
    const { cache } = memoryCache([[labelKey(at(1)), '성수동']]);
    const g = recorder(async () => 'x');
    const labels = await new PlaceLabeler(g.geocoder, cache).label([], [at(1), at(2)]);
    expect(g.asked).toEqual([]);
    expect([...labels]).toEqual([[labelKey(at(1)), '성수동']]);
  });

  it('skips points outside Korea', async () => {
    const g = recorder(async () => 'x');
    const labels = await new PlaceLabeler(g.geocoder, memoryCache().cache).label([TOKYO], []);
    expect(g.asked).toEqual([]);
    expect(labels.size).toBe(0);
  });

  it('runs at most 4 lookups at once', async () => {
    const g = recorder(async () => {
      await sleep(5);
      return 'x';
    });
    const points = Array.from({ length: 10 }, (_, i) => at(i));
    const labels = await new PlaceLabeler(g.geocoder, memoryCache().cache).label(points, []);
    expect(labels.size).toBe(10);
    expect(g.peak()).toBe(4);
  });

  it('does not cache failures or nulls', async () => {
    const { cache, writes } = memoryCache();
    const g = recorder(async (p) => {
      if (p.lat === at(0).lat) throw new Error('503');
      return p.lat === at(1).lat ? null : '동';
    });
    const labels = await new PlaceLabeler(g.geocoder, cache).label([at(0), at(1), at(2)], []);
    expect([...labels.keys()]).toEqual([labelKey(at(2))]);
    expect(writes).toEqual([[labelKey(at(2))]]);
  });

  it('answers within the total budget, leaving slow names null and aborting them', async () => {
    let aborted = 0;
    const geocoder: ReverseGeocoder = {
      reverse: (p, signal) =>
        p.lat === at(0).lat
          ? Promise.resolve('빠른동')
          : new Promise((_, reject) =>
              signal.addEventListener('abort', () => {
                aborted += 1;
                reject(new Error('aborted'));
              }),
            ),
    };
    const started = Date.now();
    const labels = await new PlaceLabeler(geocoder, memoryCache().cache, {
      concurrency: 4,
      totalMs: 50,
    }).label([at(0), at(1), at(2)], []);
    expect(Date.now() - started).toBeLessThan(1000);
    expect([...labels.values()]).toEqual(['빠른동']);
    expect(aborted).toBe(2);
  });
});
