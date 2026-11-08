"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ParticipantMark } from "@/features/room/MapCanvas";

export function EntryScreen() {
  const router = useRouter();

  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center bg-muted px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <header className="flex flex-col items-center gap-4 text-center">
          <div
            aria-hidden
            className="relative flex size-20 items-center justify-center rounded-full border-2 border-dashed border-foreground/40"
          >
            <ParticipantMark who="a" className="absolute top-4 left-3 size-4" />
            <ParticipantMark
              who="b"
              className="absolute right-3.5 bottom-4 size-3.5"
            />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight">we-here</h1>
          <p className="text-balance text-muted-foreground">
            두 사람의 사진 위치로, 만나기 전 스쳤을지도 모르는 순간을 찾아요
          </p>
        </header>

        <form
          className="flex flex-col gap-5 rounded-xl bg-card p-5 shadow-sm ring-1 ring-foreground/10"
          onSubmit={(e) => {
            e.preventDefault();
            // shortcut: no API yet, so every new room opens the sample room.
            router.push("/r/sample");
          }}
        >
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="nickname">내 닉네임</FieldLabel>
              <Input
                id="nickname"
                name="nickname"
                required
                maxLength={20}
                autoComplete="nickname"
                className="h-11"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="metOn">만난 날</FieldLabel>
              <Input
                id="metOn"
                name="metOn"
                type="date"
                required
                className="h-11"
              />
            </Field>
          </FieldGroup>
          <div className="flex flex-col gap-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              원본 사진은 기기를 떠나지 않아요. 좌표, 시각, 작은 썸네일은 방에
              저장되고 30일 뒤 삭제돼요.
            </p>
            <Button type="submit" className="h-11 w-full text-base">
              방 만들기
            </Button>
          </div>
        </form>

        <Link
          href="/r/sample"
          className={buttonVariants({
            variant: "ghost",
            className: "h-11 self-center px-4",
          })}
        >
          샘플 방 둘러보기
        </Link>
      </div>
    </main>
  );
}
