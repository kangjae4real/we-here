"use client";

import {
  CalendarHeartIcon,
  ClockIcon,
  LogOutIcon,
  PencilIcon,
  UserMinusIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { IconButton } from "@/features/ui/controls";
import { ConfirmDialog } from "@/features/ui/feedback";
import { josa } from "@/features/ui/josa";
import { GhostMark, Name } from "@/features/ui/marks";
import type { Room } from "../mock";
import { Row } from "../shell/chrome";

/** 10 방 설정, with the 10a 자리 비우기 / 10b 방 나가기 confirms. */
export function SettingsPanel({ room }: { room: Room }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<"clear" | "leave" | null>(null);
  // shortcut: the new date lives in this panel only; persist it once the room API takes edits.
  const [firstMet, setFirstMet] = useState(room.firstMet);
  const dateInput = useRef<HTMLInputElement>(null);
  const b = room.b?.nickname;

  return (
    <>
      <div className="rounded-[20px] bg-butter-soft p-5">
        <p className="flex items-center gap-1.5 text-[14px] font-semibold text-sub">
          <CalendarHeartIcon size={18} strokeWidth={2} /> 처음 만난 날
        </p>
        <div className="mt-1 flex items-end justify-between">
          <p className="tnum text-[40px] leading-tight font-extrabold tracking-[-0.03em]">
            {firstMet}
          </p>
          <IconButton
            label="처음 만난 날 수정"
            onClick={() => dateInput.current?.showPicker()}
            className="mb-1 bg-white"
          >
            <PencilIcon size={18} strokeWidth={2} />
          </IconButton>
          <input
            ref={dateInput}
            type="date"
            tabIndex={-1}
            aria-hidden
            className="sr-only"
            value={firstMet.replaceAll(".", "-")}
            onChange={(e) =>
              e.target.value && setFirstMet(e.target.value.replaceAll("-", "."))
            }
          />
        </div>
        <p className="mt-1 text-[13px] font-medium text-sub">
          이날 전은 '스친 순간', 후는 '함께한 기억'이야
        </p>
      </div>

      <h3 className="mt-6 mb-1 text-[14px] font-semibold text-sub">우리 둘</h3>
      <div className="flex gap-2">
        <span className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[14px] bg-a-soft text-[14px] font-semibold">
          <Name who="a">{room.a.nickname}</Name>
          <span className="text-sub">(나)</span>
        </span>
        <span className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[14px] bg-b-soft text-[14px] font-semibold">
          {b ? (
            <Name who="b">{b}</Name>
          ) : (
            <>
              <GhostMark className="size-2.5 rounded-[3px]" />
              <span className="text-sub">아직 안 왔어</span>
            </>
          )}
        </span>
      </div>

      <div className="mt-5">
        <Row
          icon={<CalendarHeartIcon size={20} strokeWidth={2} />}
          label="처음 만난 날 바꾸기"
          onClick={() => dateInput.current?.showPicker()}
        />
        {b && (
          <Row
            icon={<UserMinusIcon size={20} strokeWidth={2} />}
            label={`${b} 자리 비우기`}
            onClick={() => setConfirm("clear")}
          />
        )}
        <Row
          icon={<LogOutIcon size={20} strokeWidth={2} />}
          label="방 나가기"
          tone="error"
          onClick={() => setConfirm("leave")}
        />
      </div>

      <div className="mt-5 flex items-center gap-2 rounded-[14px] bg-muted px-4 py-3">
        <ClockIcon size={18} strokeWidth={2} className="text-sub" />
        <p className="tnum text-[14px] font-medium text-sub">
          이 방은 <b className="font-bold text-ink">{room.expires}</b>에 사라져
        </p>
      </div>

      <ConfirmDialog
        open={confirm === "clear"}
        title={`${b} 자리를 비울까?`}
        desc={`${b}${josa(b ?? "", "이", "가")} 올린 사진도 같이 지워져.`}
        confirm="비우기"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => router.push("/r/waiting")}
      />
      <ConfirmDialog
        open={confirm === "leave"}
        title="방에서 나갈래?"
        desc="내가 올린 사진이 모두 지워져."
        confirm="나가기"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => router.push("/")}
      />
    </>
  );
}
