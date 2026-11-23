"use client";

import { HourglassIcon, UsersIcon } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/features/ui/controls";
import { Logo } from "@/features/ui/marks";
import { pop, rise } from "@/features/ui/motion";
import { Onboard } from "./Onboard";

const COPY = {
  full: {
    Icon: UsersIcon,
    title: "이 방은 이미 두 명이 꽉 찼어",
    desc: "둘만의 방이라 더는 못 들어와",
  },
  expired: {
    Icon: HourglassIcon,
    title: "이 방은 30일이 지나서 사라졌어",
    desc: "사진 기록도 함께 지워졌어",
  },
};

/** S7 방이 꽉 참 / S8 방 만료. */
export function GoneScreen({ kind }: { kind: "full" | "expired" }) {
  const { Icon, title, desc } = COPY[kind];
  return (
    <Onboard>
      <div className="md:hidden">
        <Logo />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.span
          variants={pop}
          className="mb-5 grid size-16 place-items-center rounded-full bg-muted"
        >
          <Icon size={28} strokeWidth={2} aria-hidden />
        </motion.span>
        <motion.h1 variants={rise} className="text-[22px] font-bold">
          {title}
        </motion.h1>
        <motion.p
          variants={rise}
          className="mt-1.5 text-[14px] font-medium text-sub"
        >
          {desc}
        </motion.p>
      </div>
      <motion.div variants={rise}>
        <Button href="/new">새 방 만들기</Button>
      </motion.div>
    </Onboard>
  );
}
