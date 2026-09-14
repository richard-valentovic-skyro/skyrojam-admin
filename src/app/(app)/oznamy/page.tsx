"use client";

import { useState } from "react";
import { PageHead } from "@/shared/components/PageHead";
import { Icon } from "@/shared/components/Icon";
import { Chip } from "@/shared/components/Chip";

export default function ComposePage() {
  const [title, setTitle] = useState("Uzávierka objednávok sa mení na 14:00");
  const [body, setBody] = useState(
    "Od pondelka 21. septembra sa objednávky na nasledujúci deň uzatvárajú o 14:00 namiesto 15:30. Platí pre všetky ročníky.",
  );
  const [important, setImportant] = useState(true);

  return (
    <>
      <PageHead
        title="Nový oznam"
        sub="Školská jedáleň"
        actions={
          <button className="iconbtn" aria-label="Zahodiť">
            <Icon name="delete" />
          </button>
        }
      />

      <div className="grid gap-7 items-start grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-5 max-w-[720px]">
          <div>
            <label className="flabel" htmlFor="t">
              Nadpis
            </label>
            <input
              id="t"
              className="finput"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="flabel" htmlFor="b">
              Text oznamu
            </label>
            <textarea
              id="b"
              className="finput"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <button
            className="toggle"
            aria-pressed={important}
            onClick={() => setImportant((v) => !v)}
          >
            <span className="tl">
              <span className="tt">Označiť ako dôležité</span>
              <span className="ts">
                Dôležitý oznam sa zobrazí navrchu feedu s fialovým okrajom a pošle notifikáciu.
              </span>
            </span>
            <span className="sw" />
          </button>

          <div className="flex gap-3">
            <button className="btn">
              <Icon name="send" />
              Publikovať oznam
            </button>
            <button className="btn soft">
              <Icon name="schedule" />
              Uložiť ako koncept
            </button>
          </div>
        </div>

        {/* Live preview, in the exact component students will see. */}
        <aside className="xl:sticky xl:top-[92px]">
          <div className="gl">Náhľad</div>
          <article className={important ? "post imp" : "post"}>
            {important ? <Chip st="imp">Dôležité</Chip> : null}
            <h3 className="pt">{title || "Nadpis oznamu"}</h3>
            <p className="pb">{body || "Text oznamu sa zobrazí tu."}</p>
            <div className="pm">dnes, Katarína Vrábľová</div>
          </article>
        </aside>
      </div>
    </>
  );
}
