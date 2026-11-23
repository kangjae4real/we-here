"use client";

import {
  CircleCheckIcon,
  ClockAlertIcon,
  ImagePlusIcon,
  MapPinOffIcon,
  SmartphoneIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { AnimatePresence, animate, motion } from "motion/react";
import { useEffect, useEffectEvent, useState } from "react";
import { Button } from "@/features/ui/controls";
import { Toast } from "@/features/ui/feedback";
import { josa } from "@/features/ui/josa";
import { Name } from "@/features/ui/marks";
import { easeOut, pop, press, rise } from "@/features/ui/motion";
import { useIsDesktop } from "@/features/ui/useIsDesktop";
import type { Room, UploadResult } from "../mock";
import { BigNumber, FloatingToast, type Notice } from "../shell/chrome";

type Step = "pick" | "reading" | "result";

/** 06a pick → 06b reading → 06c/06d result; on failure (S3) back to pick with a retry toast. */
export function UploadFlow({
  room,
  onDone,
}: {
  room: Room;
  onDone: () => void;
}) {
  const [step, setStep] = useState<Step>("pick");
  const [files, setFiles] = useState<File[]>([]);
  const [failed, setFailed] = useState<Notice | null>(null);
  const desktop = useIsDesktop();

  function read(picked: File[]) {
    setFiles(picked);
    setFailed(null);
    setStep("reading");
  }

  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 8 }}
          animate={{
            opacity: 1,
            y: 0,
            transition: { duration: 0.2, ease: easeOut },
          }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
        >
          {/* Mobile: inline at the top of the flow, where a floating toast would cover the sheet's handle and close button. */}
          {step === "pick" && failed && !desktop && (
            <Toast
              action={failed.action}
              onAction={failed.onAction}
              className="mb-4"
            >
              {failed.text}
            </Toast>
          )}
          {step === "pick" && <Pick who={room.a.nickname} onPick={read} />}
          {step === "reading" && (
            <Reading
              files={files}
              fails={!!room.upload.fails}
              onEnd={(ok) => {
                setStep(ok ? "result" : "pick");
                if (!ok)
                  setFailed({
                    text: "사진을 못 올렸어. 다시 해볼까?",
                    action: "다시 시도",
                    onAction: () => read(files),
                  });
              }}
            />
          )}
          {step === "result" && (
            <Result
              upload={room.upload}
              onHowTo={() => setStep("pick")}
              onDone={onDone}
            />
          )}
        </motion.div>
      </AnimatePresence>
      {desktop && (
        <FloatingToast notice={failed} onDismiss={() => setFailed(null)} />
      )}
    </>
  );
}

function Pick({
  who,
  onPick,
}: {
  who: string;
  onPick: (files: File[]) => void;
}) {
  return (
    <>
      <p className="mb-3 flex items-center gap-1.5 text-[14px] font-semibold text-sub">
        <Name who="a">{who}</Name>
        {josa(who, "으로", "로")} 올리는 중
      </p>
      <motion.label
        {...press}
        className="flex h-[180px] w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-[20px] bg-butter transition-colors hover:bg-butter-press has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink has-[:focus-visible]:ring-offset-2"
      >
        <input
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => {
            const picked = [...(e.target.files ?? [])];
            // Reset so picking the same photos again still fires onChange.
            e.target.value = "";
            if (picked.length) onPick(picked);
          }}
        />
        <span className="grid size-14 place-items-center rounded-full bg-white/60">
          <ImagePlusIcon size={28} strokeWidth={2} />
        </span>
        <span className="text-[18px] font-bold">사진 고르기</span>
      </motion.label>
      <div className="mt-4 rounded-[20px] bg-muted p-4">
        <div className="flex items-start gap-3">
          <SmartphoneIcon
            size={22}
            strokeWidth={2}
            className="mt-0.5 shrink-0"
          />
          <div className="flex-1">
            <p className="text-[14px] font-semibold">아이폰이라면 꼭!</p>
            <p className="mt-0.5 text-[14px] leading-normal font-medium text-sub">
              사진 고를 때 '옵션' → '위치 포함'을 켜줘
            </p>
          </div>
        </div>
        {/* Picture of the iOS photo-picker switch, not a control. */}
        <div
          aria-hidden
          className="mt-3 flex items-center justify-between rounded-[14px] bg-white px-4 py-3"
        >
          <span className="text-[14px] font-semibold">위치 포함</span>
          <span className="flex h-6 w-10 items-center justify-end rounded-full bg-success p-0.5">
            <span className="size-5 rounded-full bg-white" />
          </span>
        </div>
      </div>
      <p className="mt-4 text-center text-[13px] font-medium text-sub">
        위치와 시각만 읽고, 원본은 폰에 남아
      </p>
    </>
  );
}

const THUMBS = 8;

function Reading({
  files,
  fails,
  onEnd,
}: {
  files: File[];
  fails: boolean;
  onEnd: (ok: boolean) => void;
}) {
  const [t, setT] = useState(0);
  const [urls, setUrls] = useState<string[]>([]);
  const end = useEffectEvent(onEnd);

  useEffect(() => {
    const made = files.slice(0, THUMBS).map((f) => URL.createObjectURL(f));
    setUrls(made);
    return () => {
      for (const u of made) URL.revokeObjectURL(u);
    };
  }, [files]);

  useEffect(() => {
    // shortcut: EXIF isn't parsed yet; progress is simulated and counts come from room.upload. Replace with real upload progress when the API lands.
    let timer = 0;
    const anim = animate(0, fails ? 0.42 : 1, {
      duration: fails ? 1.2 : 2.6,
      ease: fails ? "easeOut" : "easeInOut",
      onUpdate: setT,
      onComplete: () => {
        timer = window.setTimeout(() => end(!fails), fails ? 300 : 400);
      },
    });
    return () => {
      anim.stop();
      clearTimeout(timer);
    };
  }, [fails]);

  const total = files.length;
  const pct = Math.round(t * 100);
  return (
    <>
      <p className="tnum text-[14px] font-semibold text-sub">{total}장 중</p>
      <p className="tnum mt-1 text-[40px] leading-none font-extrabold tracking-[-0.03em]">
        {Math.round(t * total)}장
        <span className="ml-1.5 text-[18px] font-bold text-sub">읽는 중</span>
      </p>
      <div
        role="progressbar"
        aria-label="사진 읽는 중"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-5 h-3 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-butter"
          style={{ width: `${t * 100}%` }}
        />
      </div>
      <p className="tnum mt-2 text-right text-[13px] font-semibold text-sub">
        {pct}%
      </p>
      <ul className="mt-5 grid grid-cols-4 gap-2">
        {urls.map((src, i) => {
          const lit = i / urls.length < t;
          return (
            <li
              key={src}
              className="relative aspect-square overflow-hidden rounded-[12px] bg-muted"
            >
              {/* biome-ignore lint/performance/noImgElement: blob: previews of picked files, next/image can't optimize them */}
              <motion.img
                src={src}
                alt=""
                initial={false}
                animate={{ opacity: lit ? 1 : 0.3 }}
                className="size-full object-cover"
              />
              {lit && (
                <motion.span
                  variants={pop}
                  initial="hidden"
                  animate="show"
                  className="absolute right-1 bottom-1 grid size-5 place-items-center rounded-full bg-white"
                >
                  <CircleCheckIcon
                    size={16}
                    strokeWidth={2}
                    className="text-success"
                  />
                </motion.span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-5 text-center text-[13px] font-medium text-sub">
        창을 닫지 말고 잠깐만 기다려줘
      </p>
    </>
  );
}

function Result({
  upload,
  onHowTo,
  onDone,
}: {
  upload: UploadResult;
  onHowTo: () => void;
  onDone: () => void;
}) {
  const total = upload.ok + upload.noLocation + upload.noTime;
  const noLocation = total ? upload.noLocation / total : 0;
  return (
    <>
      <motion.span
        variants={pop}
        initial="hidden"
        animate="show"
        className="grid size-10 place-items-center rounded-full bg-heat-1 text-success"
      >
        <CircleCheckIcon size={22} strokeWidth={2} />
      </motion.span>
      <p className="mt-4 text-[14px] font-semibold text-sub">올라간 사진</p>
      <BigNumber n={upload.ok} className="mt-1" />
      {noLocation > 0.3 && (
        <motion.div
          variants={rise}
          initial="hidden"
          animate="show"
          className="mt-5 flex gap-3 rounded-[20px] bg-butter-soft p-4"
        >
          <TriangleAlertIcon
            size={22}
            strokeWidth={2}
            className="shrink-0 text-[#b88a00]"
          />
          <div>
            <p className="text-[14px] font-bold">
              위치 없는 사진이 많아 ({Math.round(noLocation * 100)}%)
            </p>
            <p className="mt-0.5 text-[13px] leading-normal font-medium text-sub">
              '위치 포함'을 켜고 다시 골라볼래?
            </p>
            <button
              type="button"
              onClick={onHowTo}
              className="mt-2 text-[14px] font-bold underline underline-offset-4"
            >
              방법 보기
            </button>
          </div>
        </motion.div>
      )}
      <h3 className="mt-6 mb-1 text-[14px] font-semibold text-sub">
        못 올린 사진
      </h3>
      <ul className="rounded-[20px] border border-line px-4">
        <li className="flex items-start gap-3 border-b border-line py-4">
          <MapPinOffIcon
            size={20}
            strokeWidth={2}
            className="mt-0.5 shrink-0 text-sub"
          />
          <span className="flex-1 text-[16px] font-medium">위치 없음</span>
          <span className="tnum text-[16px] font-bold">
            {upload.noLocation}장
          </span>
        </li>
        <li className="flex items-start gap-3 py-4">
          <ClockAlertIcon
            size={20}
            strokeWidth={2}
            className="mt-0.5 shrink-0 text-sub"
          />
          <div className="flex-1">
            <p className="text-[16px] font-medium">촬영 시각 없음</p>
            <p className="mt-0.5 text-[13px] leading-normal font-medium text-sub">
              스크린샷이나 메신저에서 저장한 사진이야
            </p>
          </div>
          <span className="tnum text-[16px] font-bold">{upload.noTime}장</span>
        </li>
      </ul>
      <Button onClick={onDone} className="mt-6">
        지도에서 보기
      </Button>
    </>
  );
}
