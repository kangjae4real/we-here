"use client";

import { cn } from "cn";
import { PauseIcon, PlayIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { ParticipantMark } from "./MapCanvas";
import { ACTS, type ReplayEvent, type Who } from "./mock";

type Props = {
  progress: number;
  playing: boolean;
  events: ReplayEvent[];
  activeEvent: ReplayEvent | null;
  nicknames: Record<Who, string>;
  onTogglePlay: () => void;
  onSeek: (progress: number) => void;
  onOpenRecords: () => void;
};

export function actAt(progress: number) {
  return ACTS.find((a) => progress < a.end) ?? ACTS[2];
}

const monthDay = (date: string) => date.replace(/^\d+년 /, "");

export function ReplayPanel({
  progress,
  playing,
  events,
  activeEvent,
  nicknames,
  onTogglePlay,
  onSeek,
  onOpenRecords,
}: Props) {
  const current = actAt(progress);

  return (
    <>
      <div className="flex h-11 shrink-0 items-center gap-3">
        <Button
          size="icon"
          className="size-11 rounded-full"
          aria-label={playing ? "일시정지" : "재생"}
          onClick={onTogglePlay}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </Button>
        <div className="relative flex h-11 min-w-0 flex-1 items-center">
          <Slider
            aria-label="리플레이 위치"
            value={[progress]}
            step={0.5}
            onValueChange={(v) => onSeek(Array.isArray(v) ? v[0] : v)}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-[calc(50%+6px)] flex gap-0.5"
          >
            {ACTS.map((a) => (
              <span
                key={a.act}
                className={cn(
                  "h-0.5 rounded-full",
                  a.act === current.act ? "bg-foreground/50" : "bg-border",
                )}
                style={{ width: `${a.end - a.start}%` }}
              />
            ))}
          </div>
          {events
            .filter((e) => e.act === 2)
            .map((e) => (
              <span
                key={e.id}
                aria-hidden
                className="pointer-events-none absolute top-[calc(50%-14px)] h-2 w-0.5 -translate-x-1/2 rounded-full bg-participant-b"
                style={{ left: `${e.position}%` }}
              />
            ))}
        </div>
        <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums">
          {current.act}막
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto *:shrink-0 pt-3 pb-6">
        {activeEvent ? (
          <EventCard event={activeEvent} nicknames={nicknames} />
        ) : (
          <Card size="sm">
            <CardHeader>
              <CardTitle className="font-extrabold">
                {current.act}막 · {current.label}
              </CardTitle>
              <CardDescription>
                {current.act === 3
                  ? "만난 뒤 사진이 날마다 쌓여 히트맵이 돼요."
                  : "만나기 전 사진이 시간순으로 쌓여요. 스친 순간에서 멈춰요."}
              </CardDescription>
            </CardHeader>
            {current.act === 3 && (
              <CardContent>
                <Button
                  variant="outline"
                  className="h-11"
                  onClick={onOpenRecords}
                >
                  우리 기록에서 보기
                </Button>
              </CardContent>
            )}
          </Card>
        )}

        {ACTS.map((a) => {
          const items = events.filter((e) => e.act === a.act);
          return (
            <section key={a.act} className="flex flex-col gap-1">
              <h3 className="px-2 text-xs font-extrabold text-muted-foreground">
                {a.act}막 · {a.label}
              </h3>
              {items.length > 0 ? (
                <ol className="flex flex-col">
                  {items.map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        aria-current={e.id === activeEvent?.id}
                        onClick={() => onSeek(e.position)}
                        className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=true]:bg-muted aria-[current=true]:font-semibold"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {e.act === 2
                            ? `${monthDay(e.a.date)}, ${e.place}`
                            : e.place}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {e.act === 2
                            ? `${e.distanceM}m · ${e.minutesApart}분`
                            : e.gap}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <Button
                  variant="ghost"
                  className="h-11 justify-start"
                  onClick={onOpenRecords}
                >
                  우리 기록에서 보기
                </Button>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

function EventCard({
  event,
  nicknames,
}: {
  event: ReplayEvent;
  nicknames: Record<Who, string>;
}) {
  if (event.act === 1) {
    return (
      <Card size="sm">
        <CardHeader>
          <CardDescription>1막 · 같은 곳, 다른 때</CardDescription>
          <CardTitle className="font-extrabold">{event.place}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5">
          {(["a", "b"] as const).map((who) => (
            <p key={who} className="flex items-center gap-2">
              <ParticipantMark who={who} />
              <span className="font-medium">{nicknames[who]}</span>
              <span className="text-muted-foreground">{event[who].date}</span>
            </p>
          ))}
          <p className="pt-1 font-semibold">{event.gap}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>2막 · 스친 순간</CardDescription>
        <CardTitle className="font-extrabold">
          {monthDay(event.a.date)}, {event.place}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          {(["a", "b"] as const).map((who) => (
            <figure key={who} className="flex flex-col gap-1.5">
              <div
                role="img"
                aria-label={`${nicknames[who]}님의 사진 썸네일`}
                className={cn(
                  "aspect-4/3 rounded-lg bg-linear-to-br",
                  who === "a"
                    ? "from-participant-a/80 to-participant-a/15"
                    : "from-participant-b/80 to-participant-b/15",
                )}
              />
              <figcaption className="flex items-center gap-1.5 text-xs">
                <ParticipantMark who={who} />
                <span className="font-medium">{nicknames[who]}</span>
                <span className="tabular-nums text-muted-foreground">
                  {event[who].time}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="text-base font-semibold">
          {event.distanceM}m · {event.minutesApart}분 차이
        </p>
        <p className="text-xs text-muted-foreground">
          10분·250m 안에 찍힌 두 사진
        </p>
        {event.uncertain && (
          <Badge variant="outline" className="w-fit">
            시각 추정(시간대 정보 없음)
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
