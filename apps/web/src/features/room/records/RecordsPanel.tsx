"use client";

import {
  ClockIcon,
  ImagePlusIcon,
  MapPinIcon,
  Share2Icon,
  SparkleIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { useState, useSyncExternalStore } from "react";
import { Button, LinkBox } from "@/features/ui/controls";
import { EmptyBlock } from "@/features/ui/feedback";
import { GhostMark, Mark, Name } from "@/features/ui/marks";
import { rise } from "@/features/ui/motion";
import type { Room } from "../mock";
import { BigNumber, FloatingToast, type Notice, Row } from "../shell/chrome";

/** 05 기록 tab, or the S1 (no photos) / S2 (partner not joined) empty states. */
export function RecordsPanel({
  room,
  onUpload,
}: {
  room: Room;
  onUpload: () => void;
}) {
  if (!room.b) return <Waiting roomId={room.id} />;
  if (room.points.length === 0)
    return (
      <div className="pt-6 md:pt-[180px]">
        <EmptyBlock
          icon={<ImagePlusIcon size={24} strokeWidth={2} />}
          title="아직 사진이 없어"
          desc="첫 사진을 올려볼래?"
        >
          <Button onClick={onUpload}>사진 고르기</Button>
        </EmptyBlock>
      </div>
    );

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 pt-2">
        <div>
          <Name who="a" className="text-[14px] font-semibold">
            {room.a.nickname}
          </Name>
          <BigNumber n={room.a.photoCount} className="mt-1" />
        </div>
        <div>
          <Name who="b" className="text-[14px] font-semibold">
            {room.b.nickname}
          </Name>
          <BigNumber n={room.b.photoCount} className="mt-1" />
        </div>
      </div>
      <div className="my-3 h-px bg-line" />
      <Row
        icon={<ClockIcon size={20} strokeWidth={2} />}
        label="가장 오래된 사진"
        value={room.records.oldest}
      />
      <Row
        icon={<SparkleIcon size={20} strokeWidth={2} />}
        label="가장 최근 사진"
        value={room.records.latest}
      />
      <Row
        icon={<MapPinIcon size={20} strokeWidth={2} />}
        label="함께 간 장소"
        value={`${room.records.placesTogether}곳`}
      />
      <Button
        onClick={onUpload}
        icon={<ImagePlusIcon size={20} strokeWidth={2} />}
        className="mt-3"
      >
        사진 더 올리기
      </Button>
      {room.recentPhotos.length > 0 && (
        <div className="hidden md:block">
          <h3 className="mt-7 mb-2 text-[14px] font-semibold text-sub">
            최근 올린 사진
          </h3>
          <ul className="grid grid-cols-3 gap-2">
            {room.recentPhotos.map((p, i) => (
              <motion.li
                key={p.src + p.who}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.1 + i * 0.04 }}
                className="relative aspect-square overflow-hidden rounded-[12px] bg-muted"
              >
                {/* biome-ignore lint/performance/noImgElement: local sample photos, no optimization needed in a 120px tile */}
                <img src={p.src} alt="" className="size-full object-cover" />
                <span className="absolute top-1.5 left-1.5">
                  <Mark who={p.who} size={14} />
                </span>
              </motion.li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const noop = () => () => {};

/** S2: invite link for the partner who hasn't joined yet. */
function Waiting({ roomId }: { roomId: string }) {
  const host = useSyncExternalStore(
    noop,
    () => window.location.host,
    () => "we-here.app",
  );
  const [notice, setNotice] = useState<Notice | null>(null);
  // shortcut: the API's invite link also carries `#<inviteSecret>`; add it when room data comes from the API.
  const path = `/r/${roomId}/join`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setNotice({ text: "링크를 복사했어" });
    } catch {
      // No clipboard (plain-http LAN testing) or permission denied.
      setNotice({ text: "복사가 안 됐어. 링크를 길게 눌러 복사해줘" });
    }
  }

  async function share() {
    const url = `${window.location.origin}${path}`;
    if (!("share" in navigator)) return copy();
    // Dismissing the share sheet rejects; that's not an error worth showing.
    await navigator.share({ title: "we-here", url }).catch(() => {});
  }

  return (
    <motion.div
      variants={rise}
      initial="hidden"
      animate="show"
      className="flex flex-col items-center pt-6 text-center md:pt-[140px]"
    >
      <span className="mb-4 grid size-14 place-items-center">
        <GhostMark className="size-10 rounded-[11px]" />
      </span>
      <p className="text-[18px] font-bold">상대가 아직 안 들어왔어</p>
      <p className="mt-1.5 text-[14px] font-medium text-sub">
        들어오면 주황 마름모가 지도에 생겨
      </p>
      <div className="mt-6 w-full">
        <LinkBox url={`${host}${path}`} onCopy={copy} />
      </div>
      <Button
        onClick={share}
        icon={<Share2Icon size={20} strokeWidth={2} />}
        className="mt-3"
      >
        링크 다시 보내기
      </Button>
      <FloatingToast notice={notice} onDismiss={() => setNotice(null)} />
    </motion.div>
  );
}
