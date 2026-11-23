"use client";

import { PauseIcon, PlayIcon } from "lucide-react";
import {
  AnimatePresence,
  animate,
  type MotionValue,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
} from "motion/react";
import { type PointerEvent, useState } from "react";
import { press, spring } from "@/features/ui/motion";
import { cn } from "@/lib/utils";

/** Keyboard steps, in months. */
const KEYS: Record<string, number> = {
  ArrowRight: 1,
  ArrowUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1,
  PageUp: 12,
  PageDown: -12,
};

/**
 * Play button + timeline track. Bands: ① gray until the first moment, ② butter,
 * ③ mint tail (함께한 기억). The track is a real slider: arrows step a month,
 * PageUp/Down a year, pointer drag and click seek.
 */
export function TimeSlider({
  pct,
  value,
  playing,
  onToggle,
  onSeek,
  step,
  ticks,
  band,
  valueText,
  compact,
}: {
  /** Committed position (aria). */
  pct: number;
  /** Live position; the thumb follows it without React renders. */
  value: MotionValue<number>;
  playing: boolean;
  onToggle: () => void;
  onSeek: (pct: number) => void;
  /** One month, in %. */
  step: number;
  /** Moment positions, in %. */
  ticks: number[];
  /** Where ② 스친 순간 starts, in %. */
  band: number;
  valueText: string;
  compact?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const x = useMotionValue(value.get());
  const left = useTransform(x, (v) => `${v}%`);

  // Track playback and drags 1:1; spring only on jumps (click, chapter, moment).
  useMotionValueEvent(value, "change", (v) => {
    if (playing || dragging) x.set(v);
    else animate(x, v, spring);
  });

  const seekAt = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onSeek(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
  };

  return (
    <div className="flex items-center gap-3">
      <motion.button
        type="button"
        {...press}
        onClick={onToggle}
        aria-label={playing ? "일시정지" : "재생"}
        className={cn(
          // after: grows the 40px compact button to a 44px touch target.
          "relative grid shrink-0 place-items-center rounded-full bg-butter text-ink outline-none after:absolute after:-inset-0.5 hover:bg-butter-press focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2",
          compact ? "size-10" : "size-12",
        )}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={playing ? "pause" : "play"}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {playing ? (
              <PauseIcon size={22} strokeWidth={2} />
            ) : (
              <PlayIcon size={22} strokeWidth={2} className="translate-x-px" />
            )}
          </motion.span>
        </AnimatePresence>
      </motion.button>
      <div className="flex-1">
        <div
          role="slider"
          tabIndex={0}
          aria-label="타임라인"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          aria-valuetext={valueText}
          onKeyDown={(e) => {
            const next =
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? 100
                  : KEYS[e.key] != null
                    ? Math.round(value.get() / step + KEYS[e.key]) * step
                    : null;
            if (next == null) return;
            e.preventDefault();
            onSeek(Math.min(100, Math.max(0, next)));
          }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDragging(true);
            seekAt(e);
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) seekAt(e);
          }}
          onLostPointerCapture={() => setDragging(false)}
          className="relative h-6 cursor-pointer touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
        >
          {/* taller invisible hit area (44px) */}
          <span className="absolute inset-x-0 -inset-y-2.5" />
          <div className="absolute inset-x-0 top-1/2 flex h-2 -translate-y-1/2 overflow-hidden rounded-full">
            <span className="h-full bg-line" style={{ width: `${band}%` }} />
            <span
              className="h-full bg-butter-soft"
              style={{ width: `${99 - band}%` }}
            />
            <span className="h-full flex-1 bg-heat-2" />
          </div>
          {ticks.map((p) => (
            <span
              key={p}
              className="absolute top-0.5 h-5 w-1 -translate-x-1/2 rounded-full bg-butter-press"
              style={{ left: `${p}%` }}
            />
          ))}
          <motion.div
            className="absolute top-1/2 left-0 h-2 -translate-y-1/2 rounded-l-full bg-ink/10"
            style={{ width: left }}
          />
          <motion.span
            className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-ink bg-white shadow-soft"
            style={{ left }}
            animate={{ scale: dragging ? 1.15 : 1 }}
            transition={spring}
          />
        </div>
        {!compact && (
          <div
            aria-hidden
            className="relative mt-1 h-4 text-[11px] font-semibold text-sub"
          >
            <span className="absolute left-0">① 같은 곳, 다른 때</span>
            <span
              className="absolute -translate-x-1/2 text-[#B88A00]"
              style={{ left: `${(band + 100) / 2}%` }}
            >
              ② 스친 순간
            </span>
            <span className="absolute right-0 text-success">③</span>
          </div>
        )}
      </div>
    </div>
  );
}
