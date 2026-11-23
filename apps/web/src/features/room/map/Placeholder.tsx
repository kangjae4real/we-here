"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { easeOutCubic } from "@/features/ui/motion";
import type { MapInset, MapScene } from "../contract";
import { MAP_LABELS, type Room } from "../mock";
import {
  frame,
  ORIGIN,
  ORIGIN_LL,
  pin,
  quantize,
  rel,
  setVars,
  unitsPerMeter,
  type View,
  WORLD,
  type XY,
} from "./geo";
import { Overlay } from "./Overlay";

// Used when NEXT_PUBLIC_NAVER_MAP_CLIENT_ID is not set or the Naver script fails:
// a hand-drawn Seoul in the design palette, with the same layers and camera.

export function PlaceholderMap({
  room,
  scene,
  inset,
  note = "네이버 지도 키 없음",
}: {
  room: Room;
  scene: MapScene;
  inset: MapInset;
  note?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const cur = useRef<View | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [scale, setScale] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const view = size.w > 0 ? frame(room, scene, inset, size.w, size.h) : null;
  const cx = view?.c.x ?? 0;
  const cy = view?.c.y ?? 0;
  const k = view?.k ?? 0;
  const cramped = view?.cramped ?? false;

  // Same camera move as the real map: 900 ms ease-out cubic, zoom tweened in log space.
  useEffect(() => {
    const el = ref.current;
    if (!el || !(k > 0) || (cramped && cur.current)) return;
    const apply = (v: View) => {
      cur.current = v;
      setVars(
        el,
        (ORIGIN.x - v.c.x) * v.k + size.w / 2,
        (ORIGIN.y - v.c.y) * v.k + size.h / 2,
        v.k,
      );
    };
    const from = cur.current;
    const to = { c: { x: cx, y: cy }, k };
    if (!from || reduced) {
      apply(to);
      setScale(quantize(k));
      return;
    }
    const run = animate(0, 1, {
      duration: 0.9,
      ease: easeOutCubic,
      onUpdate: (e) =>
        apply({
          c: {
            x: from.c.x + (to.c.x - from.c.x) * e,
            y: from.c.y + (to.c.y - from.c.y) * e,
          },
          k: from.k * (to.k / from.k) ** e,
        }),
      // Re-cluster once the camera settles, like the real map.
      onComplete: () => setScale(quantize(k)),
    });
    return () => run.stop();
  }, [cx, cy, k, cramped, reduced, size.w, size.h]);

  return (
    <div
      role="img"
      aria-label={`두 사람의 사진 위치 지도 미리보기 (${note})`}
      className="absolute inset-0 overflow-hidden bg-land"
    >
      <Overlay ref={ref} room={room} scene={scene} scale={scale}>
        {scale > 0 && <BaseMap />}
      </Overlay>
      <span
        className="absolute rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-sub shadow-soft transition-[bottom] duration-300"
        style={{ right: inset.right + 12, bottom: inset.bottom + 12 }}
      >
        지도 미리보기 · {note}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Base map geometry, in overlay world units (see geo.ts). Sizes are meters.

const M = unitsPerMeter(ORIGIN_LL.lat);
const pts = (ll: [number, number][]) =>
  ll.map(([lat, lng]) => rel({ lat, lng }));
const line = (ps: XY[]) =>
  `M${ps.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L")}`;

const HAN_LL: [number, number][] = [
  [37.6, 126.74],
  [37.566, 126.86],
  [37.556, 126.89],
  [37.54, 126.915],
  [37.533, 126.935],
  [37.522, 126.96],
  [37.515, 126.985],
  [37.52, 127.01],
  [37.528, 127.03],
  [37.538, 127.06],
  [37.535, 127.085],
  [37.525, 127.11],
  [37.53, 127.24],
];
const HAN = pts(HAN_LL);
const JUNGNANG = pts([
  [37.535, 127.05],
  [37.552, 127.047],
  [37.567, 127.052],
  [37.588, 127.058],
  [37.62, 127.066],
]);
/** lat, lng, rx m, ry m, rotation° */
const PARKS: [number, number, number, number, number][] = [
  [37.5512, 126.9882, 950, 620, 0],
  [37.5444, 127.0374, 560, 360, 0],
  [37.5256, 126.9226, 260, 620, 10],
  [37.5683, 126.8874, 900, 480, -8],
  [37.5206, 127.1214, 720, 600, 0],
  [37.5285, 126.982, 760, 480, 0],
];
/** Riverside park strips, drawn over the water's edge. */
const BANKS: [number, number, number, number, number][] = [
  [37.5284, 126.9332, 760, 170, -14],
  [37.5372, 127.0425, 520, 140, 18],
];

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function distToRiver(p: XY) {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < HAN.length - 1; i++) {
    const [a, b] = [HAN[i], HAN[i + 1]];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(
      0,
      Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)),
    );
    best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
  }
  return best;
}

let geometry: ReturnType<typeof build> | null = null;

/** Procedural city blocks and a loose road grid, so the map reads as a neighborhood at any zoom. */
function build() {
  const [nw, se] = pts([
    [37.72, 126.76],
    [37.4, 127.22],
  ]);
  const parks = PARKS.map(([lat, lng, rx, ry]) => ({
    ...rel({ lat, lng }),
    rx: rx * M,
    ry: ry * M,
  }));
  const r = rng(42);
  let blocks = "";
  for (let y = nw.y; y < se.y; y += 440 * M) {
    for (let x = nw.x; x < se.x; x += 550 * M) {
      const w = (230 + r() * 180) * M;
      const h = (150 + r() * 130) * M;
      const bx = x + r() * 100 * M;
      const by = y + r() * 80 * M;
      const c = { x: bx + w / 2, y: by + h / 2 };
      if (distToRiver(c) < 760 * M) continue;
      if (
        parks.some(
          (p) => ((c.x - p.x) / p.rx) ** 2 + ((c.y - p.y) / p.ry) ** 2 < 1.2,
        )
      )
        continue;
      if (r() < 0.22) continue;
      blocks += `M${bx.toFixed(1)} ${by.toFixed(1)}h${w.toFixed(1)}v${h.toFixed(1)}h${(-w).toFixed(1)}Z`;
    }
  }

  const wave = 300 * M;
  const minor: string[] = [];
  for (let lat = 37.405; lat < 37.72; lat += 0.018) {
    const [a, b] = pts([
      [lat, 126.76],
      [lat, 127.22],
    ]);
    const s = b.x - a.x;
    minor.push(
      `M${a.x} ${a.y} C${a.x + s / 3} ${a.y - wave} ${a.x + (2 * s) / 3} ${a.y + wave} ${b.x} ${b.y - wave / 3}`,
    );
  }
  for (let lng = 126.77; lng < 127.22; lng += 0.024) {
    const [a, b] = pts([
      [37.72, lng],
      [37.4, lng],
    ]);
    const s = b.y - a.y;
    minor.push(
      `M${a.x} ${a.y} C${a.x + wave} ${a.y + s / 3} ${a.x - wave} ${a.y + (2 * s) / 3} ${b.x + wave / 3} ${b.y}`,
    );
  }

  const shift = (dLat: number) =>
    line(pts(HAN_LL.map(([lat, lng]) => [lat + dLat, lng])));
  const major = [shift(0.0068), shift(-0.0068)];
  for (const lng of [126.935, 126.978, 127.0, 127.035, 127.06, 127.1]) {
    const [a, b] = pts([
      [37.72, lng],
      [37.4, lng],
    ]);
    const s = b.y - a.y;
    major.push(
      `M${a.x} ${a.y} C${a.x + wave} ${a.y + s / 3} ${a.x - wave} ${a.y + (2 * s) / 3} ${b.x} ${b.y}`,
    );
  }
  return { blocks, minor: minor.join(""), major: major.join("") };
}

const ellipse = ([lat, lng, rx, ry, rot]: (typeof PARKS)[number]) => {
  const p = rel({ lat, lng });
  return (
    <ellipse
      key={`${lat},${lng}`}
      cx={p.x}
      cy={p.y}
      rx={rx * M}
      ry={ry * M}
      transform={`rotate(${rot} ${p.x} ${p.y})`}
    />
  );
};

const LABELS = [
  ...MAP_LABELS.map((l) => ({ ...l, river: false })),
  { name: "한강", lat: 37.5205, lng: 126.968, river: true },
];

function BaseMap() {
  geometry ??= build();
  return (
    <>
      <g style={WORLD}>
        <g className="fill-park">{PARKS.map(ellipse)}</g>
        <path d={geometry.blocks} fill="#EBE5D9" />
        <path
          d={geometry.minor}
          fill="none"
          stroke="#fff"
          strokeWidth={60 * M}
          strokeLinecap="round"
          opacity={0.9}
        />
        <g
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-water"
        >
          <path d={line(HAN)} strokeWidth={900 * M} />
          <path d={line(JUNGNANG)} strokeWidth={150 * M} />
        </g>
        <g className="fill-park">{BANKS.map(ellipse)}</g>
        <path
          d={geometry.major}
          fill="none"
          stroke="#fff"
          strokeWidth={130 * M}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g className="fill-map-label" fontWeight={600} textAnchor="middle">
        {LABELS.map((l) => {
          const p = rel(l);
          return (
            <text
              key={l.name}
              y={4}
              fontSize={l.river ? 13 : 12}
              letterSpacing={l.river ? "0.3em" : undefined}
              style={pin(p)}
            >
              {l.name}
            </text>
          );
        })}
      </g>
    </>
  );
}
