"use client";

import { AnimatePresence, motion } from "motion/react";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GoneScreen } from "@/features/entry/GoneScreen";
import { Segmented } from "@/features/ui/controls";
import { Legend } from "@/features/ui/marks";
import { sheetSpring } from "@/features/ui/motion";
import { useIsDesktop } from "@/features/ui/useIsDesktop";
import { ChatPanel } from "./chat/ChatPanel";
import { useChat } from "./chat/useChat";
import {
  type MapInset,
  type MapScene,
  type SheetState,
  TABS,
  type TabId,
} from "./contract";
import { HeatPanel } from "./heat/HeatPanel";
import { MapCanvas } from "./MapCanvas";
import { getRoom, type Room as RoomData } from "./mock";
import { RecordsPanel } from "./records/RecordsPanel";
import { MomentCard } from "./replay/MomentCard";
import { CollapsedReplay, MomentChip, ReplayPanel } from "./replay/ReplayPanel";
import { useReplay } from "./replay/useReplay";
import { SettingsPanel } from "./settings/SettingsPanel";
import { FlowHeader, Panel, TopBar } from "./shell/chrome";
import { Sheet, sheetHeights, useViewport } from "./shell/Sheet";
import { UploadFlow } from "./upload/UploadFlow";

type Flow = "upload" | "settings";
const FLOW_TITLE: Record<Flow, string> = {
  upload: "사진 올리기",
  settings: "방 설정",
};

/** Screen px the mobile 07c card covers on a 390×844 frame (card top at y≈230). */
const CARD_H = 610;

export function RoomScreen() {
  const { roomId } = useParams<{ roomId: string }>();
  const room = getRoom(roomId);
  if (room.status !== "ok") return <GoneScreen kind={room.status} />;
  // Keyed so a route change (e.g. 10a → /r/waiting) starts from fresh state.
  return <Room key={room.id} room={room} />;
}

/** Map fills the screen; tabs live in a bottom sheet (mobile) or a left panel (md+). */
function Room({ room }: { room: RoomData }) {
  const desktop = useIsDesktop();
  const viewport = useViewport();
  const heights = sheetHeights(viewport);
  const replay = useReplay(room);
  const chat = useChat(room);
  const [tab, setTab] = useState<TabId>("record");
  const [flow, setFlow] = useState<Flow | null>(null);
  const [sheet, setSheet] = useState<SheetState>("mid");
  const [selected, setSelected] = useState<number | null>(null);

  // An encounter starts over a collapsed sheet; closing its card brings the sheet back up.
  // Only these two edges move it, so drags during approach/pop and mini-player seeks stick.
  const phase = replay.moment?.phase ?? null;
  const [prevPhase, setPrevPhase] = useState(phase);
  const [refocus, setRefocus] = useState(false);
  if (phase !== prevPhase) {
    setPrevPhase(phase);
    if (prevPhase === null && phase === "approach") setSheet("collapsed");
    else if (
      prevPhase === "on" &&
      phase === null &&
      tab === "replay" &&
      !flow
    ) {
      setSheet("mid");
      setRefocus(true);
    }
  }

  // The card's buttons unmount on close, dropping focus to <body>: hand it to the timeline.
  // The card keeps focus while it animates out, and on mobile the full player only mounts
  // after the mini one exits, so keep re-checking for a moment instead of one shot.
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!refocus) return;
    const started = performance.now();
    const timer = setInterval(() => {
      const active = document.activeElement;
      if (!active || active === document.body || active.closest("[data-card]"))
        root.current?.querySelector<HTMLElement>('[role="slider"]')?.focus();
      if (performance.now() - started > 1500) setRefocus(false);
    }, 100);
    return () => clearInterval(timer);
  }, [refocus]);

  function leaveReplay() {
    if (replay.playing) replay.toggle();
    if (replay.moment) replay.closeMoment();
  }
  function selectTab(id: TabId) {
    if (id !== "replay") leaveReplay();
    setTab(id);
    setSheet(id === "chat" ? "full" : "mid");
  }
  function openFlow(next: Flow) {
    leaveReplay();
    setFlow(next);
    setSheet("full");
  }
  function closeFlow() {
    setFlow(null);
    setSheet(tab === "chat" ? "full" : "mid");
  }
  function showEvidence(index: number) {
    setTab("replay");
    setSheet("mid");
    replay.openMoment(index);
  }

  const cardOn = phase === "on" && !flow;
  const miniReplay =
    !desktop && !flow && tab === "replay" && sheet === "collapsed";
  const bodyKey = flow ?? (miniReplay ? "replay-mini" : tab);
  const body =
    flow === "upload" ? (
      <UploadFlow
        room={room}
        onDone={() => {
          setFlow(null);
          setTab("record");
          setSheet("mid");
        }}
      />
    ) : flow === "settings" ? (
      <SettingsPanel room={room} />
    ) : miniReplay ? (
      <CollapsedReplay room={room} replay={replay} />
    ) : tab === "record" ? (
      <RecordsPanel room={room} onUpload={() => openFlow("upload")} />
    ) : tab === "replay" ? (
      <ReplayPanel
        room={room}
        replay={replay}
        onTogether={() => selectTab("heat")}
      />
    ) : tab === "heat" ? (
      <HeatPanel room={room} selected={selected} onSelect={setSelected} />
    ) : (
      <ChatPanel room={room} chat={chat} onEvidence={showEvidence} />
    );
  const header = flow ? (
    <FlowHeader title={FLOW_TITLE[flow]} onClose={closeFlow} />
  ) : (
    <Segmented
      options={TABS}
      value={tab}
      onChange={selectTab}
      label="방 보기"
    />
  );

  const scene: MapScene = {
    dots: room.points.length === 0 ? "none" : room.b ? "all" : "a",
    heat: tab === "heat",
    ghostB: room.b === null,
    focus:
      tab === "heat" && selected !== null
        ? (room.topPlaces[selected] ?? null)
        : null,
    moment: replay.moment,
  };
  const insetTop = 80 + viewport.top;
  const inset: MapInset = desktop
    ? { top: 24, right: 24, bottom: 24, left: 24 + 400 + 24 }
    : {
        top: insetTop,
        right: 16,
        // Short phones: the card is capped under the top bar, so it covers at most everything below it.
        bottom: cardOn
          ? Math.max(
              0,
              Math.min(CARD_H + viewport.bottom, viewport.h - insetTop),
            )
          : heights[sheet],
        left: 16,
      };

  return (
    <div ref={root} className="relative h-dvh overflow-hidden bg-land">
      <div className="absolute inset-0">
        <MapCanvas room={room} scene={scene} inset={inset} />
      </div>
      <TopBar
        room={room}
        onSettings={() =>
          flow === "settings" ? closeFlow() : openFlow("settings")
        }
      />
      <Legend
        a={room.a.nickname}
        b={room.b?.nickname ?? "상대"}
        className="absolute top-[calc(80px+env(safe-area-inset-top))] left-4 z-10 md:top-auto md:right-[max(24px,env(safe-area-inset-right))] md:bottom-[max(24px,env(safe-area-inset-bottom))] md:left-auto"
      />
      {tab === "replay" && <MomentChip room={room} replay={replay} />}
      {desktop ? (
        <Panel
          header={header}
          bodyKey={bodyKey}
          top={cardOn && <MomentCard room={room} replay={replay} />}
        >
          {body}
        </Panel>
      ) : (
        <>
          <Sheet
            heights={heights}
            ready={viewport.ready}
            state={sheet}
            onState={setSheet}
            hidden={cardOn}
            header={header}
            bodyKey={bodyKey}
          >
            {body}
          </Sheet>
          <AnimatePresence>
            {cardOn && (
              <motion.div
                key="card"
                data-card
                initial={{ opacity: 0, y: 96 }}
                animate={{ opacity: 1, y: 0, transition: sheetSpring }}
                exit={{ opacity: 0, y: 96, transition: { duration: 0.2 } }}
                className="absolute inset-x-4 bottom-[calc(24px+env(safe-area-inset-bottom))] z-30 max-h-[calc(100dvh-104px-env(safe-area-inset-top)-env(safe-area-inset-bottom))] overflow-y-auto overscroll-contain rounded-[28px] shadow-soft"
              >
                <MomentCard room={room} replay={replay} />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
