"use client";

import { useMemo, useState } from "react";
import { PageHead } from "@/shared/components/PageHead";
import { Icon } from "@/shared/components/Icon";
import { ChatThread } from "@/shared/components/ChatThread";
import { CONVS, THREAD, initials } from "@/shared/lib/data";

export default function InboxPage() {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return CONVS;
    return CONVS.filter(
      (c) => c.n.toLowerCase().includes(needle) || c.p.toLowerCase().includes(needle),
    );
  }, [q]);

  const active = CONVS[sel];
  const unread = CONVS.reduce((s, c) => s + (c.u > 0 ? 1 : 0), 0);

  return (
    <>
      <PageHead
        title="Schránka"
        sub={`${unread} neprečítaných vlákien`}
        actions={
          <button className="iconbtn" aria-label="Označiť všetko prečítané">
            <Icon name="mark_email_read" />
          </button>
        }
      />

      {/* The phone's inbox and chat, side by side. */}
      <div className="grid gap-7 items-start grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <div className="search">
            <Icon name="search" />
            <input
              placeholder="Hľadajte meno alebo správu"
              aria-label="Hľadať v schránke"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {list.length === 0 ? (
            <div className="empty">
              <Icon name="search_off" />
              Nič sa nenašlo.
              <br />
              Skúste iné meno alebo časť správy.
            </div>
          ) : (
            list.map((c) => {
              const idx = CONVS.indexOf(c);
              return (
                <button
                  key={c.n}
                  className={`conv ${c.u ? "un" : ""} ${idx === sel ? "sel" : ""}`}
                  onClick={() => setSel(idx)}
                >
                  <span className="av">{initials(c.n)}</span>
                  <span className="ci">
                    <span className="cn">
                      {c.n}
                      <span className="ct">{c.t}</span>
                    </span>
                    <span className="cp">{c.p}</span>
                  </span>
                  {c.u ? <span className="ub">{c.u}</span> : null}
                </button>
              );
            })
          )}
        </div>

        <div className="plain">
          <div className="ph">
            <span className="pd">{active.n}</span>
            <span className="pd">Žiak</span>
          </div>
          <ChatThread key={active.n} seed={THREAD} as="admin" />
        </div>
      </div>
    </>
  );
}
