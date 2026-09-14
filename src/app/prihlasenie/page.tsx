"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SkyroLogo } from "@/shared/components/SkyroLogo";
import { Icon } from "@/shared/components/Icon";

/* Apple sign-in restraint: centred column, light-weight display type,
   one field carrying its own submit. No card, no panel — the field floats
   directly on the ground. */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("katarina.vrablova@skyro.ai");
  const [remember, setRemember] = useState(true);

  return (
    <>
      <div className="alogin" />
      <div className="awrap">
        <div className="acol">
          <SkyroLogo className="amark" />
          <h2 className="atitle">
            Prihlásenie
            <br />
            do administrácie
          </h2>

          <form
            className="afield"
            onSubmit={(e) => {
              e.preventDefault();
              router.push("/");
            }}
          >
            <span className="fl">
              <span className="fk">Školský e-mail</span>
              <input
                type="email"
                autoComplete="email"
                aria-label="Školský e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </span>
            <button className="ago" type="submit" aria-label="Pokračovať">
              <Icon name="arrow_forward" />
            </button>
          </form>

          <button
            className="acheck"
            type="button"
            aria-pressed={remember}
            onClick={() => setRemember((v) => !v)}
          >
            <span className="bx">
              <Icon name="check" />
            </span>
            Zapamätať si ma
          </button>

          <div className="ahr" />
          <button className="alink" type="button">
            Nedarí sa vám prihlásiť?
          </button>
          <p className="afine">
            Heslo nepotrebujete. Pošleme jednorazový odkaz na adresu v doméne
            skyro.ai. Prístup má len personál jedálne.
          </p>
        </div>
      </div>
    </>
  );
}
