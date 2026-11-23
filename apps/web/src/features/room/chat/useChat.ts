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
  const [typing, setTyping] = useState(false);
  const [usedToday, setUsedToday] = useState(room.chat.usedToday);
  const failNext = useRef(room.chat.failsNext ?? false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const nextId = useRef(0);
  const limited = usedToday >= room.chat.limit;

  useEffect(() => () => clearTimeout(timer.current), []);

  function reply(question: string) {
    setTyping(true);
    // shortcut: canned answers until /api/chat is wired
    timer.current = setTimeout(() => {
      const answer: ChatMessage = failNext.current
        ? {
            id: `m${nextId.current++}`,
            role: "ai",
            text: FAIL_TEXT,
            error: true,
          }
        : { id: `m${nextId.current++}`, role: "ai", ...cannedAnswer(question) };
      failNext.current = false;
      setTyping(false);
      setMessages((m) => [...m, answer]);
    }, REPLY_MS);
  }

  function ask(question: string) {
    const text = question.trim();
    if (!text || typing || limited) return;
    const id = `m${nextId.current++}`;
    setMessages((m) => [...m, { id, role: "user", text }]);
    setUsedToday((n) => n + 1);
    reply(text);
  }

  function retry() {
    const question = messages.findLast((m) => m.role === "user")?.text;
    if (typing || !question) return;
    setMessages((m) => m.filter((x) => !x.error));
    reply(question);
  }

  return { messages, typing, ask, retry, usedToday, limited };
}
