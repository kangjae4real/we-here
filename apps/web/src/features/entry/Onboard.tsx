"use client";

import { animate, motion, stagger, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useRef } from "react";
import { Logo, sparklePath } from "@/features/ui/marks";
import { march, pop, twinkle, useLoop } from "@/features/ui/motion";
import { useIsDesktop } from "@/features/ui/useIsDesktop";

/**
 * Onboarding shell (01–04, S7, S8). Mobile: one padded column.
 * Desktop: hero art panel on the left, a 520px column with the logo on the right.
 * Children with `variants={rise}` enter staggered.
 */
export function Onboard({ children }: { children: ReactNode }) {
  const isDesktop = useIsDesktop();
  return (
    <div className="min-h-dvh bg-bg md:grid md:grid-cols-[1fr_520px]">
      <div className="relative m-6 mr-0 hidden overflow-hidden rounded-[28px] bg-land md:block">
        {isDesktop && <HeroArt />}
      </div>
      <main className="flex min-h-dvh flex-col overflow-x-clip px-5 pt-[calc(3.5rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))] md:px-[60px] md:py-12">
        <div className="hidden md:block">
          <Logo size="lg" />
        </div>
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            show: {
              transition: {
                delayChildren: stagger(0.07, { startDelay: 0.05 }),
              },
            },
          }}
          className="flex flex-1 flex-col md:mt-16"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}

const PATH_A = "M 30 250 C 80 250, 90 170, 150 175 S 180 150, 172 142";
const PATH_B = "M 330 60 C 300 90, 270 70, 240 110 S 200 150, 186 146";
const FILL_BOX = {
  transformBox: "fill-box",
  transformOrigin: "center",
} as const;
const DOTS = {
  strokeWidth: 2.5,
  strokeDasharray: "1 6",
  strokeLinecap: "round",
  fill: "none",
} as const;
// The design's march speed (24 per 1.2s), looped over a whole dash period (7) so it doesn't jump.
const MARCH_7 = {
  animate: { strokeDashoffset: [0, -28] },
  transition: { ...march.transition, duration: 1.4 },
};

/** Circle and diamond travel dotted paths and meet in a butter sparkle. Fills its (relative) parent. */
export function HeroArt() {
  const pathA = useRef<SVGPathElement>(null);
  const pathB = useRef<SVGPathElement>(null);
  const markA = useRef<SVGGElement>(null);
  const markB = useRef<SVGGElement>(null);
  const reduce = useReducedMotion();
  const loop = useLoop();

  // Same as the design's <animateMotion dur=2.3s keySplines="0.3 0 0.2 1">: ease the distance along each path.
  useEffect(() => {
    const pairs = [
      [pathA.current, markA.current],
      [pathB.current, markB.current],
    ] as const;
    const place = (t: number) => {
      for (const [path, mark] of pairs) {
        if (!path || !mark) continue;
        const p = path.getPointAtLength(t * path.getTotalLength());
        mark.setAttribute("transform", `translate(${p.x} ${p.y})`);
      }
    };
    if (reduce) return place(1);
    const travel = animate(0, 1, {
      duration: 2.3,
      ease: [0.3, 0, 0.2, 1],
      onUpdate: place,
    });
    return () => travel.stop();
  }, [reduce]);

  return (
    <svg
      viewBox="0 0 360 300"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="두 점이 만나는 지도 그림"
      className="absolute inset-0 block size-full"
    >
      <rect width="360" height="300" className="fill-land" />
      <ellipse cx="60" cy="70" rx="55" ry="34" className="fill-park" />
      <ellipse cx="300" cy="235" rx="50" ry="32" className="fill-park" />
      <g stroke="#fff" strokeWidth="7" fill="none" strokeLinecap="round">
        <path d="M -10 120 C 100 100, 200 130, 370 100" />
        <path d="M 110 -10 C 120 100, 100 200, 125 310" />
        <path d="M 250 -10 C 240 100, 270 200, 255 310" />
      </g>
      <path
        d="M -20 215 C 60 190, 120 240, 200 210 S 300 170, 380 200"
        strokeWidth="30"
        fill="none"
        strokeLinecap="round"
        className="stroke-water"
      />
      <text
        x="320"
        y="190"
        fontSize="9"
        fontWeight="600"
        textAnchor="middle"
        letterSpacing="2"
        className="fill-map-label"
      >
        한강
      </text>
      <motion.path
        ref={pathA}
        d={PATH_A}
        className="stroke-a"
        {...DOTS}
        {...loop(MARCH_7)}
      />
      <motion.path
        ref={pathB}
        d={PATH_B}
        className="stroke-b"
        {...DOTS}
        {...loop(MARCH_7)}
      />
      {/* The ring pops at 2.2s, the sparkles at 2.4s, as the marks arrive. */}
      <motion.g
        initial="hidden"
        animate="show"
        variants={{
          show: {
            transition: { delayChildren: stagger(0.2, { startDelay: 2.2 }) },
          },
        }}
      >
        <motion.circle
          variants={pop}
          style={FILL_BOX}
          cx="179"
          cy="144"
          r="30"
          fillOpacity="0.85"
          strokeWidth="2"
          className="fill-butter-soft stroke-butter"
        />
        <motion.g variants={pop} style={FILL_BOX}>
          {[
            [150, 108, 7],
            [210, 112, 5],
            [205, 182, 4],
          ].map(([x, y, r], i) => (
            <motion.path
              key={x}
              {...loop(twinkle(i * 0.35))}
              d={sparklePath(x, y, r)}
              className="fill-butter"
            />
          ))}
        </motion.g>
      </motion.g>
      <g ref={markA} transform="translate(30 250)">
        <circle r="8" stroke="#fff" strokeWidth="2.5" className="fill-a" />
      </g>
      <g ref={markB} transform="translate(330 60)">
        <rect
          x="-6.5"
          y="-6.5"
          width="13"
          height="13"
          rx="3.5"
          transform="rotate(45)"
          stroke="#fff"
          strokeWidth="2.5"
          className="fill-b"
        />
      </g>
    </svg>
  );
}
