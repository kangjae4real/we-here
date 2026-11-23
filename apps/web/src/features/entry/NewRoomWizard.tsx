"use client";

import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  Share2Icon,
} from "lucide-react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type ChangeEvent,
  type ComponentProps,
  useEffect,
  useId,
  useState,
} from "react";
import { Button, IconButton, LinkBox, TextField } from "@/features/ui/controls";
import { Toast } from "@/features/ui/feedback";
import { GhostMark, Mark } from "@/features/ui/marks";
import {
  easeOut,
  easeOutCubic,
  march,
  spring,
  useLoop,
} from "@/features/ui/motion";
import { cn } from "@/lib/utils";
import { Onboard } from "./Onboard";

const STEPS = [
  { q: "방 이름 지어줘", hint: "둘만 알아보면 돼" },
  { q: "너는 뭐라고 부를까?", hint: "상대에게 이 이름으로 보여" },
  { q: "우리 처음 만난 날은?", hint: "이날 전의 순간을 찾아볼게" },
] as const;

/** Forward slides in from the right, back from the left. */
const slide: Variants = {
  enter: (dir: number) => ({ x: dir * 48, opacity: 0 }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.28, ease: easeOutCubic },
  },
  exit: (dir: number) => ({
    x: dir * -48,
    opacity: 0,
    transition: { duration: 0.16, ease: easeOut },
  }),
};

/**
 * `?step=` values; the step lives in the URL so the OS back gesture walks back one step.
 * Native pushState/replaceState sync with useSearchParams without a server round-trip.
 */
const STEP_PARAM = ["", "1", "2", "invite"];
const href = (step: number) =>
  step ? `/new?step=${STEP_PARAM[step]}` : "/new";

/** 02a–02c: room name, my nickname, first-met date; then 03: invite. */
export function NewRoomWizard() {
  const router = useRouter();
  const id = useId();
  const [values, setValues] = useState(["", "", ""]);
  const urlStep = Math.max(
    0,
    STEP_PARAM.indexOf(useSearchParams().get("step") ?? ""),
  );
  // A reload or deep link loses the answers: show the first unanswered step and fix the URL.
  const missing = values.findIndex((v, i) => i < urlStep && !v.trim());
  const step = missing === -1 ? urlStep : missing;
  useEffect(() => {
    if (missing !== -1) history.replaceState(null, "", href(missing));
  }, [missing]);
  // Slide direction follows the URL, whether we pushed it or the user went back.
  const [prev, setPrev] = useState(step);
  const [dir, setDir] = useState(1);
  // Submitted step: read-only until the URL catches up and while it exits, so fast typing can't edit the old answer.
  const [sent, setSent] = useState(-1);
  if (step !== prev) {
    setPrev(step);
    setDir(step > prev ? 1 : -1);
    setSent(-1);
  }
  const value = values[step];
  const set = (v: string) =>
    setValues((vs) => vs.map((old, i) => (i === step ? v : old)));
  const field = {
    value,
    onChange: (e: ChangeEvent<HTMLInputElement>) => set(e.target.value),
    autoFocus: true,
    readOnly: sent === step,
    "aria-labelledby": `${id}-q`,
    "aria-describedby": `${id}-hint`,
  };

  return (
    <Onboard>
      <AnimatePresence mode="wait" initial={false} custom={dir}>
        {step < 3 ? (
          <motion.form
            key="form"
            custom={dir}
            variants={slide}
            exit="exit"
            className="relative flex flex-1 flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              if (!value.trim()) return;
              setSent(step);
              history.pushState(null, "", href(step + 1));
            }}
          >
            <div className="mb-10 flex items-center justify-between">
              <IconButton
                label="뒤로"
                className="-ml-2.5"
                onClick={() => (step === 0 ? router.push("/") : history.back())}
              >
                <ArrowLeftIcon size={24} strokeWidth={2} />
              </IconButton>
              <Dots3 step={step} />
              <span className="w-10" />
            </div>
            {/* popLayout mounts (and autofocuses) the next field at once, so typing right after Enter lands there. */}
            <AnimatePresence mode="popLayout" initial={false} custom={dir}>
              <motion.div
                key={step}
                custom={dir}
                variants={slide}
                initial="enter"
                animate="center"
                exit="exit"
              >
                <p className="tnum text-[13px] font-semibold text-sub">
                  {step + 1} / 3
                </p>
                <h1 id={`${id}-q`} className="mt-1 text-[22px] font-bold">
                  {STEPS[step].q}
                </h1>
                <p
                  id={`${id}-hint`}
                  className="mt-1 text-[14px] font-medium text-sub"
                >
                  {STEPS[step].hint}
                </p>
                <div className="mt-8">
                  {step === 0 && (
                    <TextField
                      {...field}
                      placeholder="우리 둘의 지도"
                      maxLength={20}
                    />
                  )}
                  {step === 1 && (
                    <TextField
                      {...field}
                      placeholder="서연"
                      maxLength={10}
                      autoComplete="nickname"
                      icon={<Mark who="a" size={14} />}
                    />
                  )}
                  {step === 2 && (
                    // Today, local time (sv-SE formats as YYYY-MM-DD); also caps the year at 4 digits.
                    <DateField
                      {...field}
                      max={new Date().toLocaleDateString("sv-SE")}
                    />
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
            <div className="mt-auto pt-8">
              <Button type="submit" disabled={!value.trim()}>
                {step === 2 ? "방 만들기" : "다음"}
              </Button>
            </div>
          </motion.form>
        ) : (
          <motion.div
            key="invite"
            custom={dir}
            variants={slide}
            initial="enter"
            animate="center"
            className="flex flex-1 flex-col"
          >
            <Invite nick={values[1]} />
          </motion.div>
        )}
      </AnimatePresence>
    </Onboard>
  );
}

function Dots3({ step }: { step: number }) {
  return (
    <div aria-hidden className="flex gap-1.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          initial={false}
          animate={{
            width: i === step ? 24 : 8,
            backgroundColor:
              i <= step ? "var(--color-ink)" : "var(--color-line)",
          }}
          transition={spring}
          className="h-2 rounded-full"
        />
      ))}
    </div>
  );
}

/** Design DateField; the native date input is the visible control, so phones open their own picker. */
function DateField(input: Omit<ComponentProps<"input">, "type" | "className">) {
  return (
    <label className="flex h-14 w-full items-center gap-3 rounded-[14px] bg-muted px-4 -outline-offset-2 focus-within:outline-2 focus-within:outline-ink">
      <CalendarDaysIcon
        size={20}
        strokeWidth={2}
        aria-hidden
        className="shrink-0 text-sub"
      />
      <input
        type="date"
        {...input}
        onClick={(e) => e.currentTarget.showPicker?.()}
        // word-spacing collapses ko-KR "2024. 03. 02." toward the design's 2024.03.02.
        className={cn(
          "tnum h-full min-w-0 flex-1 cursor-pointer appearance-none bg-transparent text-left text-[16px] font-medium outline-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-date-and-time-value]:text-left [&::-webkit-datetime-edit-text]:[word-spacing:-0.35em]",
          input.value ? "text-ink" : "text-sub",
        )}
      />
      <ChevronDownIcon
        size={20}
        strokeWidth={2}
        aria-hidden
        className="shrink-0 text-sub"
      />
    </label>
  );
}

/** 03: share the invite link and wait for the other person. */
function Invite({ nick }: { nick: string }) {
  const router = useRouter();
  const loop = useLoop();
  const [toast, setToast] = useState<string | null>(null);
  // shortcut: every new room invites into the sample room; the real id comes from the create-room API.
  const url = `${location.origin}/r/sample/join`;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setToast("링크를 복사했어");
      return true;
    } catch {
      setToast("복사가 안 됐어. 링크를 길게 눌러 복사해줘");
      return false;
    }
  };

  const send = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "we-here", url });
      } catch {
        return; // closed the share sheet
      }
    } else if (!(await copy())) return;
    // shortcut: "waiting" is the fixture room where the partner hasn't joined yet.
    router.push("/r/waiting");
  };

  return (
    <>
      <h1 className="text-[22px] font-bold">이제 상대를 불러줘</h1>
      <p className="mt-1 text-[14px] font-medium text-sub">
        링크를 받은 한 명만 들어올 수 있어
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <LinkBox url={url.replace(/^https?:\/\//, "")} onCopy={copy} />
        <Button
          kind="secondary"
          icon={<Share2Icon size={20} strokeWidth={2} />}
          onClick={copy}
        >
          링크 복사
        </Button>
      </div>
      <div className="mt-10 flex flex-col items-center rounded-[20px] border border-line bg-white px-5 py-6">
        <div aria-hidden className="flex items-center gap-4">
          <span className="grid size-12 place-items-center rounded-full bg-a text-[16px] font-bold text-white">
            {nick.slice(0, 1)}
          </span>
          <svg
            width="56"
            height="4"
            aria-hidden="true"
            className="text-disabled"
          >
            <motion.line
              x1="2"
              y1="2"
              x2="54"
              y2="2"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="2 6"
              strokeLinecap="round"
              {...loop(march)}
            />
          </svg>
          <span className="grid size-12 place-items-center">
            <GhostMark className="size-9 rounded-[10px]" />
          </span>
        </div>
        <p className="mt-4 text-[14px] font-semibold text-sub">
          상대가 들어오길 기다리는 중…
        </p>
      </div>
      <div className="mt-auto pt-6">
        <Button onClick={send}>상대에게 링크 보내기</Button>
      </div>
      <div className="pointer-events-none fixed inset-x-5 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-50 md:right-[60px] md:left-auto md:w-[400px]">
        <AnimatePresence>
          {toast && (
            <Toast key={toast} className="pointer-events-auto">
              {toast}
            </Toast>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
