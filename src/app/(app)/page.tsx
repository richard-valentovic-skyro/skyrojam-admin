import Link from "next/link";
import { PageHead } from "@/shared/components/PageHead";
import { Icon } from "@/shared/components/Icon";
import { MEALS, TOTAL_TODAY } from "@/shared/lib/data";
import { eur, LUNCH_PRICE } from "@/shared/lib/pricing";
import { STUDENTS } from "@/shared/lib/users";

export default function DashboardPage() {
  const max = Math.max(...MEALS.map((m) => m.c));
  const lowCredit = STUDENTS.filter((s) => s.active && s.balance < LUNCH_PRICE).length;

  return (
    <>
      <PageHead
        title="Prehľad"
        sub="Pondelok 14. septembra"
        actions={
          <button className="iconbtn" aria-label="Export">
            <Icon name="download" />
          </button>
        }
      />

      <div className="grid gap-7 items-start grid-cols-1 xl:grid-cols-[330px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <div className="hero">
            <div className="hl">Objednávky na dnes</div>
            <div className="hn">{TOTAL_TODAY}</div>
            <div className="hd">
              <Icon name="north_east" />o 12 viac ako minulý pondelok
            </div>
            <div className="hd" style={{ marginLeft: 8 }}>
              <Icon name="payments" />
              {eur(TOTAL_TODAY * LUNCH_PRICE)}
            </div>
          </div>

          <Link href="/ziaci" className="qbtn">
            <span className="disc">
              <Icon name="group" />
            </span>
            Žiaci a kredit
            {lowCredit > 0 ? (
              <span className="chip bad" style={{ marginLeft: "auto" }}>
                <i />
                {lowCredit} bez kreditu
              </span>
            ) : null}
            <Icon name="chevron_right" className="ar" />
          </Link>

          <Link href="/menu" className="qbtn">
            <span className="disc">
              <Icon name="publish" />
            </span>
            Publikovať menu na utorok
            <Icon name="chevron_right" className="ar" />
          </Link>
          <Link href="/oznamy" className="qbtn">
            <span className="disc">
              <Icon name="campaign" />
            </span>
            Nový oznam
            <Icon name="chevron_right" className="ar" />
          </Link>
          <button className="qbtn">
            <span className="disc">
              <Icon name="table_view" />
            </span>
            Export rozpisu do kuchyne
            <Icon name="chevron_right" className="ar" />
          </button>
        </div>

        <div className="plain">
          <div className="ph">
            <span className="pd">Rozdelenie podľa jedla</span>
            <span className="pd">Porcie</span>
          </div>
          <div className="prog">
            {MEALS.map((m, i) => (
              <div key={m.n} className={m.c < 20 ? "prow q" : "prow"}>
                <span className="pn">
                  {i + 1}. {m.n}
                </span>
                <span className="pv">{m.c}</span>
                <span className="pk">
                  <span className="pf" style={{ width: `${Math.round((m.c / max) * 100)}%` }} />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
