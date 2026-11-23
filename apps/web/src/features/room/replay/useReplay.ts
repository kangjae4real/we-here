import { useMotionValue } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { ActiveMoment, Replay } from "../contract";
import type { Room } from "../mock";

// Design `Player`: 0.35% of the timeline every 30ms.
const SPEED = 0.35 / 30;
// Encounter beats, matching the map: 0.5s delay + 1.5s trail travel, then the ring pop.
const APPROACH_MS = 2000;
const POP_MS = 900;
/** Playback starts this many months before the first moment (design: 2021.09 → 2022.04). */
const LEAD_MONTHS = 7;

const monthIndex = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return y * 12 + m - 1;
};
const clamp = (p: number) => Math.min(100, Math.max(0, p));

/** Timeline geometry: `room.timeline.start` = 0%, `.end` = 100%, one step per month. */
export function timeline(room: Room) {
  const first = monthIndex(room.timeline.start);
  const months = Math.max(1, monthIndex(room.timeline.end) - first);
  const pctOf = (ym: string) => ((monthIndex(ym) - first) / months) * 100;
  const monthAt = (pct: number) => first + Math.round((pct / 100) * months);
  return {
    step: 100 / months,
    pctOf,
    stops: room.moments.map((m) => pctOf(m.month)),
    /** "2022년 4월" */
    label: (pct: number) => {
      const i = monthAt(pct);
      return `${Math.floor(i / 12)}년 ${(i % 12) + 1}월`;
    },
    /** "22.04" */
    short: (pct: number) => {
      const i = monthAt(pct);
      return `${String(Math.floor(i / 12) % 100).padStart(2, "0")}.${String((i % 12) + 1).padStart(2, "0")}`;
    },
  };
}

export function useReplay(room: Room): Replay {
  const { step, stops } = timeline(room);
  // No moments: the scan already ran to the end (S4 shows the thumb near 2024.01).
  const start =
    stops.length > 0
      ? clamp(stops[0] - LEAD_MONTHS * step)
      : clamp(100 - 2 * step);

  // React state commits once per month; the slider reads `pos` every frame.
  const [pct, setPct] = useState(start);
  const pos = useMotionValue(start);
  const [playing, setPlaying] = useState(false);
  const [moment, setMoment] = useState<ActiveMoment | null>(null);
  // The stop we are parked on, so resuming doesn't re-fire it but landing on a stop does.
  const lastHit = useRef<number | null>(null);
  const move = (p: number) => {
    pos.set(p);
    setPct(p);
  };

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // Clamped so a backgrounded tab doesn't jump the timeline on return.
      const dt = Math.max(0, Math.min(100, now - last));
      last = now;
      const from = pos.get();
      const to = Math.min(100, from + dt * SPEED);
      // Moments sharing a month share a stop: at the parked position only later indices fire.
      const hit = stops.findIndex(
        (s, i) =>
          to >= s && (from < s || (from === s && i > (lastHit.current ?? -1))),
      );
      if (hit >= 0) {
        lastHit.current = hit;
        pos.set(stops[hit]);
        setPct(stops[hit]);
        setPlaying(false);
        setMoment({ index: hit, phase: "approach" });
        return;
      }
      pos.set(to);
      if (to >= 100) {
        setPct(to);
        return setPlaying(false);
      }
      if (Math.round(to / step) !== Math.round(from / step)) setPct(to);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, stops, step, pos]);

  // approach → pop → on
  useEffect(() => {
    if (!moment || moment.phase === "on") return;
    const { index, phase } = moment;
    const id = setTimeout(
      () => setMoment({ index, phase: phase === "approach" ? "pop" : "on" }),
      phase === "approach" ? APPROACH_MS : POP_MS,
    );
    return () => clearTimeout(id);
  }, [moment]);

  const openMoment = (index: number) => {
    if (stops[index] == null) return;
    lastHit.current = index;
    setPlaying(false);
    move(stops[index]);
    setMoment({ index, phase: "on" });
  };

  return {
    pct,
    pctValue: pos,
    playing,
    moment,
    toggle: () => {
      if (playing) {
        setPct(pos.get());
        return setPlaying(false);
      }
      if (pos.get() >= 100) {
        lastHit.current = null;
        move(start);
      }
      setMoment(null);
      setPlaying(true);
    },
    seek: (p) => {
      lastHit.current = null;
      setMoment(null);
      move(clamp(p));
    },
    openMoment,
    nextMoment: () => {
      const next = (moment?.index ?? -1) + 1;
      if (next < stops.length) return openMoment(next);
      lastHit.current = null;
      setPlaying(false);
      setMoment(null);
      move(start);
    },
    closeMoment: () => setMoment(null),
  };
}
