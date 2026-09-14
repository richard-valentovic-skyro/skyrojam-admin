"use client";

import { useState } from "react";
import { PageHead } from "@/shared/components/PageHead";
import { Icon } from "@/shared/components/Icon";
import { MEALS, plural, type Meal } from "@/shared/lib/data";

export default function ManageMenuPage() {
  const [rows, setRows] = useState<Meal[]>(MEALS);

  function remove(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  function add() {
    setRows((r) => [
      ...r,
      {
        n: "Nové jedlo",
        d: "Doplňte popis a prílohu",
        cat: "Mäsité",
        tint: "t-peach",
        a: ["1, 7"],
        ic: "restaurant",
        c: 0,
      },
    ]);
  }

  return (
    <>
      <PageHead
        title="Správa menu"
        sub="Utorok 15. septembra"
        actions={
          <button className="iconbtn" aria-label="Kopírovať z minulého týždňa">
            <Icon name="content_copy" />
          </button>
        }
      />

      <div className="grid gap-7 items-start grid-cols-1 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="flex flex-col gap-3">
          {rows.map((m, i) => (
            <div key={`${m.n}-${i}`} className="erow">
              <span className="en">{i + 1}</span>
              <span className="ei">
                <span className="et">{m.n}</span>
                <span className="ed">{m.d}</span>
                <span className="eg">
                  {m.a.map((t) =>
                    t === "veg" ? (
                      <span key={t} className="tag veg">
                        Vegetariánske
                      </span>
                    ) : (
                      <span key={t} className="tag">
                        Alergény {t}
                      </span>
                    ),
                  )}
                </span>
              </span>
              <span className="ea">
                <button className="mini" aria-label={`Upraviť ${m.n}`}>
                  <Icon name="edit" />
                </button>
                <button className="mini del" aria-label={`Odstrániť ${m.n}`} onClick={() => remove(i)}>
                  <Icon name="delete" />
                </button>
              </span>
            </div>
          ))}

          <button className="addrow" onClick={add}>
            <Icon name="add" />
            Pridať jedlo
          </button>
        </div>

        <aside className="xl:sticky xl:top-[92px] flex flex-col gap-4">
          <div className="datecard">
            <button className="sq" aria-label="Predchádzajúci deň">
              <Icon name="chevron_left" />
            </button>
            <span className="dx">
              <span className="dxa">Utorok 15. septembra</span>
              <span className="dxb">Nepublikované</span>
            </span>
            <button className="sq" aria-label="Nasledujúci deň">
              <Icon name="chevron_right" />
            </button>
          </div>

          <button className="btn block" disabled={rows.length === 0}>
            <Icon name="publish" />
            Publikovať menu
            <span className="qty">
              {rows.length} {plural(rows.length)}
            </span>
          </button>

          <p className="text-[12.5px] leading-[1.6] font-medium px-1" style={{ color: "var(--ink-3)" }}>
            Po publikovaní uvidia žiaci menu okamžite. Objednávky sa uzatvárajú deň vopred o 14:00.
          </p>
        </aside>
      </div>
    </>
  );
}
