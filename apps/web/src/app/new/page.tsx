import { Suspense } from "react";
import { NewRoomWizard } from "@/features/entry/NewRoomWizard";

// Static shell; the step is read from the search params under Suspense.
export default function NewRoomPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" />}>
      <NewRoomWizard />
    </Suspense>
  );
}
