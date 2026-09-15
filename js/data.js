/* Skyro Obedy — data layer.

   Shapes here mirror the backend spec exactly, so mock mode and the real API
   are interchangeable. Notably:

     - MONEY IS IN CENTS, everywhere, as an integer. 550 is one lunch. Euros
       only ever appear as formatted text via eur(). Floats are what made an
       earlier version drift a cent between a ledger and a balance.
     - A meal is ordered by its mealOnDayId — the meal on a particular day —
       never by the meal id or an index in a list.
     - The server decides whether a day is open for ordering (day.open). The
       frontend has no clock logic and no deadline constant.

   Until CONFIG.API_BASE is set these fixtures stand in for the API. */
window.SKYRO = window.SKYRO || {};
(function (S) {
  "use strict";

  /* ---------- money ---------- */

  /* 5,50 €. The server hardcodes the same number; this copy is only so the
     UI can show a price before any order exists. */
  const LUNCH_PRICE_CENTS = 550;

  /* Format integer cents as Slovak currency: 4750 -> "47,50 €".
     Thousands are grouped with a non-breaking space. */
  function eur(cents) {
    var v = Number(cents);
    if (!isFinite(v)) return "— €";
    var neg = v < 0;
    var whole = Math.floor(Math.abs(v) / 100);
    var rest = String(Math.abs(v) % 100).padStart(2, "0");
    var grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return (neg ? "−" : "") + grouped + "," + rest + " €";
  }

  /* "12,50" / "12.50" typed by a human -> 1250 cents, or null if unusable.
     Deliberately strict: bare Number() accepts "0x10" and "1e3". */
  function parseAmountCents(text) {
    var t = String(text == null ? "" : text).trim().replace(/ /g, " ");
    if (!t) return null;
    t = t.replace(/\s/g, "").replace(",", ".");
    if (!/^\d{1,6}(\.\d{1,2})?$/.test(t)) return null;
    var cents = Math.round(Number(t) * 100);
    if (!isFinite(cents) || cents <= 0 || cents > MAX_TOPUP_CENTS) return null;
    return cents;
  }

  /* A canteen top-up is tens of euros. A typo that adds a zero is refused. */
  const MAX_TOPUP_CENTS = 50000; // 500,00 €

  function lunchesLeft(balanceCents) {
    return Math.max(0, Math.floor(Number(balanceCents || 0) / LUNCH_PRICE_CENTS));
  }

  /* ---------- category → the design system ----------
     The API sends an enum. The look is ours: a tint class and a thin-stroke
     Material Symbol, so a new category on the server degrades to a neutral
     card rather than breaking the page. */
  const CATEGORY = {
    MAIN:    { label: "Hlavné jedlo", tint: "t-peach", icon: "restaurant" },
    SOUP:    { label: "Polievka",     tint: "t-cream", icon: "soup_kitchen" },
    SIDE:    { label: "Príloha",      tint: "t-blue",  icon: "rice_bowl" },
    SALAD:   { label: "Šalát",        tint: "t-green", icon: "local_dining" },
    DESSERT: { label: "Dezert",       tint: "t-lilac", icon: "cake" }
  };

  function category(key) {
    return CATEGORY[key] || { label: String(key || "Jedlo"), tint: "t-blue", icon: "restaurant" };
  }

  /* Slovak canteens must print EU Annex II allergen numbers. The API may send
     numbers or words; render whatever it sends, and keep "veg" special. */
  function allergenLabel(a) {
    return a === "veg" ? "Vegetariánske" : "Alergény " + a;
  }

  /* ---------- Slovak plurals ---------- */
  function plural(n) { return n === 1 ? "jedlo" : n >= 2 && n <= 4 ? "jedlá" : "jedál"; }
  function pluralObed(n) { return n === 1 ? "obed" : n >= 2 && n <= 4 ? "obedy" : "obedov"; }
  function pluralZaznam(n) { return n === 1 ? "záznam" : n >= 2 && n <= 4 ? "záznamy" : "záznamov"; }
  function pluralUcet(n) { return n === 1 ? "účet" : n >= 2 && n <= 4 ? "účty" : "účtov"; }

  function initials(name) {
    return String(name || "").trim().split(/\s+/).slice(0, 2)
      .map(function (p) { return p.charAt(0); }).join("").toUpperCase();
  }

  function usernameOf(email) { return String(email || "").split("@")[0].toLowerCase(); }

  function looksLikeUsername(v) {
    return /^[a-z0-9._-]{2,64}$/.test(String(v).trim().toLowerCase());
  }

  /* =================================================================
     FIXTURES — mock mode only. Shapes match the API responses exactly.
     ================================================================= */

  /* GET /me */
  const ME = {
    id: "acc_matej",
    name: "Matej Hrušovský",
    username: "matej.hrusovsky",
    role: "STUDENT",
    balanceCents: 2800
  };

  function mealOnDay(id, slot, name, desc, cat, allergens, capacity, orderCount) {
    return {
      mealOnDayId: id, slot: slot, id: "meal_" + slot,
      name: name, desc: desc, category: cat,
      allergens: allergens, capacity: capacity, orderCount: orderCount,
      orderedByMe: false
    };
  }

  /* GET /menu/today */
  const TODAY_MENU = {
    day: { key: "2026-09-16", label: "Streda 16. septembra 2026", open: true },
    meals: [
      mealOnDay("mod_1", 1, "Bryndzové halušky so slaninou", "Zemiakové cesto, ovčia bryndza, opražená slanina", "MAIN", ["1", "7"], 40, 31),
      mealOnDay("mod_2", 2, "Vyprážaný bravčový rezeň", "Zemiaková kaša, citrón, kyslá uhorka", "MAIN", ["1", "3", "7"], 40, 38),
      mealOnDay("mod_3", 3, "Šošovicová polievka", "Pirohy plnené tvarohom, kyslá smotana", "SOUP", ["1", "3", "7"], 0, 19),
      mealOnDay("mod_4", 4, "Zeleninové rizoto", "Arborio ryža, cuketa, hrášok, parmezán", "SALAD", ["veg", "7"], 25, 16)
    ],
    myOrder: null
  };

  /* GET /menu/week */
  const WEEK_MENU = {
    monday: "2026-09-14",
    days: [
      { key: "2026-09-14", weekday: "Po", dateNumber: 14, label: "Pondelok 14.9.", open: false, meals: [], myOrder: { mealOnDayId: "mod_p1", slot: 1, status: "SERVED", meal: { name: "Bryndzové halušky so slaninou" } } },
      { key: "2026-09-15", weekday: "Ut", dateNumber: 15, label: "Utorok 15.9.", open: false, meals: [], myOrder: { mealOnDayId: "mod_u3", slot: 3, status: "ORDERED", meal: { name: "Kuracie prsia na grile" } } },
      { key: "2026-09-16", weekday: "St", dateNumber: 16, label: "Streda 16.9.", open: true, meals: TODAY_MENU.meals, myOrder: null },
      { key: "2026-09-17", weekday: "Št", dateNumber: 17, label: "Štvrtok 17.9.", open: true, meals: [], myOrder: null },
      { key: "2026-09-18", weekday: "Pi", dateNumber: 18, label: "Piatok 18.9.", open: false, meals: [], myOrder: null }
    ]
  };

  /* GET /orders (student) */
  const MY_ORDERS = [
    { id: "o1", status: "SERVED", mealDate: "2026-09-14", label: "Pondelok 14.9.", weekday: "Po", dateNumber: 14, meal: { name: "Bryndzové halušky so slaninou", slot: 1 } },
    { id: "o2", status: "ORDERED", mealDate: "2026-09-15", label: "Utorok 15.9.", weekday: "Ut", dateNumber: 15, meal: { name: "Kuracie prsia na grile", slot: 3 } },
    { id: "o3", status: "CANCELLED", mealDate: "2026-09-11", label: "Piatok 11.9.", weekday: "Pi", dateNumber: 11, meal: { name: "Cestoviny s bazalkovým pestom", slot: 4 } },
    { id: "o4", status: "SERVED", mealDate: "2026-09-10", label: "Štvrtok 10.9.", weekday: "Št", dateNumber: 10, meal: { name: "Caesar šalát s kuracím mäsom", slot: 2 } }
  ];

  /* GET /announcements */
  const ANNOUNCEMENTS = [
    { id: "a1", important: true, title: "Objednávky sa uzatvárajú deň vopred o 14:00", body: "Na obed v konkrétny deň sa objednáva deň vopred, od 8:00 do 14:00. Platí pre všetky ročníky.", author: "Katarína Vrábľová", createdAt: "dnes 9:12" },
    { id: "a2", important: false, title: "Tri nové vegetariánske jedlá od októbra", body: "Do ponuky pribudnú tri bezmäsité jedlá. Hlasovanie o štvrtom nájdete v školskom Classroome do piatka.", author: "Katarína Vrábľová", createdAt: "včera 16:40" },
    { id: "a3", important: false, title: "Výdaj obedov počas testovania", body: "V utorok 15. septembra sa vydáva až od 12:20 kvôli celoškolskému testovaniu v telocvični.", author: "Katarína Vrábľová", createdAt: "11. sep 13:05" },
    { id: "a4", important: false, title: "Jesenné prázdniny bez výdaja", body: "Od 28. do 31. októbra sa obedy nevydávajú. Objednávky na tieto dni sa zrušia automaticky.", author: "Katarína Vrábľová", createdAt: "8. sep 10:22" }
  ];

  /* GET /students (manager) */
  const STUDENTS = [
    { id: "acc_matej",  name: "Matej Hrušovský",  username: "matej.hrusovsky",  balanceCents: 2800,  active: true },
    { id: "acc_nina",   name: "Nina Bartošová",   username: "nina.bartosova",   balanceCents: 11200, active: true },
    { id: "acc_tomas",  name: "Tomáš Ondrejka",   username: "tomas.ondrejka",   balanceCents: 550,   active: true },
    { id: "acc_adam",   name: "Adam Šimko",       username: "adam.simko",       balanceCents: 200,   active: true },
    { id: "acc_zuzana", name: "Zuzana Kráľová",   username: "zuzana.kralova",   balanceCents: 8850,  active: true },
    { id: "acc_lenka",  name: "Lenka Michalcová", username: "lenka.michalcova", balanceCents: 0,     active: true },
    { id: "acc_peter",  name: "Peter Kollár",     username: "peter.kollar",     balanceCents: 3300,  active: true },
    { id: "acc_sofia",  name: "Sofia Danišová",   username: "sofia.danisova",   balanceCents: 6100,  active: false }
  ];

  /* Managers. The API has one Account model with a role; these are the
     MANAGER rows, kept apart here only so mock sign-in can tell them apart. */
  const MANAGERS = [
    { id: "acc_katarina", name: "Katarína Vrábľová", username: "katarina.vrablova", role: "MANAGER" },
    { id: "acc_jana",     name: "Jana Kováčová",     username: "jana.kovacova",     role: "MANAGER" },
    { id: "acc_hlavaty",  name: "Peter Hlavatý",     username: "peter.hlavaty",     role: "MANAGER" }
  ];

  /* GET /orders?date= (manager) — today's kitchen sheet */
  const KITCHEN_ORDERS = [
    { id: "k1", status: "ORDERED", student: { name: "Matej Hrušovský", username: "matej.hrusovsky" }, meal: { name: "Bryndzové halušky so slaninou", slot: 1 } },
    { id: "k2", status: "SERVED",  student: { name: "Nina Bartošová", username: "nina.bartosova" },   meal: { name: "Vyprážaný bravčový rezeň", slot: 2 } },
    { id: "k3", status: "ORDERED", student: { name: "Zuzana Kráľová", username: "zuzana.kralova" },   meal: { name: "Zeleninové rizoto", slot: 4 } },
    { id: "k4", status: "ORDERED", student: { name: "Peter Kollár", username: "peter.kollar" },       meal: { name: "Bryndzové halušky so slaninou", slot: 1 } }
  ];

  Object.assign(S, {
    LUNCH_PRICE_CENTS, MAX_TOPUP_CENTS,
    eur, parseAmountCents, lunchesLeft,
    CATEGORY, category, allergenLabel,
    plural, pluralObed, pluralZaznam, pluralUcet,
    initials, usernameOf, looksLikeUsername,
    ME, TODAY_MENU, WEEK_MENU, MY_ORDERS, ANNOUNCEMENTS,
    STUDENTS, MANAGERS, KITCHEN_ORDERS
  });
})(window.SKYRO);
