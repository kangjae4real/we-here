"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { blink, twinkle, useLoop } from "./motion";

export type Who = "a" | "b";
type MarkState = "base" | "selected" | "moment";

const COLOR = { a: "var(--color-a)", b: "var(--color-b)" } as const;
const SOFT = { a: "var(--color-a-soft)", b: "var(--color-b-soft)" } as const;
const RING = {
  selected: { a: "rgb(61 123 255 / .2)", b: "rgb(255 138 61 / .2)" },
  moment: "rgb(255 200 61 / .55)",
} as const;

/** Identity mark: A is a circle, B a rounded diamond. Shape + color, always together. */
export function Mark({
  who,
  size = 14,
  state = "base",
  ghost,
}: {
  who: Who;
  size?: number;
  state?: MarkState;
  ghost?: boolean;
}) {
  const ring =
    state === "selected"
      ? `0 0 0 4px ${RING.selected[who]}`
      : state === "moment"
        ? `0 0 0 5px ${RING.moment}`
        : "none";
  const style = ghost
    ? { background: SOFT[who], border: `2px dashed ${COLOR[who]}` }
    : { background: COLOR[who], border: "2px solid #fff", boxShadow: ring };
  if (who === "a")
    return (
      <span
        aria-hidden
        className="inline-block shrink-0 rounded-full"
        style={{ width: size, height: size, ...style }}
      />
    );
  const side = size * 0.8;
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <span
        className="block rotate-45"
        style={{
          width: side,
          height: side,
          borderRadius: size * 0.22,
          ...style,
        }}
      />
    </span>
  );
}

/** Dashed, blinking B diamond: "the other person hasn't joined yet". */
export function GhostMark({ className }: { className?: string }) {
  const loop = useLoop();
  return (
    <motion.span
      aria-hidden
      {...loop(blink())}
      className={cn(
        "block rotate-45 border-2 border-dashed border-(--color-b) bg-b-soft",
        className,
      )}
    />
  );
}

export function Name({
  who,
  children,
  className,
}: {
  who: Who;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      style={{ color: COLOR[who] }}
    >
      <Mark who={who} size={12} />
      {children}
    </span>
  );
}

export function Legend({
  a,
  b,
  className,
}: {
  a: string;
  b: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex h-8 items-center gap-3 rounded-full bg-white px-3 text-[13px] font-semibold shadow-soft",
        className,
      )}
    >
      <Name who="a">{a}</Name>
      <Name who="b">{b}</Name>
    </div>
  );
}

/** First character of a name; spreads by code point so an emoji isn't split in half. */
export const initial = (name: string) => [...name][0] ?? "";

/** First letter avatars: A circle + B diamond, overlapped. */
export function AvatarPair({
  a,
  b,
  ghostB,
}: {
  a: string;
  b?: string;
  ghostB?: boolean;
}) {
  return (
    <span className="flex items-center -space-x-1.5">
      <span className="grid size-7 place-items-center rounded-full border-2 border-white bg-a text-[11px] font-bold text-white">
        {initial(a)}
      </span>
      <span className="grid size-7 place-items-center">
        {ghostB || !b ? (
          <GhostMark className="size-5 rounded-[6px]" />
        ) : (
          <span className="grid size-[22px] rotate-45 place-items-center rounded-[6px] border-2 border-white bg-b">
            <span className="-rotate-45 text-[11px] font-bold text-white">
              {initial(b)}
            </span>
          </span>
        )}
      </span>
    </span>
  );
}

export function Logo({ size = "sm" }: { size?: "sm" | "lg" }) {
  const s = size === "lg" ? 22 : 18;
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="relative inline-block"
        style={{ width: s * 1.5, height: s }}
      >
        <span className="absolute top-1/2 left-0 -translate-y-1/2">
          <Mark who="a" size={s * 0.75} />
        </span>
        <span className="absolute top-1/2 right-0 -translate-y-1/2">
          <Mark who="b" size={s * 0.8} />
        </span>
      </span>
      <span
        className={cn(
          "font-extrabold tracking-tight",
          size === "lg" ? "text-[20px]" : "text-[16px]",
        )}
      >
        we-here
      </span>
    </span>
  );
}

/** Four-point butter sparkle path centered on (x, y). */
export function sparklePath(x: number, y: number, r: number) {
  const k = r * 0.28;
  return `M ${x} ${y - r} Q ${x + k} ${y - k} ${x + r} ${y} Q ${x + k} ${y + k} ${x} ${y + r} Q ${x - k} ${y + k} ${x - r} ${y} Q ${x - k} ${y - k} ${x} ${y - r} Z`;
}

/** Three twinkling sparkles: the "스친 순간" signature. */
export function Sparkles({ className }: { className?: string }) {
  const loop = useLoop();
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn("size-10", className)}
      aria-hidden="true"
    >
      {[
        [12, 14, 7, 0],
        [28, 10, 4.5, 0.3],
        [25, 28, 5.5, 0.6],
      ].map(([x, y, r, delay]) => (
        <motion.path
          key={`${x}-${y}`}
          {...loop(twinkle(delay))}
          d={sparklePath(x, y, r)}
          fill="var(--color-butter)"
        />
      ))}
    </svg>
  );
}
