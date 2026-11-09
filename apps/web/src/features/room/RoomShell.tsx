"use client";

import { EllipsisIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster, toast } from "@/components/ui/toast";
import type { sampleRoom } from "./mock";

export const SNAP_POINTS = ["112px", 0.48, 0.9];
export type SnapPoint = (typeof SNAP_POINTS)[number];

type Props = {
  room: typeof sampleRoom;
  isSample: boolean;
  map: ReactNode;
  panel: ReactNode;
  snapPoint: SnapPoint | null;
  onSnapPointChange: (snapPoint: SnapPoint | null) => void;
};

function copyLink(title: string) {
  navigator.clipboard.writeText(window.location.href).then(
    () => toast.add({ title }),
    () => toast.add({ title: "링크를 복사하지 못했어요", type: "error" }),
  );
}

export function RoomShell({
  room,
  isSample,
  map,
  panel,
  snapPoint,
  onSnapPointChange,
}: Props) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<"kick" | "leave" | null>(null);
  const partner = room.b.nickname;

  return (
    <div className="relative h-dvh overflow-hidden">
      {map}

      <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start gap-2 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex min-w-0 flex-col items-start gap-2 md:hidden">
          <h1 className="flex h-11 max-w-full items-center truncate rounded-full bg-background/95 px-4 font-extrabold shadow-md ring-1 ring-foreground/10">
            {room.name}
          </h1>
        </div>
        <div className="pointer-events-auto ml-auto flex shrink-0 gap-2">
          <Button
            variant="outline"
            className="h-11 rounded-full px-4 shadow-md"
            onClick={() => toast.add({ title: "사진 올리기는 곧 연결돼요" })}
          >
            <PlusIcon />
            사진
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11 rounded-full shadow-md"
                  aria-label="방 메뉴"
                />
              }
            >
              <EllipsisIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                className="min-h-11 md:min-h-8"
                onClick={() => copyLink("초대 링크를 복사했어요")}
              >
                초대 링크 복사
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-h-11 md:min-h-8"
                onClick={() =>
                  copyLink("내 다른 기기 링크를 복사했어요. 나에게만 보내세요")
                }
              >
                내 다른 기기 링크
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-h-11 md:min-h-8"
                onClick={() =>
                  toast.add({ title: "만난 날 수정은 곧 연결돼요" })
                }
              >
                만난 날 수정
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                className="min-h-11 md:min-h-8"
                onClick={() => setConfirm("kick")}
              >
                상대 내보내기
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                className="min-h-11 md:min-h-8"
                onClick={() => setConfirm("leave")}
              >
                방 나가기
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {isSample && (
        <Badge className="fixed top-[calc(max(1rem,env(safe-area-inset-top))+3.5rem)] left-4 z-20 shadow-md md:top-[max(1.5rem,env(safe-area-inset-top))] md:left-[calc(50%+168px)] md:-translate-x-1/2 lg:left-[calc(50%+204px)]">
          샘플 방 · 실제 데이터 아님
        </Badge>
      )}

      {/* Desktop panel (O1a): fixed card, no backdrop, map stays draggable around it. */}
      <aside className="fixed top-4 bottom-4 left-4 z-10 hidden w-80 flex-col gap-3 overflow-hidden rounded-xl bg-card p-4 text-sm text-card-foreground shadow-lg ring-1 ring-foreground/10 md:flex lg:w-[392px]">
        <h1 className="truncate text-lg font-extrabold">{room.name}</h1>
        {panel}
      </aside>

      {/* Mobile sheet (O1a/D11): always open, non-modal, never closes below 112px. */}
      <Drawer
        open
        modal={false}
        disablePointerDismissal
        showSwipeHandle
        snapPoints={SNAP_POINTS}
        snapPoint={snapPoint}
        onSnapPointChange={onSnapPointChange}
        onOpenChange={(open, details) => {
          if (!open) {
            details.cancel();
            details.allowPropagation();
          }
        }}
      >
        <DrawerContent className="px-4 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_rgb(0_0_0/0.08)] md:hidden">
          <DrawerTitle className="sr-only">{room.name}</DrawerTitle>
          {panel}
        </DrawerContent>
      </Drawer>

      <AlertDialog
        open={confirm === "kick"}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{partner}님을 내보낼까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {partner}님의 자리와 사진 {room.b.photoCount}장이 지워지고 되돌릴
              수 없어요. {partner}님이 개인 링크를 잃어버렸을 때만 쓰세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 md:h-8">취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="h-11 md:h-8"
              onClick={() => setConfirm(null)}
            >
              내보내기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirm === "leave"}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>방에서 나갈까요?</AlertDialogTitle>
            <AlertDialogDescription>
              내 사진 {room.a.photoCount}장과 내 자리가 지워져요. 마지막
              사람이면 방도 지워져요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 md:h-8">취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="h-11 md:h-8"
              onClick={() => router.push("/")}
            >
              나가기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster />
    </div>
  );
}
