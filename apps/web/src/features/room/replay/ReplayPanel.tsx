"use client";

import { ChevronRightIcon, SparkleIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { Button, ChapterBadge } from "@/features/ui/controls";
import { EmptyBlock } from "@/features/ui/feedback";
import { press } from "@/features/ui/motion";
import { cn } from "@/lib/utils";
import type { Replay } from "../contract";
import type { Room } from "../mock";
import { TimeSlider } from "./TimeSlider";
import { timeline } from "./useReplay";

type Props = { room: Room; replay: Replay };

// The design keeps the ② band at its sample position (2022.04) when no moment marks it.
const NO_MOMENT_BAND = 60;

function Slider({ room, replay, compact }: Props & { compact?: boolean }) {
  const t = timeline(room);
  return (
    <TimeSlider
      pct={replay.pct}
      value={replay.pctValue}
      playing={replay.playing}
      onToggle={replay.toggle}
      onSeek={replay.seek}
      step={t.step}
      ticks={t.stops}
      band={t.stops[0] ?? NO_MOMENT_BAND}
      valueText={t.label(replay.pct)}
      compact={compact}
    />
  );
}

/** 07 리플레이 tab body (mid sheet / desktop panel). S4 when there are no moments. */
export function ReplayPanel({
  room,
  replay,
  onTogether,
}: Props & { onTogether: () => void }) {
  if (room.moments.length === 0) {
    return (
      <>
        <Slider room={room} replay={replay} compact />
        <div className="mt-6 md:mt-[120px]">
          <EmptyBlock
            icon={<SparkleIcon size={24} strokeWidth={2} />}
            title="아쉽게 스친 순간은 없었어"
            desc={`대신 같은 곳에 다른 날 있었던 기록이 ${room.samePlaceCount}개야`}
          >
            <Button
              onClick={() => {
                replay.seek(0);
                if (!replay.playing) replay.toggle();
              }}
            >
              ① 같은 곳, 다른 때 보기
            </Button>
            <Button kind="secondary" onClick={onTogether}>
              ③ 함께한 기억 보기
            </Button>
          </EmptyBlock>
        </div>
      </>
    );
  }

  // Desktop with the card open (07c): the card takes the chapter list's room.
  const carded = replay.moment?.phase === "on";
  return (
    <>
      <p className="tnum mb-3 text-[18px] font-bold">
        {timeline(room).label(replay.pct)}
      </p>
      <Slider room={room} replay={replay} />
      {!carded && (
        <>
          <p className="mt-6 mb-2 text-[14px] font-semibold text-sub">챕터</p>
          <ChapterList room={room} replay={replay} onTogether={onTogether} />
        </>
      )}
      <div className="hidden md:block">
        <p className="mt-6 mb-2 text-[14px] font-semibold text-sub">
          ② 스친 순간
        </p>
        <MomentList room={room} replay={replay} />
      </div>
      {!replay.moment && (
        <p className="mt-4 text-center text-[13px] font-medium text-sub">
          재생을 누르면 첫 스친 순간까지 가
        </p>
      )}
    </>
  );
}

function ChapterList({
  room,
  replay,
  onTogether,
}: Props & { onTogether: () => void }) {
  const items = [
    {
      n: 1 as const,
      title: "같은 곳, 다른 때",
      value: `${room.samePlaceCount}곳`,
      tone: "muted" as const,
      go: () => replay.seek(0),
    },
    {
      n: 2 as const,
      title: "스친 순간",
      value: `${room.moments.length}번`,
      tone: "butter" as const,
      go: () => replay.openMoment(0),
    },
    {
      n: 3 as const,
      title: "함께한 기억",
      value: `${room.firstMet}부터`,
      tone: "mint" as const,
      go: onTogether,
    },
  ];
  return (
    <div className="flex flex-col gap-2">
      {items.map((it) => (
        <motion.button
          key={it.n}
          type="button"
          {...press}
          onClick={it.go}
          className="flex h-14 items-center gap-3 rounded-[16px] bg-muted/70 px-4 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ink"
        >
          <ChapterBadge n={it.n} tone={it.tone}>
            {it.title}
          </ChapterBadge>
          <span className="flex-1" />
          <span className="tnum text-[14px] font-semibold text-sub">
            {it.value}
          </span>
          <ChevronRightIcon
            size={18}
            strokeWidth={2}
            className="text-disabled"
          />
        </motion.button>
      ))}
    </div>
  );
}

/** Desktop list of 스친 순간; the active one is butter. */
function MomentList({ room, replay }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {room.moments.map((m, i) => {
        const active = replay.moment?.index === i;
        return (
          <motion.button
            key={m.id}
            type="button"
            {...press}
            aria-current={active || undefined}
            onClick={() => replay.openMoment(i)}
            className={cn(
              "flex items-center gap-3 rounded-[16px] border p-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ink",
              active
                ? "border-butter bg-butter-soft"
                : "border-line hover:bg-muted/60",
            )}
          >
            <span className="relative h-12 w-[68px] shrink-0">
              <Image
                src={m.a.photo}
                alt=""
                width={44}
                height={44}
                className="absolute top-0 left-0 size-11 -rotate-6 rounded-[8px] border-2 border-white object-cover shadow-soft"
              />
              <Image
                src={m.b.photo}
                alt=""
                width={44}
                height={44}
                className="absolute top-1 right-0 size-11 rotate-6 rounded-[8px] border-2 border-white object-cover shadow-soft"
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold">{m.place}</span>
              <span className="tnum block text-[13px] font-medium text-sub">
                {m.date} {m.a.time}
              </span>
            </span>
            <span className="tnum shrink-0 text-right text-[13px] font-bold">
              {m.distanceM}m
              <span className="block font-medium text-sub">
                {m.minutesApart}분 차이
              </span>
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

/** Collapsed-sheet body while an encounter plays (07a/07b). */
export function CollapsedReplay({ room, replay }: Props) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <Slider room={room} replay={replay} compact />
      </div>
      <span className="tnum shrink-0 text-[13px] font-bold">
        {timeline(room).short(replay.pct)}
      </span>
    </div>
  );
}

/** Dark chip over the map: "가까워지는 중…" / "반짝! 스친 순간 발견". */
export function MomentChip({ room, replay }: Props) {
  const m = replay.moment;
  const phase = m && m.phase !== "on" ? m.phase : null;
  return (
    // Desktop: centered over the map, right of the 24px-inset 400px panel.
    <output className="pointer-events-none absolute top-[calc(132px+env(safe-area-inset-top))] left-1/2 z-10 -translate-x-1/2 md:top-24 md:left-[calc(50%+212px)]">
      <AnimatePresence>
        {m && phase && (
          <motion.div
            layout
            initial={{ opacity: 0, y: -8, scale: 0.9 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: phase === "pop" ? [1, 1.1, 1] : 1,
            }}
            exit={{ opacity: 0, y: -8, scale: 0.9 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex h-9 items-center gap-2 overflow-hidden rounded-full bg-ink px-4 text-[13px] font-semibold whitespace-nowrap text-white shadow-soft"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={phase}
                layout="position"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {phase === "approach"
                  ? `${room.moments[m.index]?.date.slice(0, 10)} · 가까워지는 중…`
                  : "반짝! 스친 순간 발견"}
              </motion.span>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </output>
  );
}
