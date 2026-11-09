"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatPanel } from "./ChatPanel";
import { MapCanvas } from "./MapCanvas";
import {
  type ChatMessage,
  cannedAnswer,
  chatModels,
  heatCells,
  replayEvents,
  sampleRoom,
} from "./mock";
import { RecordsPanel } from "./RecordsPanel";
import { actAt, ReplayPanel } from "./ReplayPanel";
import { RoomShell, SNAP_POINTS, type SnapPoint } from "./RoomShell";

type Tab = "replay" | "records" | "chat";

// About 60 s for the whole replay (D5), not counting encounter stops.
const TICK_MS = 300;
const STEP = 0.5;

// shortcut: every room id shows the sample data until the API is wired up.
const room = sampleRoom;
const nicknames = { a: room.a.nickname, b: room.b.nickname };

export function RoomScreen() {
  const { roomId } = useParams<{ roomId: string }>();

  // Panel state lives here once; the drawer and the aside only render it (O1a).
  const [tab, setTab] = useState<Tab>("replay");
  const [snapPoint, setSnapPoint] = useState<SnapPoint | null>(SNAP_POINTS[0]);
  const [replay, setReplay] = useState({ progress: 0, playing: false });
  const [model, setModel] = useState(chatModels[0].id);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!replay.playing) return;
    const timer = setInterval(() => {
      setReplay((prev) => {
        const next = Math.min(prev.progress + STEP, 100);
        // Auto-stop on an encounter (D5); resuming is manual.
        const stop = replayEvents.find(
          (e) =>
            e.act === 2 && e.position > prev.progress && e.position <= next,
        );
        if (stop) return { progress: stop.position, playing: false };
        return { progress: next, playing: next < 100 };
      });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [replay.playing]);

  const act = actAt(replay.progress).act;
  const activeEvent =
    replayEvents
      .filter((e) => e.act === act && e.position <= replay.progress)
      .at(-1) ?? null;
  const showHeat = tab === "records" || act === 3;

  function seek(progress: number) {
    setReplay({ progress, playing: false });
  }

  function showEncounter(id: string) {
    const event = replayEvents.find((e) => e.id === id);
    if (!event) return;
    setTab("replay");
    seek(event.position);
  }

  function send(text: string) {
    setMessages((prev) => [
      ...prev,
      { id: `u${prev.length}`, role: "user", text },
      { id: `a${prev.length}`, role: "ai", text: cannedAnswer(text) },
    ]);
  }

  const panel = (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as Tab)}
      className="min-h-0 flex-1 gap-0"
    >
      <TabsList className="w-full shrink-0 group-data-horizontal/tabs:h-11">
        <TabsTrigger value="replay">리플레이</TabsTrigger>
        <TabsTrigger value="records">우리 기록</TabsTrigger>
        <TabsTrigger value="chat">AI에게 묻기</TabsTrigger>
      </TabsList>
      <TabsContent value="replay" className="flex min-h-0 flex-col">
        <ReplayPanel
          progress={replay.progress}
          playing={replay.playing}
          events={replayEvents}
          activeEvent={activeEvent}
          nicknames={nicknames}
          onTogglePlay={() =>
            setReplay((prev) => ({
              progress: prev.progress >= 100 ? 0 : prev.progress,
              playing: !prev.playing,
            }))
          }
          onSeek={seek}
          onOpenRecords={() => setTab("records")}
        />
      </TabsContent>
      <TabsContent value="records" className="flex min-h-0 flex-col">
        <RecordsPanel cells={heatCells} />
      </TabsContent>
      <TabsContent value="chat" className="flex min-h-0 flex-col">
        <ChatPanel
          messages={messages}
          model={model}
          onModelChange={setModel}
          onSend={send}
          onEvidence={showEncounter}
          onInputFocus={() => setSnapPoint(0.9)}
        />
      </TabsContent>
    </Tabs>
  );

  return (
    <RoomShell
      room={room}
      isSample={roomId === "sample"}
      snapPoint={snapPoint}
      onSnapPointChange={setSnapPoint}
      map={
        <MapCanvas
          points={room.points}
          highlight={showHeat ? null : activeEvent}
          heat={showHeat ? heatCells : null}
        />
      }
      panel={panel}
    />
  );
}
