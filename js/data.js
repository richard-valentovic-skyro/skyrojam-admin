/* Skyro Obedy — data layer.
   Fixtures only; there is no backend. Replace the arrays below with fetches
   when the API lands — nothing else in the app reads data from anywhere else.
   Plain script (not a module) so the pages also work opened from file://. */
window.SKYRO = window.SKYRO || {};
(function (S) {
  "use strict";

  /* ---------- pricing ---------- */
  /* One lunch, one price. Everything that shows money goes through here. */

  const LUNCH_PRICE = 5.5;

  /** Slovak formatting: 5,50 €. Hand-rolled so server and client always agree. */
  function eur(n) {
    var v = Number(n);
    /* Never let Infinity, NaN, or a number so large that toFixed() switches
       to exponential notation, reach a price label. No real lunch account
       holds a quadrillion euros. */
    if (!isFinite(v) || Math.abs(v) >= 1e15) return "— €";
    var sign = v < 0 ? "−" : "";
    var parts = Math.abs(v).toFixed(2).split(".");
    /* Slovak groups thousands with a non-breaking space: 1 012,00 € */
    var whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
    return sign + whole + "," + parts[1] + " €";
  }

  /** How many lunches a balance still covers. */
  function lunchesLeft(balance) {
    return Math.max(0, Math.floor(balance / LUNCH_PRICE));
  }

  /* ---------- users ---------- */
  /* Student accounts and their credit.

     No backend yet: this is fixture data, and the admin screen mutates a copy
     in React state. When the API lands, replace these exports with fetches —
     every screen reads accounts and ledger through this module and nothing
     else, so it is the only seam that has to change. */



  /** Who is signed in on the student app. */
  const CURRENT_STUDENT_ID = "s1";

  const STUDENTS = [
    { id: "s1", name: "Matej Hrušovský", email: "matej.hrusovsky@skyro.ai", trieda: "3.A", balance: 28, active: true, created: "1. sep 2026" },
    { id: "s2", name: "Nina Bartošová", email: "nina.bartosova@skyro.ai", trieda: "3.A", balance: 112, active: true, created: "1. sep 2026" },
    { id: "s3", name: "Tomáš Ondrejka", email: "tomas.ondrejka@skyro.ai", trieda: "2.B", balance: 5.5, active: true, created: "1. sep 2026" },
    { id: "s4", name: "Adam Šimko", email: "adam.simko@skyro.ai", trieda: "2.B", balance: 2, active: true, created: "3. sep 2026" },
    { id: "s5", name: "Zuzana Kráľová", email: "zuzana.kralova@skyro.ai", trieda: "1.A", balance: 88.5, active: true, created: "1. sep 2026" },
    { id: "s6", name: "Lenka Michalcová", email: "lenka.michalcova@skyro.ai", trieda: "1.A", balance: 0, active: true, created: "8. sep 2026" },
    { id: "s7", name: "Peter Kollár", email: "peter.kollar@skyro.ai", trieda: "4.A", balance: 33, active: true, created: "1. sep 2026" },
    { id: "s8", name: "Sofia Danišová", email: "sofia.danisova@skyro.ai", trieda: "4.A", balance: 61, active: false, created: "1. sep 2026" },
  ];


  const LEDGER = [
    { id: "l1", studentId: "s1", amount: -LUNCH_PRICE, label: "Obed 1, Bryndzové halušky", at: "dnes 9:02" },
    { id: "l2", studentId: "s1", amount: -LUNCH_PRICE, label: "Obed 3, Kuracie prsia", at: "dnes 8:58" },
    { id: "l3", studentId: "s1", amount: 50, label: "Dobitie kreditu", at: "11. sep 8:40", by: "Katarína Vrábľová" },
    { id: "l4", studentId: "s1", amount: -LUNCH_PRICE, label: "Obed 2, Vyprážaný rezeň", at: "11. sep 8:12" },
    { id: "l5", studentId: "s1", amount: -LUNCH_PRICE, label: "Obed 9, Caesar šalát", at: "9. sep 8:30" },
    { id: "l6", studentId: "s2", amount: 100, label: "Dobitie kreditu", at: "10. sep 11:20", by: "Katarína Vrábľová" },
    { id: "l7", studentId: "s4", amount: 20, label: "Dobitie kreditu", at: "5. sep 7:55", by: "Katarína Vrábľová" },
    { id: "l8", studentId: "s5", amount: 100, label: "Dobitie kreditu", at: "2. sep 9:10", by: "Katarína Vrábľová" },
    { id: "l9", studentId: "s3", amount: 30, label: "Dobitie kreditu", at: "1. sep 8:05", by: "Katarína Vrábľová" },
  ];

  /** Email the school issues for a new account. Strips Slovak diacritics. */
  function schoolEmail(name) {
    const plain = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ".");
    return plain ? `${plain}@skyro.ai` : "";
  }

  /* ---------- data ---------- */
  /* Content carried over verbatim from the mobile app.
     Slovak UI copy, real Slovak school-canteen food, and allergens using the
     EU Annex II numbering that Slovak canteens are legally required to print
     (1 lepok, 3 vajcia, 4 ryby, 7 mlieko, 8 orechy). Portions sum to 184. */



  const MEALS = [
    {
      n: "Bryndzové halušky so slaninou",
      d: "Zemiakové cesto, ovčia bryndza, opražená slanina",
      cat: "Mäsité",
      tint: "t-peach",
      a: ["1, 7"],
      ic: "ramen_dining",
      c: 41,
    },
    {
      n: "Vyprážaný bravčový rezeň",
      d: "Zemiaková kaša, citrón, kyslá uhorka",
      cat: "Mäsité",
      tint: "t-peach",
      a: ["1, 3, 7"],
      ic: "lunch_dining",
      c: 38,
    },
    {
      n: "Kuracie prsia na grile",
      d: "Dusená ryža, dusená zelenina, bylinkové maslo",
      cat: "Hydina",
      tint: "t-blue",
      a: ["7"],
      ic: "kebab_dining",
      c: 27,
    },
    {
      n: "Šošovicová polievka a pirohy",
      d: "Pirohy plnené tvarohom, kyslá smotana",
      cat: "Polievka a múčnik",
      tint: "t-cream",
      a: ["1, 3, 7"],
      ic: "soup_kitchen",
      c: 19,
    },
    {
      n: "Zeleninové rizoto",
      d: "Arborio ryža, cuketa, hrášok, parmezán",
      cat: "Vegetariánske",
      tint: "t-green",
      a: ["veg", "7"],
      ic: "rice_bowl",
      c: 16,
    },
    {
      n: "Segedínsky guláš s knedľou",
      d: "Bravčové mäso, kyslá kapusta, parená knedľa",
      cat: "Mäsité",
      tint: "t-peach",
      a: ["1, 3, 7"],
      ic: "restaurant",
      c: 14,
    },
    {
      n: "Treska na masle",
      d: "Varené zemiaky s petržlenovou vňaťou",
      cat: "Ryba",
      tint: "t-lilac",
      a: ["4, 7"],
      ic: "set_meal",
      c: 11,
    },
    {
      n: "Cestoviny s bazalkovým pestom",
      d: "Paradajky, rukola, píniové oriešky",
      cat: "Vegetariánske",
      tint: "t-green",
      a: ["veg", "1, 7, 8"],
      ic: "dinner_dining",
      c: 10,
    },
    {
      n: "Caesar šalát s kuracím mäsom",
      d: "Rímsky šalát, krutóny, parmezán, dresing",
      cat: "Hydina",
      tint: "t-blue",
      a: ["1, 3, 4, 7"],
      ic: "local_dining",
      c: 8,
    },
  ];



  const WEEK = [
    { w: "Po", d: 14, i: 0, st: "ok", l: "Objednané" },
    { w: "Ut", d: 15, i: 2, st: "warn", l: "Zmenené" },
    { w: "St", d: 16, i: 4, st: "ok", l: "Objednané" },
    { w: "Št", d: 17, i: null, st: "open", l: "Otvorené" },
    { w: "Pi", d: 18, i: null, st: "open", l: "Otvorené" },
  ];


  const ORDERS = [
    {
      group: "Tento týždeň",
      rows: [
        {
          w: "Po",
          d: 14,
          meal: "Bryndzové halušky so slaninou",
          sub: "Obed 1, objednané 11. sep",
          st: "ok",
          l: "Objednané",
        },
        {
          w: "Ut",
          d: 15,
          meal: "Kuracie prsia na grile",
          sub: "Obed 3, zmenené dnes 8:58",
          st: "warn",
          l: "Zmenené",
        },
        {
          w: "St",
          d: 16,
          meal: "Zeleninové rizoto",
          sub: "Obed 5, objednané dnes 9:02",
          st: "ok",
          l: "Objednané",
        },
      ],
    },
    {
      group: "Minulý týždeň",
      rows: [
        {
          w: "Pi",
          d: 11,
          meal: "Vyprážaný bravčový rezeň",
          sub: "Obed 2, vydané 12:35",
          st: "ok",
          l: "Objednané",
        },
        {
          w: "Št",
          d: 10,
          meal: "Cestoviny s bazalkovým pestom",
          sub: "Obed 8, zrušené 9. sep",
          st: "bad",
          l: "Zrušené",
        },
        {
          w: "St",
          d: 9,
          meal: "Caesar šalát s kuracím mäsom",
          sub: "Obed 9, vydané 12:20",
          st: "ok",
          l: "Objednané",
        },
      ],
    },
  ];


  const POSTS = [
    {
      imp: true,
      t: "Uzávierka objednávok sa mení na 14:00",
      b: "Objednávky sa uzatvárajú o 14:00 v deň obeda. Predtým to bolo 15:30. Platí pre všetky ročníky.",
      m: "dnes 9:12, Katarína Vrábľová",
    },
    {
      t: "Tri nové vegetariánske jedlá od októbra",
      b: "Do ponuky pribudnú tri bezmäsité jedlá. Hlasovanie o štvrtom nájdete v školskom Classroome do piatka.",
      m: "včera 16:40, Katarína Vrábľová",
    },
    {
      t: "Výdaj obedov počas testovania",
      b: "V utorok 15. septembra sa vydáva až od 12:20 kvôli celoškolskému testovaniu v telocvični.",
      m: "11. sep 13:05, Katarína Vrábľová",
    },
    {
      t: "Jesenné prázdniny bez výdaja",
      b: "Od 28. do 31. októbra sa obedy nevydávajú. Objednávky na tieto dni sa zrušia automaticky.",
      m: "8. sep 10:22, Katarína Vrábľová",
    },
  ];


  const CONVS = [
    { n: "Matej Hrušovský", p: "Super, ďakujem pekne.", t: "9:24", u: 0 },
    { n: "Nina Bartošová", p: "Môžem ešte dnes zmeniť obed na zajtra?", t: "9:02", u: 2 },
    { n: "Tomáš Ondrejka", p: "Prosím o zrušenie obedov na budúci týždeň.", t: "8:47", u: 1 },
    {
      n: "Adam Šimko",
      p: "Vo štvrtok som mal rizoto, ale dostal som guláš.",
      t: "včera",
      u: 3,
    },
    { n: "Zuzana Kráľová", p: "Ďakujem za informáciu.", t: "včera", u: 0 },
    { n: "Lenka Michalcová", p: "Funguje už objednávanie aj cez telefón?", t: "pi", u: 0 },
  ];


  const THREAD = [
    { kind: "day", label: "Piatok 11. septembra" },
    {
      kind: "msg",
      from: "them",
      text: "Dobrý deň Matej, obed na piatok som vám potvrdila podľa vašej žiadosti.",
      at: "14:52",
    },
    {
      kind: "msg",
      from: "me",
      text: "Ďakujem. Ešte by som potreboval zmeniť stredu z rezňa na rizoto.",
      at: "15:04",
    },
    { kind: "day", label: "Dnes" },
    {
      kind: "msg",
      from: "them",
      text: "Stredu som prepísala na Obed 5, zeleninové rizoto. Zmenu už vidíte v aplikácii.",
      at: "9:02",
    },
    { kind: "msg", from: "me", text: "Super, ďakujem pekne.", at: "9:24" },
    {
      kind: "msg",
      from: "them",
      text: "Nech sa páči. Ak budete potrebovať čokoľvek ďalšie, napíšte.",
      at: "9:26",
    },
  ];

  const TOTAL_TODAY = MEALS.reduce((s, m) => s + m.c, 0); // 184

  function initials(name) {
    return name
      .split(" ")
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase();
  }

  /* 1 záznam · 2-4 záznamy · 0 and 5+ záznamov */
  function pluralZaznam(n) {
    return n === 1 ? "záznam" : n >= 2 && n <= 4 ? "záznamy" : "záznamov";
  }

  /* 1 obed · 2-4 obedy · 0 and 5+ obedov */
  function pluralObed(n) {
    return n === 1 ? "obed" : n >= 2 && n <= 4 ? "obedy" : "obedov";
  }

  function plural(n) {
    return n === 1 ? "jedlo" : n >= 2 && n <= 4 ? "jedlá" : "jedál";
  }

  /* ---------- staff ----------
     Who may sign in to the admin panel. The student roster is not enough:
     a student address typed into the admin app must be refused. */
  const STAFF = [
    { email: "katarina.vrablova@skyro.ai", name: "Katarína Vrábľová", role: "Vedúca jedálne" },
    { email: "jana.kovacova@skyro.ai",     name: "Jana Kováčová",     role: "Kuchárka" },
    { email: "peter.hlavaty@skyro.ai",     name: "Peter Hlavatý",     role: "Správca systému" }
  ];

  const SCHOOL_DOMAIN = "skyro.ai";

  /* Deliberately loose: this is a shape check, not an address validator.
     Anything that looks like a@b.c passes, the domain check does the rest. */
  function looksLikeEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());
  }

  function isSchoolAddress(v) {
    return String(v).trim().toLowerCase().endsWith("@" + SCHOOL_DOMAIN);
  }

  /* The school issues usernames as the address without the domain:
     matej.hrusovsky@skyro.ai -> matej.hrusovsky */
  function usernameOf(email) {
    return String(email || "").split("@")[0].toLowerCase();
  }

  /* Letters, digits, dot, dash, underscore. Deliberately strict: a username
     is issued by the school, not chosen by the user. */
  function looksLikeUsername(v) {
    return /^[a-z0-9._-]{2,64}$/.test(String(v).trim().toLowerCase());
  }

  /* Parsing a money amount typed by a human.

     Bare Number() is wrong here and was the cause of three confirmed bugs:
     it accepts "0x10" (credits 16 €), "1e3" (credits 1000 €), and silently
     keeps a third decimal so "5,555" credited 5.555 while every screen
     displayed 5,56 — the ledger and the balance then drifted by a cent.

     Returns null when the text is not a usable amount. */
  function parseAmount(text) {
    var t = String(text == null ? "" : text).trim().replace(/\u00a0/g, " ");
    if (!t) return null;
    t = t.replace(/\s/g, "").replace(",", ".");
    /* Digits only, at most two decimals. No sign, no exponent, no hex. */
    if (!/^\d{1,9}(\.\d{1,2})?$/.test(t)) return null;
    var v = Number(t);
    if (!isFinite(v) || v <= 0) return null;
    if (v > MAX_TOPUP) return null;
    return Number(v.toFixed(2));
  }

  /* A canteen top-up is tens of euros. A typo that adds a zero should be
     refused, not silently applied and then impossible to undo. */
  const MAX_TOPUP = 500;

  Object.assign(S, { parseAmount, MAX_TOPUP, usernameOf, looksLikeUsername, STAFF, SCHOOL_DOMAIN, looksLikeEmail, isSchoolAddress, pluralZaznam, pluralObed, LUNCH_PRICE, eur, lunchesLeft, CURRENT_STUDENT_ID, STUDENTS, LEDGER, schoolEmail, MEALS, WEEK, ORDERS, POSTS, CONVS, THREAD, TOTAL_TODAY, initials, plural });
})(window.SKYRO);
