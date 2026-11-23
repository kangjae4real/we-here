"use client";

import { animate, motion, type PanInfo, useMotionValue } from "motion/react";
import {
  type ReactNode,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { sheetSpring } from "@/features/ui/motion";
import { cn } from "@/lib/utils";
import type { SheetState } from "../contract";
import { SwapBody } from "./chrome";

/** Viewport height plus the notch / home-indicator insets, in px. `ready` once measured on the client. */
type Viewport = { h: number; top: number; bottom: number; ready: boolean };

// Design frame: 390×844 with no insets.
const SERVER: Viewport = { h: 844, top: 0, bottom: 0, ready: false };
let viewport = SERVER;

function measure() {
  // env() can't be read from JS directly, so resolve it on a throwaway element.
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;visibility:hidden;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)";
  document.body.append(probe);
  const style = getComputedStyle(probe);
  viewport = {
    h: window.innerHeight,
    top: Number.parseFloat(style.paddingTop) || 0,
    bottom: Number.parseFloat(style.paddingBottom) || 0,
    ready: true,
  };
  probe.remove();
}

function subscribe(onChange: () => void) {
  const update = () => {
    measure();
    onChange();
  };
  update();
  window.addEventListener("resize", update);
  return () => window.removeEventListener("resize", update);
}

export function useViewport() {
  return useSyncExternalStore(
    subscribe,
    () => viewport,
    () => SERVER,
  );
}

export type SheetHeights = Record<SheetState, number>;

/** 120 / 420 / 760 on the 844px design frame; full stops 84px under the top bar. */
export function sheetHeights(v: Viewport): SheetHeights {
  return {
    collapsed: 120 + v.bottom,
    mid: Math.round((v.h * 420) / 844),
    full: v.h - v.top - 84,
  };
}

const ORDER: SheetState[] = ["collapsed", "mid", "full"];
const NEXT: Record<SheetState, SheetState> = {
  collapsed: "mid",
  mid: "full",
  full: "collapsed",
};

/** Mobile bottom sheet. Non-modal; drag the header to resize, it snaps with velocity. */
export function Sheet({
  heights,
  ready,
  state,
  onState,
  hidden,
  header,
  bodyKey,
  children,
}: {
  heights: SheetHeights;
  /** Heights come from a real measurement (false on the server and during hydration). */
  ready: boolean;
  state: SheetState;
  onState: (s: SheetState) => void;
  /** Slid away under the 07c moment card. */
  hidden: boolean;
  header: ReactNode;
  bodyKey: string;
  children: ReactNode;
}) {
  const target = heights[state];
  const h = useMotionValue(target);
  const start = useRef(0);
  const panned = useRef(false);
  const placed = useRef(false);

  useLayoutEffect(() => {
    if (!ready) return;
    // First real measurement: take over from the CSS height without springing.
    if (!placed.current) {
      placed.current = true;
      h.jump(target);
      return;
    }
    const anim = animate(h, target, sheetSpring);
    return () => anim.stop();
  }, [h, target, ready]);

  function drag(info: PanInfo) {
    const raw = start.current - info.offset.y;
    const lo = heights.collapsed;
    const hi = heights.full;
    // Rubber-band past the ends instead of a hard stop.
    h.set(
      raw < lo
        ? lo - (lo - raw) * 0.25
        : raw > hi
          ? hi + (raw - hi) * 0.25
          : raw,
    );
  }

  function release(info: PanInfo) {
    const projected = h.get() - info.velocity.y * 0.2;
    const next = ORDER.reduce((a, b) =>
      Math.abs(heights[b] - projected) < Math.abs(heights[a] - projected)
        ? b
        : a,
    );
    if (next === state) animate(h, target, sheetSpring);
    else onState(next);
  }

  return (
    <motion.section
      aria-label="방 패널"
      inert={hidden}
      initial={false}
      animate={{ y: hidden ? "110%" : 0 }}
      transition={sheetSpring}
      // Until measured, CSS sizes the mid sheet so the first paint already fits this phone.
      style={{ height: ready ? h : undefined }}
      className="absolute inset-x-0 bottom-0 z-20 flex h-[calc(100dvh*420/844)] flex-col rounded-t-[28px] bg-white shadow-[0_-8px_24px_rgb(25_31_40/0.08)] md:hidden"
    >
      <motion.div
        onClickCapture={(e) => {
          // A drag that ends on a tab or the handle must not also click it.
          if (panned.current) e.stopPropagation();
        }}
        onPanStart={() => {
          panned.current = true;
          h.stop();
          start.current = h.get();
        }}
        onPan={(_, info) => drag(info)}
        onPanEnd={(_, info) => {
          release(info);
          // The click that follows pointerup lands before this timer.
          setTimeout(() => {
            panned.current = false;
          });
        }}
        style={{ touchAction: "none" }}
        className="shrink-0 cursor-grab select-none active:cursor-grabbing"
      >
        <button
          type="button"
          aria-label="패널 높이 바꾸기"
          onClick={() => onState(NEXT[state])}
          // 44px hit area grown upward only, so it never covers the tabs or the flow's X below.
          className="group relative mx-auto flex h-5 w-24 items-center justify-center outline-none after:absolute after:inset-x-0 after:-top-6 after:bottom-0"
        >
          <span className="h-1 w-9 rounded-full bg-line transition-colors group-hover:bg-disabled group-focus-visible:bg-ink" />
        </button>
        <div className={cn("px-5", state === "collapsed" ? "pb-2" : "pb-3")}>
          {header}
        </div>
      </motion.div>
      <SwapBody
        id={bodyKey}
        className={cn(
          "px-5",
          state === "collapsed"
            ? "pb-[max(8px,env(safe-area-inset-bottom))]"
            : "pb-[max(24px,env(safe-area-inset-bottom))]",
        )}
      >
        {children}
      </SwapBody>
    </motion.section>
  );
}
