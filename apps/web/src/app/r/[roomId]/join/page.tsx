import { Suspense } from "react";
import { JoinScreen } from "@/features/entry/JoinScreen";

// Static shell; roomId is read inside the client component under Suspense.
export default function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" />}>
      <JoinScreen />
    </Suspense>
  );
}
