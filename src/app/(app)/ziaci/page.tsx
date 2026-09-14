"use client";

import { useMemo, useState } from "react";
import { PageHead } from "@/shared/components/PageHead";
import { Icon } from "@/shared/components/Icon";
import { Chip } from "@/shared/components/Chip";
import { initials } from "@/shared/lib/data";
import { eur, lunchesLeft, LUNCH_PRICE } from "@/shared/lib/pricing";
import {
  LEDGER,
  STUDENTS,
  schoolEmail,
  type LedgerEntry,
  type Student,
} from "@/shared/lib/users";

const QUICK = [10, 20, 50, 100];
const ADMIN_NAME = "Katarína Vrábľová";

/** Green covers lunches, peach is nearly out, rose is empty. */
function balanceState(balance: number) {
  if (balance < LUNCH_PRICE) return "bad" as const;
  if (balance < LUNCH_PRICE * 3) return "warn" as const;
  return "ok" as const;
}

function balanceColor(balance: number) {
  const s = balanceState(balance);
  return s === "bad" ? "var(--c-rose)" : s === "warn" ? "var(--c-peach)" : "var(--ink)";
}

function stamp() {
  const d = new Date();
  return `dnes ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>(STUDENTS);
  const [ledger, setLedger] = useState<LedgerEntry[]>(LEDGER);
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState<string | null>(STUDENTS[0].id);
  const [creating, setCreating] = useState(false);

  // top-up panel
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState<string | null>(null);

  // create form
  const [name, setName] = useState("");
  const [trieda, setTrieda] = useState("");
  const [emailEdited, setEmailEdited] = useState(false);
  const [email, setEmail] = useState("");

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(n) ||
        s.email.toLowerCase().includes(n) ||
        s.trieda.toLowerCase().includes(n),
    );
  }, [q, students]);

  const sel = students.find((s) => s.id === selId) ?? null;
  const lowCount = students.filter((s) => s.active && s.balance < LUNCH_PRICE).length;

  function credit(value: number) {
    if (!sel || !(value > 0)) return;
    setStudents((prev) =>
      prev.map((s) => (s.id === sel.id ? { ...s, balance: +(s.balance + value).toFixed(2) } : s)),
    );
    setLedger((prev) => [
      {
        id: `l${Date.now()}`,
        studentId: sel.id,
        amount: value,
        label: "Dobitie kreditu",
        at: stamp(),
        by: ADMIN_NAME,
      },
      ...prev,
    ]);
    setAmount("");
    setNote(`Pripísané ${eur(value)} žiakovi ${sel.name}.`);
  }

  function toggleActive() {
    if (!sel) return;
    setStudents((prev) =>
      prev.map((s) => (s.id === sel.id ? { ...s, active: !s.active } : s)),
    );
  }

  function startCreate() {
    setCreating(true);
    setName("");
    setTrieda("");
    setEmail("");
    setEmailEdited(false);
    setNote(null);
  }

  function createStudent(e: React.FormEvent) {
    e.preventDefault();
    const nm = name.trim();
    if (!nm || !trieda.trim()) return;
    const id = `s${Date.now()}`;
    const fresh: Student = {
      id,
      name: nm,
      email: email.trim() || schoolEmail(nm),
      trieda: trieda.trim(),
      balance: 0,
      active: true,
      created: "dnes",
    };
    setStudents((prev) => [fresh, ...prev]);
    setSelId(id);
    setCreating(false);
    setNote(`Účet pre ${nm} je vytvorený. Kredit je zatiaľ nulový.`);
  }

  const parsed = Number(amount.replace(",", "."));
  const validAmount = Number.isFinite(parsed) && parsed > 0;

  return (
    <>
      <PageHead
        title="Žiaci"
        sub={`${students.length} účtov · ${lowCount} bez kreditu na obed`}
        actions={
          <button className="btn" onClick={startCreate}>
            <Icon name="person_add" />
            Nový žiak
          </button>
        }
      />

      <div className="grid gap-7 items-start grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-3">
          <div className="search">
            <Icon name="search" />
            <input
              placeholder="Hľadajte meno, e-mail alebo triedu"
              aria-label="Hľadať žiaka"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {list.length === 0 ? (
            <div className="empty">
              <Icon name="person_off" />
              Nikto sa nenašiel.
              <br />
              Skúste iné meno alebo triedu.
            </div>
          ) : (
            list.map((s) => (
              <button
                key={s.id}
                className={`urow ${s.id === selId ? "sel" : ""} ${s.active ? "" : "off"}`}
                onClick={() => {
                  setSelId(s.id);
                  setCreating(false);
                  setNote(null);
                }}
              >
                <span className="av">{initials(s.name)}</span>
                <span className="ui">
                  <span className="un2">{s.name}</span>
                  <span className="ue">{s.email}</span>
                </span>
                <span className="utr">{s.trieda}</span>
                <span className="ubal" style={{ color: balanceColor(s.balance) }}>
                  {eur(s.balance)}
                </span>
              </button>
            ))
          )}
        </div>

        <aside className="xl:sticky xl:top-[92px] flex flex-col gap-4">
          {creating ? (
            <form className="plain" onSubmit={createStudent}>
              <div className="ph">
                <span className="pd">Nový účet žiaka</span>
                <button
                  type="button"
                  className="sq"
                  aria-label="Zavrieť"
                  onClick={() => setCreating(false)}
                >
                  <Icon name="close" />
                </button>
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <label className="flabel" htmlFor="n">
                    Meno a priezvisko
                  </label>
                  <input
                    id="n"
                    className="finput"
                    value={name}
                    autoComplete="off"
                    placeholder="Napríklad Jana Nováková"
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!emailEdited) setEmail(schoolEmail(e.target.value));
                    }}
                  />
                </div>

                <div>
                  <label className="flabel" htmlFor="tr">
                    Trieda
                  </label>
                  <input
                    id="tr"
                    className="finput"
                    value={trieda}
                    autoComplete="off"
                    placeholder="3.A"
                    onChange={(e) => setTrieda(e.target.value)}
                  />
                </div>

                <div>
                  <label className="flabel" htmlFor="em">
                    Školský e-mail
                  </label>
                  <input
                    id="em"
                    className="finput"
                    type="email"
                    value={email}
                    autoComplete="off"
                    placeholder="meno.priezvisko@skyro.ai"
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailEdited(true);
                    }}
                  />
                  <p
                    className="text-[11.5px] leading-[1.55] font-medium mt-2"
                    style={{ color: "var(--ink-3)" }}
                  >
                    Predvyplní sa z mena bez diakritiky. Žiak sa prihlasuje
                    jednorazovým odkazom na túto adresu.
                  </p>
                </div>

                <button className="btn block" type="submit" disabled={!name.trim() || !trieda.trim()}>
                  <Icon name="person_add" />
                  Vytvoriť účet
                </button>
              </div>
            </form>
          ) : sel ? (
            <>
              <div className="plain">
                <div className="ph">
                  <span className="pd">{sel.name}</span>
                  <Chip st={sel.active ? "ok" : "open"}>
                    {sel.active ? "Aktívny" : "Neaktívny"}
                  </Chip>
                </div>

                <div className="flex items-center gap-3 mb-5">
                  <div className="ue">{sel.email}</div>
                  <span className="utr">{sel.trieda}</span>
                </div>

                <div className="balbig" style={{ color: balanceColor(sel.balance) }}>
                  {eur(sel.balance)}
                </div>
                <div className="balsub">
                  {sel.balance < LUNCH_PRICE
                    ? `Nestačí ani na jeden obed (${eur(LUNCH_PRICE)})`
                    : `Vystačí na ${lunchesLeft(sel.balance)} ${
                        lunchesLeft(sel.balance) === 1 ? "obed" : lunchesLeft(sel.balance) < 5 ? "obedy" : "obedov"
                      } po ${eur(LUNCH_PRICE)}`}
                </div>
              </div>

              <div className="plain">
                <div className="ph">
                  <span className="pd">Pripísať kredit</span>
                </div>

                <div className="quick mb-3">
                  {QUICK.map((a) => (
                    <button
                      key={a}
                      className="qamt"
                      aria-pressed={amount === String(a)}
                      onClick={() => setAmount(String(a))}
                    >
                      {a} €
                    </button>
                  ))}
                </div>

                <label className="flabel" htmlFor="amt">
                  Iná suma
                </label>
                <input
                  id="amt"
                  className="finput"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />

                <div className="mt-3">
                  <button
                    className="btn block"
                    disabled={!validAmount}
                    onClick={() => credit(parsed)}
                  >
                    <Icon name="add_card" />
                    Pripísať
                    {validAmount ? <span className="qty">{eur(parsed)}</span> : null}
                  </button>
                </div>

                {note ? (
                  <p
                    className="text-[12.5px] leading-[1.55] font-semibold mt-3"
                    style={{ color: "var(--c-green)" }}
                    role="status"
                  >
                    {note}
                  </p>
                ) : null}

                <button className="btn soft block mt-3" onClick={toggleActive}>
                  <Icon name={sel.active ? "block" : "check_circle"} />
                  {sel.active ? "Deaktivovať účet" : "Aktivovať účet"}
                </button>
              </div>

              <div className="plain">
                <div className="ph">
                  <span className="pd">Posledné pohyby</span>
                  <span className="pd">Účet od {sel.created}</span>
                </div>
                <Ledger entries={ledger.filter((l) => l.studentId === sel.id).slice(0, 6)} />
              </div>
            </>
          ) : (
            <div className="plain dash">
              <p className="pempty">
                <b>Vyberte žiaka</b>
                Kliknite na účet v zozname a uvidíte jeho kredit, pohyby a
                možnosť dobiť.
              </p>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function Ledger({ entries }: { entries: LedgerEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="pempty">
        <b>Zatiaľ žiadne pohyby</b>
        Po prvom dobití alebo objednávke sa tu objaví záznam.
      </p>
    );
  }
  return (
    <div>
      {entries.map((l) => {
        const up = l.amount > 0;
        return (
          <div key={l.id} className={`led ${up ? "up" : "down"}`}>
            <span className="ldisc">
              <Icon name={up ? "add" : "restaurant"} />
            </span>
            <span className="li">
              <span className="ll">{l.label}</span>
              <span className="lt">
                {l.at}
                {l.by ? ` · ${l.by}` : ""}
              </span>
            </span>
            <span className="la">
              {up ? "+" : ""}
              {eur(l.amount)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
