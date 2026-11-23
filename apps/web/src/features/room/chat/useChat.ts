import { useEffect, useRef, useState } from "react";
import type { Chat } from "../contract";
import {
  type ChatMessage,
  cannedAnswer,
  type Room,
  suggestedQuestions,
} from "../mock";

const REPLY_MS = 900;
const FAIL_TEXT = "답을 못 가져왔어. 다시 물어봐줄래?";

// A room that already hit today's limit (S6) obviously talked today: show that exchange.
function seed(room: Room): ChatMessage[] {
  if (room.chat.usedToday < room.chat.limit) return [];
  const q = suggestedQuestions[1];
  return [
    { id: "seed-q", role: "user", text: q },
    { id: "seed-a", role: "ai", ...cannedAnswer(q) },
  ];
}

export function useChat(room: Room): Chat {
  const [messages, setMessages] = useState(() => seed(room));
  // The question awaiting an answer. Kept in state, not a timer ref, so a room hidden
  // and shown again by Next's Activity cache restarts the reply instead of hanging.
  const [pending, setPending] = useState<string | null>(null);
  const [usedToday, setUsedToday] = useState(room.chat.usedToday);
  const failNext = useRef(room.chat.failsNext ?? false);
  const nextId = useRef(0);
  const typing = pending !== null;
  const limited = usedToday >= room.chat.limit;

  useEffect(() => {
    if (pending === null) return;
    // shortcut: canned answers until /api/chat is wired
    const timer = setTimeout(() => {
      const answer: ChatMessage = failNext.current
        ? {
            id: `m${nextId.current++}`,
            role: "ai",
            text: FAIL_TEXT,
            error: true,
          }
        : { id: `m${nextId.current++}`, role: "ai", ...cannedAnswer(pending) };
      failNext.current = false;
      setPending(null);
      setMessages((m) => [...m, answer]);
    }, REPLY_MS);
    return () => clearTimeout(timer);
  }, [pending]);

  function ask(question: string) {
    const text = question.trim();
    if (!text || typing || limited) return;
    const id = `m${nextId.current++}`;
    setMessages((m) => [...m, { id, role: "user", text }]);
    setUsedToday((n) => n + 1);
    setPending(text);
  }

  // Re-asks the question the latest error answered, even if later questions went through.
  function retry() {
    const i = messages.findLastIndex((m) => m.error);
    const question = messages
      .slice(0, i)
      .findLast((m) => m.role === "user")?.text;
    if (typing || i < 0 || !question) return;
    const failed = messages[i].id;
    setMessages((m) => m.filter((x) => x.id !== failed));
    setPending(question);
  }

  return { messages, typing, ask, retry, usedToday, limited };
}
