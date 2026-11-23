import {
  type TargetAndTransition,
  type Transition,
  useReducedMotion,
  type Variants,
} from "motion/react";

type Loop = {
  animate: TargetAndTransition;
  transition: Transition;
  style?: { transformBox: "fill-box"; transformOrigin: string };
};

// Motion tokens ported from the Figma Make keyframes (press, rise, pop, twinkle,
// blink, march, fly-l/fly-r). Every animated component pulls from here so the
// whole app moves with one rhythm.

export const easeOut = [0, 0, 0.58, 1] as const;
export const easeOutCubic = [0.33, 1, 0.68, 1] as const;
/** fly-l / fly-r overshoot curve: cubic-bezier(.2,.9,.3,1.1). */
export const easeOvershoot = [0.2, 0.9, 0.3, 1.1] as const;

/** Snappy spring for layout changes: tab pills, sheet snaps, chips. */
export const spring: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 36,
};
/** Softer spring for big surfaces (bottom sheet, cards). */
export const sheetSpring: Transition = {
  type: "spring",
  stiffness: 320,
  damping: 34,
  mass: 0.9,
};

/** `.press:active { transform: scale(.97) }` */
export const press = { whileTap: { scale: 0.97 } } as const;

/** `.rise`: 0.3s ease-out, from translateY(24px) + opacity 0. */
export const rise: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: easeOut } },
  exit: { opacity: 0, y: 16, transition: { duration: 0.2, ease: easeOut } },
};

/** `.pop`: scale 0 → 1.15 → 1 over 0.4s. */
export const pop: Variants = {
  hidden: { scale: 0 },
  show: {
    scale: [0, 1.15, 1],
    transition: { duration: 0.4, times: [0, 0.7, 1], ease: easeOut },
  },
};

/** `.twinkle`: 1.4s loop, scale 1 → .6 → 1, opacity 1 → .6 → 1. */
export const twinkle = (delay = 0): Loop => ({
  animate: { scale: [1, 0.6, 1], opacity: [1, 0.6, 1] },
  transition: {
    duration: 1.4,
    ease: "easeInOut",
    repeat: Number.POSITIVE_INFINITY,
    delay,
  },
  style: { transformBox: "fill-box", transformOrigin: "center" },
});

/** `.blink`: 1.6s loop, opacity 1 → .3 → 1 (the "not here yet" ghost mark). */
export const blink = (delay = 0): Loop => ({
  animate: { opacity: [1, 0.3, 1] },
  transition: {
    duration: 1.6,
    ease: "easeInOut",
    repeat: Number.POSITIVE_INFINITY,
    delay,
  },
});

/** `.march`: dotted strokes crawl forward, 1.2s linear loop (dash period 24). */
export const march: Loop = {
  animate: { strokeDashoffset: [0, -24] },
  transition: {
    duration: 1.2,
    ease: "linear",
    repeat: Number.POSITIVE_INFINITY,
  },
};

/** `.fly-l` / `.fly-r`: polaroids swing in from the sides. */
export const fly = (side: "l" | "r") =>
  ({
    initial: {
      opacity: 0,
      x: side === "l" ? -180 : 180,
      rotate: side === "l" ? -18 : 18,
    },
    animate: { opacity: 1, x: 0, rotate: side === "l" ? -4 : 4 },
    transition: {
      duration: 0.5,
      ease: easeOvershoot,
      delay: side === "l" ? 0.15 : 0.22,
    },
  }) as const;

/** Map camera tween: 900ms, ease-out cubic (from the prototype's useTweenView). */
export const camera: Transition = { duration: 0.9, ease: easeOutCubic };

/**
 * MotionConfig's reducedMotion only stops transforms; infinite opacity and
 * dash loops (blink, twinkle, march) must be dropped by hand (WCAG 2.2.2).
 * Usage: `const loop = useLoop(); <motion.path {...loop(twinkle())} />`.
 */
export function useLoop() {
  const still = useReducedMotion();
  return (l: Loop): Partial<Loop> => (still ? { style: l.style } : l);
}
