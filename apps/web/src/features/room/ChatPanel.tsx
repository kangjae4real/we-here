"use client";

import { SendIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Message, MessageContent } from "@/components/ui/message";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { type ChatMessage, chatModels, suggestedQuestions } from "./mock";

type Props = {
  messages: ChatMessage[];
  model: string;
  onModelChange: (model: string) => void;
  onSend: (text: string) => void;
  onEvidence: (encounterId: string) => void;
  onInputFocus: () => void;
};

export function ChatPanel({
  messages,
  model,
  onModelChange,
  onSend,
  onEvidence,
  onInputFocus,
}: Props) {
  const [draft, setDraft] = useState("");
  const modelId = useId();
  const logRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on each new message
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  function submit(text: string) {
    if (!text.trim()) return;
    onSend(text.trim());
    setDraft("");
  }

  return (
    <>
      {/* Mobile keeps the input in the 112px rail (D3); the desktop panel puts it last. */}
      <form
        className="flex h-11 shrink-0 items-center gap-2 md:order-last md:mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
      >
        <Input
          aria-label="AI에게 물어볼 내용"
          placeholder="두 사람의 기록에 대해 물어보세요"
          className="h-11 min-w-0 flex-1"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={onInputFocus}
        />
        <Button
          type="submit"
          size="icon"
          className="size-11"
          aria-label="보내기"
          disabled={!draft.trim()}
        >
          <SendIcon />
        </Button>
      </form>

      <div
        ref={logRef}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto *:shrink-0 pt-3 pb-6 md:pb-0"
      >
        <div className="flex items-center gap-2">
          <label htmlFor={modelId} className="shrink-0 text-xs font-medium">
            모델
          </label>
          <NativeSelect
            id={modelId}
            className="min-w-0 flex-1 [&_select]:h-11 md:[&_select]:h-8"
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
          >
            {chatModels.map((m) => (
              <NativeSelectOption key={m.id} value={m.id}>
                {m.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <p className="text-xs text-muted-foreground">
          AI 채팅을 쓰면 장소 이름, 날짜, 거리 요약이 NVIDIA를 거쳐 선택한 모델
          제공자에게 전송돼요.
        </p>

        <div role="log" aria-live="polite" className="flex flex-col gap-3">
          {messages.map((m) => (
            <Message key={m.id} align={m.role === "user" ? "end" : "start"}>
              <MessageContent>
                <Bubble variant={m.role === "user" ? "default" : "muted"}>
                  <BubbleContent>
                    {m.role === "ai" ? (
                      <AnswerText text={m.text} onEvidence={onEvidence} />
                    ) : (
                      m.text
                    )}
                  </BubbleContent>
                </Bubble>
              </MessageContent>
            </Message>
          ))}
        </div>

        <ul className="flex flex-col gap-1.5" aria-label="추천 질문">
          {suggestedQuestions.map((q) => (
            <li key={q}>
              <Button
                variant="outline"
                className="h-11 w-full justify-start md:h-9"
                onClick={() => submit(q)}
              >
                {q}
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

/** Renders `[E-xxxxxx]` evidence ids as chips that jump to that encounter. */
function AnswerText({
  text,
  onEvidence,
}: {
  text: string;
  onEvidence: (id: string) => void;
}) {
  return text.split(/\[(E-[0-9a-f]{6})\]/).map((part, i) =>
    i % 2 === 1 ? (
      <button
        // biome-ignore lint/suspicious/noArrayIndexKey: parts of a fixed string
        key={i}
        type="button"
        onClick={() => onEvidence(part)}
        className="mx-0.5 inline-flex h-6 items-center rounded-full border border-border bg-background px-2 align-middle font-mono text-[11px] outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {part}
      </button>
    ) : (
      part
    ),
  );
}
