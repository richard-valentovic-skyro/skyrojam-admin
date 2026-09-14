"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { THREAD, type ChatItem } from "../lib/data";

/* THREAD is written from the student's side. The canteen manager reading the
   same conversation in her inbox is the other party, so flip who is "me". */
export function ChatThread({
  seed = THREAD,
  as = "student",
}: {
  seed?: ChatItem[];
  as?: "student" | "admin";
}) {
  const mine = as === "admin" ? "them" : "me";
  const [items, setItems] = useState<ChatItem[]>(seed);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [items]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    const now = new Date();
    setItems((prev) => [
      ...prev,
      {
        kind: "msg",
        from: mine,
        text,
        at: `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`,
      },
    ]);
    setDraft("");
  }

  return (
    <div className="flex flex-col" style={{ minHeight: "calc(100vh - 240px)" }}>
      <div className="thread flex-1">
        {items.map((it, i) =>
          it.kind === "day" ? (
            <div key={`d${i}`} className="dm">
              {it.label}
            </div>
          ) : (
            <div key={`m${i}`} className={`msg ${it.from === mine ? "me" : "them"}`}>
              {it.text}
              <span className="mt">{it.at}</span>
            </div>
          ),
        )}
        <div ref={endRef} />
      </div>

      {/* The composer floats over the thread, so it keeps its glass. */}
      <div className="sticky bottom-0 mt-5 -mx-2 px-2 py-3 flex gap-3 items-center glass rounded-[999px]">
        <input
          className="chatinput"
          placeholder="Napíšte správu"
          aria-label="Napíšte správu"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <button className="send" aria-label="Odoslať" onClick={send}>
          <Icon name="arrow_upward" />
        </button>
      </div>
    </div>
  );
}
