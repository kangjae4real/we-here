"use client";

import { motion } from "motion/react";
import { Button } from "@/features/ui/controls";
import { Logo } from "@/features/ui/marks";
import { rise } from "@/features/ui/motion";
import { useIsDesktop } from "@/features/ui/useIsDesktop";
import { HeroArt, Onboard } from "./Onboard";

/** 01: landing. On mobile the hero art fills the space between the logo and the copy. */
export function Landing() {
  const isDesktop = useIsDesktop();
  return (
    <Onboard>
      <div className="md:hidden">
        <Logo />
      </div>
      <motion.div
        variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
        className="relative -mx-5 mt-5 min-h-56 flex-1 overflow-hidden md:hidden"
      >
        {!isDesktop && <HeroArt />}
      </motion.div>
      <motion.h1
        variants={rise}
        className="mt-7 text-[32px] leading-[1.3] font-extrabold tracking-[-0.02em] md:mt-24"
      >
        우리, 만나기 전에도
        <br />
        스쳤을까?
      </motion.h1>
      <motion.p
        variants={rise}
        className="mt-3 text-[16px] leading-normal font-medium text-sub"
      >
        사진만 고르면 같은 때 같은 곳에
        <br />
        있었던 순간을 찾아줄게
      </motion.p>
      <motion.div variants={rise} className="mt-auto pt-8">
        <Button href="/new">우리 방 만들기</Button>
        <p className="mt-3 text-center text-[13px] font-medium text-sub">
          사진 원본은 서버에 안 올라가
        </p>
      </motion.div>
    </Onboard>
  );
}
