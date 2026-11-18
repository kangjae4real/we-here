import { cellCenter, cellOf, haversineM, inKorea, midpoint, neighborCells } from './geo.js';

const EARTH_RADIUS_M = 6_371_008.8;
const M_PER_DEG = (EARTH_RADIUS_M * Math.PI) / 180;

describe('haversineM', () => {
  it('measures a quarter meridian as a quarter of the mean-radius circle', () => {
    expect(haversineM({ lat: 0, lng: 0 }, { lat: 90, lng: 0 })).toBeCloseTo((EARTH_RADIUS_M * Math.PI) / 2, 0);
  });

  it('separates 249 m from 251 m', () => {
    const seoul = { lat: 37.5563, lng: 126.9236 };
    expect(Math.round(haversineM(seoul, { lat: seoul.lat + 249 / M_PER_DEG, lng: seoul.lng }))).toBe(249);
    expect(Math.round(haversineM(seoul, { lat: seoul.lat + 251 / M_PER_DEG, lng: seoul.lng }))).toBe(251);
  });

  it('takes the short way across the date line', () => {
    expect(haversineM({ lat: 0, lng: 179.9995 }, { lat: 0, lng: -179.9995 })).toBeCloseTo(0.001 * M_PER_DEG, 3);
  });
});

describe('midpoint', () => {
  it('lands near ±180 for points on both sides of the date line', () => {
    const mid = midpoint({ lat: 0, lng: 179.9995 }, { lat: 0, lng: -179.9995 });
    expect(Math.abs(mid.lng)).toBeCloseTo(180, 6);
  });
});

describe('cellOf', () => {
  it('is the standard 7-character geohash behind P-', () => {
    expect(cellOf({ lat: 57.64911, lng: 10.40744 })).toBe('P-u4pruyd');
    expect(cellOf({ lat: 37.5563, lng: 126.9236 })).toMatch(/^P-[a-z0-9]{7}$/);
  });
});

describe('cellCenter', () => {
  it('lies inside its own cell, within half a cell diagonal of any point in it', () => {
    const p = { lat: 37.5563, lng: 126.9236 };
    const center = cellCenter(cellOf(p));
    expect(cellOf(center)).toBe(cellOf(p));
    expect(haversineM(p, center)).toBeLessThan(100);
  });
});

describe('neighborCells', () => {
  it('returns the cell and its eight neighbours', () => {
    const cell = cellOf({ lat: 37.5563, lng: 126.9236 });
    const cells = neighborCells(cell);
    expect(new Set(cells).size).toBe(9);
    expect(cells).toContain(cell);
    expect(cells).toContain(cellOf({ lat: 37.5563 + 150 / M_PER_DEG, lng: 126.9236 }));
  });

  it('wraps longitude at the date line', () => {
    expect(neighborCells(cellOf({ lat: 0.0001, lng: 179.9999 }))).toContain(cellOf({ lat: 0.0001, lng: -179.9999 }));
  });
});

describe('inKorea', () => {
  it('accepts the E11 box, edges included, and rejects points outside it', () => {
    expect(inKorea({ lat: 37.5563, lng: 126.9236 })).toBe(true);
    expect(inKorea({ lat: 33, lng: 124 })).toBe(true);
    expect(inKorea({ lat: 39, lng: 132 })).toBe(true);
    expect(inKorea({ lat: 35.6812, lng: 139.7671 })).toBe(false);
    expect(inKorea({ lat: 32.99, lng: 126.5 })).toBe(false);
  });
});
