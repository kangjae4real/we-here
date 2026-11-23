import type { MotionValue } from "motion/react";
import type { LatLng } from "./mock";

// Shared contract between the room shell (RoomScreen) and the feature panels.
// Change a type here only together with every component that consumes it.

export type TabId = "record" | "replay" | "heat" | "chat";
export const TABS: readonly { id: TabId; label: string }[] = [
  { id: "record", label: "기록" },
  { id: "replay", label: "리플레이" },
  { id: "heat", label: "히트맵" },
  { id: "chat", label: "채팅" },
];

/** Mobile bottom sheet heights (design frame 844px tall: 120 / 420 / 760). */
export type SheetState = "collapsed" | "mid" | "full";

/** 07a 가까워지는 중 → 07b 반짝 → 07c 스친 순간 카드. */
export type MomentPhase = "approach" | "pop" | "on";
export type ActiveMoment = { index: number; phase: MomentPhase };

/** Everything the map draws. RoomScreen derives it from tab / replay / heat state. */
export type MapScene = {
  /** Photo dots: everyone, only A (B not joined yet), or none (empty room). */
  dots: "all" | "a" | "none";
  /** Green "함께 간 곳" heat blobs (히트맵 tab). Dots dim under it. */
  heat: boolean;
  /** Blinking dashed B diamond: the partner hasn't joined (S2). */
  ghostB: boolean;
  /** Fly the camera here (selected heat place). null = fit the overview. */
  focus: LatLng | null;
  /** Replay encounter. Hides regular dots and frames both shots. */
  moment: ActiveMoment | null;
};

/** Screen px covered by floating UI; the camera centers in the free area. */
export type MapInset = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

/** Replay state machine, owned by `useReplay` (replay/useReplay.ts). */
export type Replay = {
  /** Timeline position, 0–100. Commits once per month while playing. */
  pct: number;
  /** Frame-accurate position for things that move continuously (slider thumb). */
  pctValue: MotionValue<number>;
  playing: boolean;
  toggle: () => void;
  seek: (pct: number) => void;
  /** Non-null while an encounter sequence or card is showing. */
  moment: ActiveMoment | null;
  /** Jump straight to the card for moment `index` (chat evidence, moment list). */
  openMoment: (index: number) => void;
  /** Card CTA: next moment, or back to the start after the last one. */
  nextMoment: () => void;
  /** "여기서 더 둘러볼래": close the card, stay on the replay tab. */
  closeMoment: () => void;
};

/** Chat state, owned by `useChat` (chat/useChat.ts) so it survives tab switches. */
export type Chat = {
  messages: import("./mock").ChatMessage[];
  typing: boolean;
  ask: (question: string) => void;
  retry: () => void;
  usedToday: number;
  limited: boolean;
};
