"use client";

import { motion } from "motion/react";
import { useParams, useRouter } from "next/navigation";
import { useId, useState } from "react";
import { getRoom } from "@/features/room/mock";
import { Button, TextField } from "@/features/ui/controls";
import { josa } from "@/features/ui/josa";
import { GhostMark, Mark } from "@/features/ui/marks";
import { rise } from "@/features/ui/motion";
import { GoneScreen } from "./GoneScreen";
import { Onboard } from "./Onboard";

/** 04: the invited person picks a nickname and enters. */
export function JoinScreen() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const [nick, setNick] = useState("");
  const id = useId();
  const room = getRoom(roomId);
  if (room.status !== "ok") return <GoneScreen kind={room.status} />;

  const a = room.a.nickname;
  return (
    <Onboard>
      <motion.form
        variants={rise}
        className="flex flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          // shortcut: the nickname isn't sent anywhere until the join API exists.
          if (nick.trim()) router.push(`/r/${roomId}`);
        }}
      >
        <div className="flex flex-col items-center text-center">
          <span
            aria-hidden
            className="relative mb-6 flex h-16 w-[120px] items-center justify-center"
          >
            <span className="absolute left-2 grid size-14 place-items-center rounded-full border-4 border-bg bg-a text-[18px] font-bold text-white">
              {a.slice(0, 1)}
            </span>
            <span className="absolute right-2 grid size-14 place-items-center">
              <GhostMark className="size-10 rounded-[11px]" />
            </span>
          </span>
          <p className="text-[16px] font-semibold text-sub">
            <span className="text-a">{a}</span>
            {josa(a, "이", "가")} 너를 초대했어
          </p>
          <h1 className="mt-1 text-[32px] leading-[1.3] font-extrabold">
            {room.name}
          </h1>
        </div>
        <div className="mt-12">
          <label
            htmlFor={`${id}-nick`}
            className="mb-2 block text-[14px] font-semibold"
          >
            너는 뭐라고 부를까?
          </label>
          <TextField
            id={`${id}-nick`}
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            placeholder="도윤"
            maxLength={10}
            autoComplete="nickname"
            aria-describedby={`${id}-hint`}
            icon={<Mark who="b" size={14} />}
          />
          <p
            id={`${id}-hint`}
            className="mt-2 text-[13px] font-medium text-sub"
          >
            너는 주황 마름모로 표시돼
          </p>
        </div>
        <div className="mt-auto pt-8">
          <Button type="submit" disabled={!nick.trim()}>
            입장하기
          </Button>
        </div>
      </motion.form>
    </Onboard>
  );
}
