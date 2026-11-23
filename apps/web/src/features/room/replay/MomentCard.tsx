"use client";

import { MapPinIcon } from "lucide-react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import Image from "next/image";
import { useEffect, useId, useRef } from "react";
import { Button, ChapterBadge } from "@/features/ui/controls";
import { Name, Sparkles, type Who } from "@/features/ui/marks";
import { easeOutCubic, fly, rise } from "@/features/ui/motion";
import { cn } from "@/lib/utils";
import type { Replay } from "../contract";
import type { Room } from "../mock";

/** 07c/07d 스친 순간 card. Re-keyed per moment so "다음 순간 보기" replays the entrance. */
export function MomentCard({ room, replay }: { room: Room; replay: Replay }) {
  const i = replay.moment?.index;
  if (i == null || !room.moments[i]) return null;
  return <Card key={i} room={room} replay={replay} i={i} />;
}

function Card({ room, replay, i }: { room: Room; replay: Replay; i: number }) {
  const m = room.moments[i];
  const last = i === room.moments.length - 1;
  const names = { a: room.a.nickname, b: room.b?.nickname ?? "" };
  const id = useId();
  const ref = useRef<HTMLElement>(null);
  // The opener is gone (inert sheet / unmounted list), so land keyboard and SR users here; preventScroll keeps short screens from clipping the badge.
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);
  return (
    <motion.section
      ref={ref}
      tabIndex={-1}
      aria-labelledby={`${id}-badge ${id}-title`}
      variants={rise}
      initial="hidden"
      animate="show"
      className="rounded-[28px] bg-white p-6 shadow-soft outline-none md:mb-6 md:border md:border-line md:p-5"
    >
      <div id={`${id}-badge`} className="flex justify-center">
        <ChapterBadge n={2}>
          스친 순간 · {i + 1}/{room.moments.length}
        </ChapterBadge>
      </div>
      {/* The 308px pair outgrows a 320px phone's 240px card body: scale it to fit there. */}
      <div className="relative mt-4 flex h-[204px] justify-center max-[359px]:h-[156px] max-[359px]:origin-top max-[359px]:scale-[0.76]">
        <Polaroid
          who="a"
          name={names.a}
          src={m.a.photo}
          time={m.a.time}
          alt={`${names.a}의 ${m.place} 사진`}
          className="relative z-[1]"
        />
        <Polaroid
          who="b"
          name={names.b}
          src={m.b.photo}
          time={m.b.time}
          alt={`${names.b}의 ${m.place} 사진`}
          className="relative z-[2] mt-3 -ml-3"
        />
        {/* `.pop`, timed to land as the polaroids settle */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.15, 1] }}
          transition={{ duration: 0.4, times: [0, 0.7, 1], delay: 0.55 }}
          className="absolute top-[-10px] left-1/2 z-[3] -translate-x-1/2"
        >
          <Sparkles className="size-12" />
        </motion.div>
      </div>
      <h2 id={`${id}-title`} className="mt-4 text-center text-[22px] font-bold">
        우리 여기서 스쳤을지도 몰라!
      </h2>
      <div className="mt-4 grid grid-cols-[1fr_1px_1fr] items-center">
        <Stat value={m.distanceM} unit="m" label="거리" />
        <span className="h-12 bg-line" />
        <Stat value={m.minutesApart} unit="분" label="시간 차이" />
      </div>
      <p className="tnum mt-4 flex flex-wrap items-center justify-center gap-x-1 text-center text-[16px] leading-normal font-medium tracking-[-0.02em] text-sub">
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          <MapPinIcon size={18} strokeWidth={2} className="shrink-0" />
          {m.place} ·
        </span>
        <span className="whitespace-nowrap">
          {m.date} {m.a.time}
        </span>
      </p>
      <div className="mt-5 flex flex-col gap-1">
        <Button onClick={replay.nextMoment}>
          {last ? "처음부터 다시 보기" : "다음 순간 보기"}
        </Button>
        <Button kind="text" size="md" onClick={replay.closeMoment}>
          여기서 더 둘러볼래
        </Button>
      </div>
    </motion.section>
  );
}

function Polaroid({
  who,
  name,
  src,
  time,
  alt,
  className,
}: {
  who: Who;
  name: string;
  src: string;
  time: string;
  alt: string;
  className: string;
}) {
  return (
    <motion.figure
      {...fly(who === "a" ? "l" : "r")}
      className={cn(
        "w-[160px] shrink-0 rounded-[12px] bg-white p-1.5 pb-0 shadow-[0_8px_24px_rgba(25,31,40,0.12)]",
        className,
      )}
    >
      <Image
        src={src}
        alt={alt}
        width={148}
        height={148}
        className="size-[148px] rounded-[8px] object-cover"
      />
      <figcaption className="flex h-8 items-center justify-center text-[14px] font-semibold">
        <Name who={who}>
          {name} <span className="tnum">{time}</span>
        </Name>
      </figcaption>
    </motion.figure>
  );
}

/** Count-up stat: 600ms ease-out cubic after the polaroids land (350ms). */
function Stat({
  value,
  unit,
  label,
}: {
  value: number;
  unit: string;
  label: string;
}) {
  const v = useMotionValue(0);
  const shown = useTransform(v, Math.round);
  useEffect(() => {
    const c = animate(v, value, {
      duration: 0.6,
      delay: 0.35,
      ease: easeOutCubic,
    });
    return () => c.stop();
  }, [v, value]);
  return (
    <div className="text-center">
      <p className="tnum text-[40px] leading-tight font-extrabold tracking-[-0.03em]">
        <motion.span>{shown}</motion.span>
        <span className="text-[24px]">{unit}</span>
      </p>
      <p className="text-[13px] font-medium text-sub">{label}</p>
    </div>
  );
}
