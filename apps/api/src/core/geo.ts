export interface LatLng {
  lat: number;
  lng: number;
}

/** `P-` + geohash precision 7, about 153 m (N-S) by 122 m (E-W) at 37°N. */
export type CellId = `P-${string}`;

const EARTH_RADIUS_M = 6_371_008.8;
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
const LNG_BITS = 18;
const LAT_BITS = 17;
const LNG_CELLS = 2 ** LNG_BITS;
const LAT_CELLS = 2 ** LAT_BITS;

const rad = (deg: number) => (deg * Math.PI) / 180;

export function haversineM(p: LatLng, q: LatLng): number {
  const h =
    Math.sin(rad(q.lat - p.lat) / 2) ** 2 +
    Math.cos(rad(p.lat)) * Math.cos(rad(q.lat)) * Math.sin(rad(q.lng - p.lng) / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Takes the short way around, so two points straddling the date line meet near ±180, not at 0. */
export function midpoint(p: LatLng, q: LatLng): LatLng {
  const dLng = ((q.lng - p.lng + 540) % 360) - 180;
  return { lat: (p.lat + q.lat) / 2, lng: ((p.lng + dLng / 2 + 540) % 360) - 180 };
}

/** E11's box. Inside it a photo is on KST; outside it a place is "해외" and never geocoded. */
export function inKorea(p: LatLng): boolean {
  return p.lat >= 33 && p.lat <= 39 && p.lng >= 124 && p.lng <= 132;
}

/** The geocode cache key: 3 decimals, about 100 m. */
export function labelKey(p: LatLng): string {
  return `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
}

export function cellOf(p: LatLng): CellId {
  return encode(
    Math.min(LNG_CELLS - 1, Math.floor(((p.lng + 180) / 360) * LNG_CELLS)),
    Math.min(LAT_CELLS - 1, Math.floor(((p.lat + 90) / 180) * LAT_CELLS)),
  );
}

export function cellCenter(id: CellId): LatLng {
  const { x, y } = decode(id);
  return { lat: ((y + 0.5) / LAT_CELLS) * 180 - 90, lng: ((x + 0.5) / LNG_CELLS) * 360 - 180 };
}

/** The cell and its eight neighbours (E13). Longitude wraps at the date line; latitude stops at the poles. */
export function neighborCells(id: CellId): CellId[] {
  const { x, y } = decode(id);
  const cells: CellId[] = [];
  for (const dy of [-1, 0, 1]) {
    if (y + dy < 0 || y + dy >= LAT_CELLS) continue;
    for (const dx of [-1, 0, 1]) cells.push(encode((x + dx + LNG_CELLS) % LNG_CELLS, y + dy));
  }
  return cells;
}

function encode(x: number, y: number): CellId {
  let hash = '';
  let chunk = 0;
  for (let i = 0; i < LNG_BITS + LAT_BITS; i++) {
    const bit = i % 2 === 0 ? (x >> (LNG_BITS - 1 - i / 2)) & 1 : (y >> (LAT_BITS - 1 - (i - 1) / 2)) & 1;
    chunk = (chunk << 1) | bit;
    if (i % 5 === 4) {
      hash += BASE32[chunk];
      chunk = 0;
    }
  }
  return `P-${hash}`;
}

function decode(id: CellId): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let i = 0;
  for (const ch of id.slice(2)) {
    const value = BASE32.indexOf(ch);
    for (let b = 4; b >= 0; b--, i++) {
      const bit = (value >> b) & 1;
      if (i % 2 === 0) x = (x << 1) | bit;
      else y = (y << 1) | bit;
    }
  }
  return { x, y };
}
