"use client";

import {
  ArrowRightIcon,
  HourglassIcon,
  RotateCwIcon,
  SendIcon,
  SparkleIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Chip, TextField } from "@/features/ui/controls";
import { blink, press, spring } from "@/features/ui/motion";
import { cn } from "@/lib/utils";
import type { Chat } from "../contract";
import { type ChatMessage, type Room, suggestedQuestions } from "../mock";

const ICON = { size: 14, strokeWidth: 2 } as const;
// Stretches a pill's hit area to 44px tall without changing how it looks.
const HIT = "relative after:absolute after:inset-x-0";
const enter = {
  initial: { opacity: 0, y: 16, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: spring,
};

/** 09 채팅 tab body. `onEvidence(i)` opens moment i's replay card. */
export function ChatPanel({
  room,
  chat,
  onEvidence,
}: {
  room: Room;
  chat: Chat;
  onEvidence: (momentIndex: number) => void;
}) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const busy = chat.typing || chat.limited;

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on each new message or typing indicator
  useEffect(() => {
    const el = listRef.current;
    el?.scrollTo({
      top: el.scrollHeight,
      behavior: reduce ? "auto" : "smooth",
    });
  }, [chat.messages.length, chat.typing]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-end">
        <span className="tnum text-[11px] font-semibold text-sub">
          오늘 {chat.usedToday}/{room.chat.limit}
        </span>
      </div>

      <div
        ref={listRef}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-3 md:min-h-[360px]"
      >
        <Bubble from="ai">안녕! 우리 기록에 대해 뭐든 물어봐</Bubble>
        <div className="flex flex-col items-start gap-2 pl-9">
          {suggestedQuestions.map((q) => (
            <Chip
              key={q}
              disabled={busy}
              onClick={() => chat.ask(q)}
              className={cn(
                HIT,
                "after:-inset-y-1 disabled:pointer-events-none",
              )}
            >
              <SparkleIcon {...ICON} className="text-butter-press" />
              {q}
            </Chip>
          ))}
        </div>

        <div aria-live="polite" className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {chat.messages.map((m) => (
              <motion.div
                key={m.id}
                {...enter}
                style={{ originX: m.role === "user" ? 1 : 0 }}
              >
                <Message
                  m={m}
                  // The moment may be gone (empty / no-moments rooms): no dead replay link.
                  replayable={
                    m.evidence !== undefined && m.evidence < room.moments.length
                  }
                  onEvidence={onEvidence}
                  onRetry={chat.retry}
                />
              </motion.div>
            ))}
            {chat.typing && (
              <motion.div
                key="typing"
                {...enter}
                style={{ originX: 0 }}
                className="flex items-center gap-2"
              >
                <AiAvatar />
                <span className="flex gap-1 rounded-[20px] border border-line bg-white px-4 py-3.5">
                  <span className="sr-only">답을 쓰는 중</span>
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      aria-hidden
                      {...blink(i * 0.2)}
                      className="size-1.5 rounded-full bg-sub"
                    />
                  ))}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {chat.limited && (
        <motion.div
          {...enter}
          className="mb-3 flex items-center gap-3 rounded-[16px] bg-butter-soft px-4 py-3"
        >
          <HourglassIcon size={20} strokeWidth={2} className="shrink-0" />
          <p className="text-[14px] font-semibold">
            오늘은 여기까지! 내일 또 이야기하자
          </p>
        </motion.div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim() || busy) return;
          chat.ask(draft);
          setDraft("");
        }}
      >
        <TextField
          aria-label="우리 기록에 대해 물어볼 내용"
          placeholder={
            chat.limited
              ? "내일 다시 물어볼 수 있어"
              : "우리 기록에 대해 물어봐"
          }
          enterKeyHint="send"
          maxLength={200}
          autoComplete="off"
          disabled={chat.limited}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className={cn("pr-1.5", chat.limited && "opacity-70")}
          icon={
            <motion.button
              type="submit"
              aria-label="보내기"
              disabled={chat.limited}
              {...press}
              className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-butter text-ink transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:pointer-events-none disabled:bg-line disabled:text-disabled"
            >
              <SendIcon size={20} strokeWidth={2} />
            </motion.button>
          }
        />
      </form>
    </div>
  );
}

function AiAvatar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-full bg-butter-soft text-[10px] font-extrabold",
        className,
      )}
    >
      AI
    </span>
  );
}

function Bubble({
  from,
  children,
}: {
  from: "me" | "ai";
  children: ReactNode;
}) {
  if (from === "me")
    return (
      <div className="flex justify-end">
        <p className="max-w-[78%] rounded-[20px] rounded-br-[6px] bg-a-soft px-4 py-3 text-[15px] leading-normal font-medium text-ink">
          {children}
        </p>
      </div>
    );
  return (
    <div className="flex items-start gap-2">
      <AiAvatar className="mt-1" />
      <div className="max-w-[82%] rounded-[20px] rounded-tl-[6px] border border-line bg-white px-4 py-3 text-[15px] leading-normal font-medium">
        {children}
      </div>
    </div>
  );
}

function Message({
  m,
  replayable,
  onEvidence,
  onRetry,
}: {
  m: ChatMessage;
  replayable: boolean;
  onEvidence: (momentIndex: number) => void;
  onRetry: () => void;
}) {
  const { evidence } = m;
  if (m.role === "user") return <Bubble from="me">{m.text}</Bubble>;
  const pill = cn(
    HIT,
    "after:-inset-y-1.5 mt-2.5 flex h-8 items-center rounded-full px-3 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ink",
  );
  return (
    <Bubble from="ai">
      {m.error ? (
        <span className="flex items-start gap-1.5">
          <TriangleAlertIcon
            size={18}
            strokeWidth={2}
            className="mt-0.5 shrink-0 text-error"
          />
          {m.text}
        </span>
      ) : (
        m.text
      )}
      {replayable && evidence !== undefined && (
        <motion.button
          type="button"
          {...press}
          onClick={() => onEvidence(evidence)}
          className={cn(pill, "gap-1 bg-butter-soft text-ink")}
        >
          이 순간 리플레이에서 보기
          <ArrowRightIcon {...ICON} />
        </motion.button>
      )}
      {m.error && (
        <motion.button
          type="button"
          {...press}
          onClick={onRetry}
          className={cn(pill, "gap-1.5 bg-muted")}
        >
          <RotateCwIcon {...ICON} />
          다시 시도
        </motion.button>
      )}
    </Bubble>
  );
}
