import { Suspense } from "react";
import { RoomScreen } from "@/features/room/RoomScreen";

// Static shell; roomId is read inside the client component under Suspense (E16).
export default function RoomPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center bg-land text-[14px] font-medium text-sub">
          방을 여는 중…
        </div>
      }
    >
      <RoomScreen />
    </Suspense>
  );
}
