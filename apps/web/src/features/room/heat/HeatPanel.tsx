"use client";

import { ChevronRightIcon, MapPinIcon } from "lucide-react";
import { motion } from "motion/react";
import { useId } from "react";
import { EmptyBlock } from "@/features/ui/feedback";
import { press, rise, spring } from "@/features/ui/motion";
import { cn } from "@/lib/utils";
import type { Room } from "../mock";

const BADGE = [
  "bg-heat-3 text-white",
  "bg-heat-2 text-white",
  "bg-heat-1 text-[#0b7a4d]",
];

/** 08 히트맵 tab body. `selected` indexes room.topPlaces. */
export function HeatPanel({
  room,
  selected,
  onSelect,
}: {
  room: Room;
  selected: number | null;
  onSelect: (index: number | null) => void;
}) {
  const layoutId = useId();
  if (room.topPlaces.length === 0)
    return (
      <div className="pt-6">
        <EmptyBlock
          icon={<MapPinIcon size={24} strokeWidth={2} />}
          title="아직 함께 간 곳이 없어"
          desc="둘 다 같은 날 사진을 남긴 곳이 생기면 여기 보여줄게"
        />
      </div>
    );

  return (
    <div>
      <p className="text-[18px] font-bold">우리가 제일 많이 간 곳</p>
      <motion.ul
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.06 } } }}
        className="mt-3 flex flex-col gap-1"
      >
        {room.topPlaces.map((p, i) => {
          const on = selected === i;
          return (
            <motion.li key={p.rank} variants={rise}>
              <motion.button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(on ? null : i)}
                {...press}
                className={cn(
                  "relative flex h-14 w-full items-center gap-3 rounded-[16px] px-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ink",
                  !on && "hover:bg-muted",
                )}
              >
                {on && (
                  <motion.span
                    layoutId={layoutId}
                    transition={spring}
                    className="absolute inset-0 rounded-[16px] bg-heat-1"
                  />
                )}
                <span
                  className={cn(
                    "tnum relative z-10 grid size-8 place-items-center rounded-full text-[14px] font-extrabold",
                    BADGE[i] ?? BADGE[2],
                  )}
                >
                  {p.rank}
                </span>
                <span className="relative z-10 flex-1 text-[16px] font-semibold">
                  {p.name}
                </span>
                <span className="tnum relative z-10 text-[16px] font-bold">
                  {p.days}일
                </span>
                <ChevronRightIcon
                  size={18}
                  strokeWidth={2}
                  className="relative z-10 text-disabled"
                />
              </motion.button>
            </motion.li>
          );
        })}
      </motion.ul>
      <div className="mt-5 flex items-center gap-3 rounded-[16px] bg-muted/70 px-4 py-3">
        <span className="text-[13px] font-medium text-sub">조금</span>
        <span aria-hidden className="flex flex-1 gap-1">
          <span className="h-2.5 flex-1 rounded-full bg-heat-1" />
          <span className="h-2.5 flex-1 rounded-full bg-heat-2" />
          <span className="h-2.5 flex-1 rounded-full bg-heat-3" />
        </span>
        <span className="text-[13px] font-medium text-sub">자주</span>
      </div>
      <p className="mt-3 text-[13px] font-medium text-sub">
        둘 다 같은 날 사진을 남긴 곳만 세었어
      </p>
    </div>
  );
}
