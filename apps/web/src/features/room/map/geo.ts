import type { MapInset, MapScene } from "../contract";
import type { LatLng, Room, Who } from "../mock";

/** World units: Web Mercator pixels at zoom 16 (256px tiles), same as Naver's point × 2^16. */
export type XY = { x: number; y: number };
/** Camera: world point at the screen center, and screen px per world unit. */
export type View = { c: XY; k: number };

const SPAN = 256 * 2 ** 16;

export function toWorld({ lat, lng }: LatLng): XY {
  const s = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * SPAN,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * SPAN,
  };
}

export function fromWorld({ x, y }: XY): LatLng {
  return {
    lat: (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / SPAN))) * 180) / Math.PI,
    lng: (x / SPAN) * 360 - 180,
  };
}

export const ORIGIN_LL = { lat: 37.55, lng: 126.99 };
/** Overlay coordinates are relative to this point so CSS calc() stays in a precise float range. */
export const ORIGIN = toWorld(ORIGIN_LL);
export const rel = (p: LatLng): XY => {
  const w = toWorld(p);
  return { x: w.x - ORIGIN.x, y: w.y - ORIGIN.y };
};

export const unitsPerMeter = (lat: number) =>
  SPAN / (40_075_016.686 * Math.cos((lat * Math.PI) / 180));

// Overlay elements are placed through CSS variables the camera driver updates every
// frame (--ox/--oy: screen px of ORIGIN, --k: px per world unit), so moving the map
// never re-renders React.
/** Draws children in world units. */
export const WORLD = {
  transform:
    "translate(calc(var(--ox) * 1px), calc(var(--oy) * 1px)) scale(var(--k))",
};
/** Pins a constant-size (px) group to a world point. */
export const pin = ({ x, y }: XY) => ({
  transform: `translate(calc((var(--ox) + var(--k) * ${x}) * 1px), calc((var(--oy) + var(--k) * ${y}) * 1px))`,
});

/** Sets the CSS variables every overlay transform reads: px of ORIGIN and px per world unit. */
export function setVars(el: Element, ox: number, oy: number, k: number) {
  const s = (el as SVGElement).style;
  s.setProperty("--ox", String(ox));
  s.setProperty("--oy", String(oy));
  s.setProperty("--k", String(k));
}

/** Zoom bucket for clustering, so groups only change when the zoom crosses a whole level. */
export const quantize = (k: number) => 2 ** Math.round(Math.log2(k));

const PAD = 40;

/** Where the camera should be for this scene, centered in the part of the map the floating UI leaves free. */
export function frame(
  room: Room,
  scene: MapScene,
  inset: MapInset,
  w: number,
  h: number,
  /** Rounds the scale to what the map can show (the raster fallback has whole zoom levels only). */
  snap: (k: number) => number = (k) => k,
): View & { cramped: boolean } {
  let { top, right, bottom, left } = inset;
  // A full-height sheet leaves no map to frame into: callers keep the camera where it
  // is (the whole screen is only used for the very first placement).
  const cramped = w - left - right < 40 || h - top - bottom < 40;
  if (cramped) top = right = bottom = left = 0;
  const fw = w - left - right;
  const fh = h - top - bottom;
  const mobile = w < 768;

  let c: XY;
  let k: number;
  const m = scene.moment && room.moments[scene.moment.index];
  if (scene.moment && m) {
    const a = toWorld(m.a);
    const b = toWorld(m.b);
    c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    // Same on-screen size whatever the real distance (design: 21 units × z 3.2, ×.72 under the card, 4.4 on desktop).
    const px = mobile ? (scene.moment.phase === "on" ? 48 : 67) : 92;
    k = px / Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1);
    // ...unless a trail would start off screen while it is being drawn (07c may crop them).
    if (scene.moment.phase !== "on")
      for (const f of [toWorld(m.a.from), toWorld(m.b.from)])
        k = Math.min(
          k,
          (fw / 2 - 16) / Math.abs(f.x - c.x),
          (fh / 2 - 16) / Math.abs(f.y - c.y),
        );
  } else if (scene.focus) {
    c = toWorld(scene.focus);
    // A neighborhood across the free area, so the top heat blob reads like 08.
    k =
      Math.min(fw, fh) /
      ((mobile ? 2000 : 2750) * unitsPerMeter(scene.focus.lat));
  } else {
    const pts = room.points
      .filter((p) => scene.dots === "all" || p.who === "a")
      .map(toWorld);
    if (scene.dots === "none" || pts.length === 0) {
      c = ORIGIN;
      k = 2 ** (mobile ? -4.6 : -3.4);
    } else {
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const [x0, x1, y0, y1] = [
        Math.min(...xs),
        Math.max(...xs),
        Math.min(...ys),
        Math.max(...ys),
      ];
      c = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
      // A thin free strip (40–80px, e.g. 568×300 with the mid sheet) shrinks the padding so the scale stays positive.
      const pad = Math.min(PAD, fw / 4, fh / 4);
      k = Math.min(
        (fw - 2 * pad) / Math.max(x1 - x0, 1),
        (fh - 2 * pad) / Math.max(y1 - y0, 1),
        0.5,
      );
    }
  }
  k = snap(k);
  return {
    c: {
      x: c.x - (left + fw / 2 - w / 2) / k,
      y: c.y - (top + fh / 2 - h / 2) / k,
    },
    k,
    cramped,
  };
}

export type Dot = XY & { id: string; who: Who };
export type Group = { id: string; who: Who; p: XY; members: Dot[] };

/** Greedy screen-space clustering: same-person dots within a mark's radius of a group's first dot join it. */
export function groupDots(dots: Dot[], k: number): Group[] {
  const r = 9 / k;
  const groups: (Group & { seed: Dot })[] = [];
  for (const d of dots) {
    const g = groups.find(
      (g) => g.who === d.who && Math.hypot(g.seed.x - d.x, g.seed.y - d.y) < r,
    );
    if (g) g.members.push(d);
    else groups.push({ id: d.id, who: d.who, p: d, seed: d, members: [d] });
  }
  for (const g of groups) {
    g.p = {
      x: g.members.reduce((s, d) => s + d.x, 0) / g.members.length,
      y: g.members.reduce((s, d) => s + d.y, 0) / g.members.length,
    };
  }
  return groups;
}

/** The A dot with the most A neighbors within ~800 m: where B would most plausibly show up. */
export function densest(dots: Dot[]): XY {
  const r = 800 * unitsPerMeter(ORIGIN_LL.lat);
  let best: XY = { x: 0, y: 0 };
  let most = -1;
  for (const d of dots) {
    const n = dots.filter((o) => Math.hypot(o.x - d.x, o.y - d.y) < r).length;
    if (n > most) [best, most] = [d, n];
  }
  return best;
}
