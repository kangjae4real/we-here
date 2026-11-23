"use client";

import { animate, motion, useReducedMotion } from "motion/react";
import { type ReactNode, type Ref, useEffect, useState } from "react";
import { sparklePath } from "@/features/ui/marks";
import { blink, easeOut, twinkle, useLoop } from "@/features/ui/motion";
import type { MapScene, MomentPhase } from "../contract";
import type { Moment, Room, Who } from "../mock";
import {
  type Dot,
  densest,
  groupDots,
  pin,
  rel,
  unitsPerMeter,
  WORLD,
  type XY,
} from "./geo";

/** Scale around the pinned point (motion writes transform-origin from originX/Y). */
const AT_PIN = { transformBox: "view-box", originX: 0, originY: 0 } as const;
const POP = { duration: 0.4, times: [0, 0.7, 1], ease: easeOut };
const EASE_OUT_QUAD = [0.5, 1, 0.89, 1] as const;
/** Merge only real pile-ups; loose scatter stays as single dots like 05. */
const CLUSTER_MIN = 5;

export function Overlay({
  ref,
  room,
  scene,
  scale,
  children,
}: {
  ref: Ref<SVGSVGElement>;
  room: Room;
  scene: MapScene;
  /** Quantized --k, for clustering. 0 until the camera is placed. */
  scale: number;
  /** Placeholder base map, drawn under the layers. */
  children?: ReactNode;
}) {
  const loop = useLoop();
  const moment = scene.moment && room.moments[scene.moment.index];
  const dots: Dot[] = room.points
    .filter((p) => scene.dots === "all" || p.who === "a")
    .map((p) => ({ ...rel(p), id: p.id, who: p.who }));

  return (
    <svg
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full select-none"
    >
      <defs>
        <radialGradient id="wh-heat3">
          <stop offset="0%" stopColor="#12A86B" stopOpacity={0.85} />
          <stop offset="35%" stopColor="#5BD3A0" stopOpacity={0.7} />
          <stop offset="70%" stopColor="#D8F5E8" stopOpacity={0.7} />
          <stop offset="100%" stopColor="#D8F5E8" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="wh-heat2">
          <stop offset="0%" stopColor="#5BD3A0" stopOpacity={0.8} />
          <stop offset="55%" stopColor="#D8F5E8" stopOpacity={0.75} />
          <stop offset="100%" stopColor="#D8F5E8" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="wh-heat1">
          <stop offset="0%" stopColor="#D8F5E8" stopOpacity={0.95} />
          <stop offset="100%" stopColor="#D8F5E8" stopOpacity={0} />
        </radialGradient>
      </defs>
      {children}
      {scale > 0 && (
        <>
          {scene.heat && (
            <g style={WORLD}>
              {room.heat.map((cell) => {
                const p = rel(cell);
                return (
                  <motion.circle
                    key={`${cell.lat},${cell.lng}`}
                    cx={p.x}
                    cy={p.y}
                    r={cell.radiusM * unitsPerMeter(cell.lat)}
                    fill={`url(#wh-heat${cell.level})`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, ease: easeOut }}
                  />
                );
              })}
            </g>
          )}
          {scene.dots !== "none" && !moment && (
            <Dots dots={dots} scale={scale} dim={scene.heat} />
          )}
          {scene.ghostB && (
            <g style={pin(densest(dots.filter((d) => d.who === "a")))}>
              {/* Beside A's busiest spot, not on top of its cluster. */}
              <g transform="translate(44 -4)">
                <motion.rect
                  {...loop(blink())}
                  x={-12}
                  y={-12}
                  width={24}
                  height={24}
                  rx={7}
                  transform="rotate(45)"
                  className="fill-b-soft stroke-b"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
              </g>
            </g>
          )}
          {scene.moment && moment && (
            <MomentLayer
              key={moment.id}
              m={moment}
              phase={scene.moment.phase}
            />
          )}
        </>
      )}
    </svg>
  );
}

function Dots({
  dots,
  scale,
  dim,
}: {
  dots: Dot[];
  scale: number;
  dim: boolean;
}) {
  const groups = groupDots(dots, scale);
  const clusters = groups
    .filter((g) => g.members.length >= CLUSTER_MIN)
    .map((g) => ({
      key: `c-${g.id}`,
      p: g.p,
      who: g.who,
      n: g.members.length,
      paired: false,
    }));
  // Both people at one spot is the whole point of the app: set the two clusters
  // side by side (A's count on the left) instead of letting B cover A.
  const near = 22 / scale;
  for (const a of clusters.filter((c) => c.who === "a")) {
    const b = clusters.find(
      (c) =>
        c.who === "b" &&
        !c.paired &&
        Math.abs(c.p.x - a.p.x) < near &&
        Math.abs(c.p.y - a.p.y) < near,
    );
    if (!b) continue;
    const mid = { x: (a.p.x + b.p.x) / 2, y: (a.p.y + b.p.y) / 2 };
    a.p = { x: mid.x - 12 / scale, y: mid.y };
    b.p = { x: mid.x + 12 / scale, y: mid.y };
    a.paired = b.paired = true;
  }
  // Loose dots first, clusters on top.
  const marks = [
    ...groups
      .filter((g) => g.members.length < CLUSTER_MIN)
      .flatMap((g) =>
        g.members.map((d) => ({
          key: d.id,
          p: d as XY,
          who: d.who,
          n: 1,
          paired: false,
        })),
      ),
    ...clusters,
  ];
  return (
    <g opacity={dim ? 0.35 : 1} className="transition-opacity duration-300">
      {marks.map((m, i) => (
        // Stagger the pop-in, but keep the whole wave under half a second.
        <Pop key={m.key} p={m.p} delay={Math.min(i * 0.012, 0.45)}>
          {m.n > 1 ? (
            <Cluster who={m.who} n={m.n} left={m.paired && m.who === "a"} />
          ) : (
            <SvgMark who={m.who} />
          )}
        </Pop>
      ))}
    </g>
  );
}

function Pop({
  p,
  delay,
  children,
}: {
  p: XY;
  delay: number;
  children: ReactNode;
}) {
  return (
    <g style={pin(p)}>
      <motion.g
        style={AT_PIN}
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.15, 1] }}
        transition={{ ...POP, duration: 0.3, delay }}
      >
        {children}
      </motion.g>
    </g>
  );
}

/** A = circle, B = rounded diamond, centered on (0, 0) in px. */
function SvgMark({
  who,
  r = 7,
  state = "base",
}: {
  who: Who;
  r?: number;
  state?: "base" | "selected" | "moment";
}) {
  const fill = who === "a" ? "fill-a" : "fill-b";
  const rr = state === "base" ? r : r * 1.35;
  return (
    <>
      {state === "moment" && (
        <circle r={rr * 1.9} className="fill-butter" opacity={0.35} />
      )}
      {state === "selected" && (
        <circle r={rr * 1.8} className={fill} opacity={0.18} />
      )}
      {who === "a" ? (
        <circle r={rr} className={fill} stroke="#fff" strokeWidth={2} />
      ) : (
        <rect
          x={-rr * 0.82}
          y={-rr * 0.82}
          width={rr * 1.64}
          height={rr * 1.64}
          rx={rr * 0.42}
          transform="rotate(45)"
          className={fill}
          stroke="#fff"
          strokeWidth={2}
        />
      )}
    </>
  );
}

function Cluster({ who, n, left }: { who: Who; n: number; left: boolean }) {
  const w = n > 99 ? 28 : 22;
  return (
    <>
      <SvgMark who={who} r={11} />
      <g transform={`translate(${left ? -9 - w : 9} -13)`}>
        <rect
          width={w}
          height={16}
          rx={8}
          className="fill-ink"
          stroke="#fff"
          strokeWidth={1.5}
        />
        <text
          x={w / 2}
          y={11.5}
          fontSize={10}
          fontWeight={700}
          fill="#fff"
          textAnchor="middle"
          className="tnum"
        >
          {n}
        </text>
      </g>
    </>
  );
}

/** Control point bowing the A→B path to one side, like a person drifting toward the spot. */
const bow = (from: XY, to: XY): XY => ({
  x: (from.x + to.x) / 2 - (to.y - from.y) * 0.35,
  y: (from.y + to.y) / 2 + (to.x - from.x) * 0.35,
});
const bez = (a: XY, c: XY, b: XY, t: number): XY => ({
  x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t ** 2 * b.x,
  y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t ** 2 * b.y,
});
const trail = (a: XY, c: XY, b: XY, t: number) =>
  `M${Array.from({ length: 25 }, (_, i) => {
    const p = bez(a, c, b, (i / 24) * t);
    return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  }).join(" L")}`;

const TRAIL = {
  fill: "none",
  strokeWidth: 3,
  strokeDasharray: "0.1 7",
  strokeLinecap: "round",
  vectorEffect: "non-scaling-stroke",
} as const;
/** [dx, dy, r] in ring radii / px, from the design. */
const SPARKS = [
  [-1, -1.05, 4],
  [0.95, -0.75, 3],
  [0.2, -1.35, 2.5],
] as const;

/** 07a → 07b → 07c: both shots approach, then the butter ring pops between them. */
function MomentLayer({ m, phase }: { m: Moment; phase: MomentPhase }) {
  // Reduced motion: draw the trails at their end state right away.
  const reduced = useReducedMotion();
  const loop = useLoop();
  const still = phase !== "approach" || Boolean(reduced);
  const [t, setT] = useState(still ? 1 : 0);
  useEffect(() => {
    if (still) {
      setT(1);
      return;
    }
    setT(0);
    const run = animate(0, 1, {
      duration: 1.5,
      delay: 0.5,
      ease: EASE_OUT_QUAD,
      onUpdate: setT,
    });
    return () => run.stop();
  }, [still]);

  const [af, at, bf, bt] = [rel(m.a.from), rel(m.a), rel(m.b.from), rel(m.b)];
  const [ca, cb] = [bow(af, at), bow(bf, bt)];
  const pa = bez(af, ca, at, t);
  const pb = bez(bf, cb, bt, t);
  const mid = { x: (at.x + bt.x) / 2, y: (at.y + bt.y) / 2 };
  const R = Math.hypot(at.x - bt.x, at.y - bt.y) * 0.78;
  const ring = phase !== "approach";
  const label = `${m.distanceM}m`;
  const pw = Math.max(44, label.length * 7 + 14);

  return (
    <g>
      <g style={WORLD}>
        <path d={trail(af, ca, at, t)} className="stroke-a" {...TRAIL} />
        <path d={trail(bf, cb, bt, t)} className="stroke-b" {...TRAIL} />
      </g>
      <circle style={pin(af)} r={3} className="fill-a" opacity={0.5} />
      <circle style={pin(bf)} r={3} className="fill-b" opacity={0.5} />
      {ring && (
        <g style={pin(mid)}>
          <motion.g
            style={AT_PIN}
            initial={{ scale: phase === "pop" ? 0 : 1 }}
            animate={{ scale: phase === "pop" ? [0, 1.15, 1] : 1 }}
            transition={POP}
          >
            <g style={{ transform: "scale(var(--k))" }}>
              <circle
                r={R}
                className="fill-butter-soft stroke-butter"
                fillOpacity={0.6}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={pa.x - mid.x}
                y1={pa.y - mid.y}
                x2={pb.x - mid.x}
                y2={pb.y - mid.y}
                className="stroke-ink"
                strokeOpacity={0.35}
                strokeWidth={1.2}
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
            </g>
            <g
              style={{ transform: `translateY(calc(var(--k) * ${R}px + 4px))` }}
            >
              {/* The card shows the distance once it is open (07c). */}
              <motion.g animate={{ opacity: phase === "on" ? 0 : 1 }}>
                <rect
                  x={-pw / 2}
                  width={pw}
                  height={20}
                  rx={10}
                  className="fill-ink"
                />
                <text
                  y={14}
                  fontSize={11}
                  fontWeight={700}
                  fill="#fff"
                  textAnchor="middle"
                  className="tnum"
                >
                  {label}
                </text>
              </motion.g>
            </g>
            {SPARKS.map(([dx, dy, r], i) => (
              <g
                key={dx}
                style={{
                  transform: `translate(calc(var(--k) * ${dx * R * 0.9}px), calc(var(--k) * ${dy * R * 0.9}px))`,
                }}
              >
                <motion.path
                  {...loop(twinkle(0.4 + i * 0.3))}
                  d={sparklePath(0, 0, r * 1.6)}
                  className="fill-butter"
                />
              </g>
            ))}
          </motion.g>
        </g>
      )}
      <g style={pin(pa)}>
        <SvgMark who="a" r={8} state={ring ? "moment" : "selected"} />
      </g>
      <g style={pin(pb)}>
        <SvgMark who="b" r={8} state={ring ? "moment" : "selected"} />
      </g>
    </g>
  );
}
