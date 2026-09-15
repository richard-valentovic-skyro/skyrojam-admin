/* Skyro Obedy — data layer.

   Shapes here mirror the REAL backend (Bun + Elysia + Prisma) field for field,
   so mock mode and the live API are interchangeable: swap CONFIG.API_BASE and
   nothing else in the app changes. Notably:

     - MONEY IS IN CENTS, everywhere, as an integer. 550 is one lunch. Euros
       only ever appear as formatted text via eur(). Floats are what made an
       earlier version drift a cent between a ledger and a balance.
     - A meal is ordered by its mealOnDayId — the meal on a particular day —
       never by the meal id or an index in a list.
     - CATEGORY ARRIVES AS A SLOVAK LABEL ("Mäsité", "Hydina", …). The server
       maps its own enum through categoryLabel() before sending. category()
       below turns that label into our tint + icon; an unknown label degrades
       to a neutral card instead of breaking the page.
     - Each meal also carries the server's own tint (a hex colour) and icon (an
       emoji). We keep them in the fixtures because the server sends them, and
       we deliberately ignore both: the look is ours.
     - The server decides whether a day is open for ordering (day.open) and
       sends the ISO deadline with it. The frontend has no clock logic and no
       deadline constant. day.isServing === false is a holiday — the canteen is
       not cooking — which is a different sentence from a passed deadline.

   Until CONFIG.API_BASE is set these fixtures stand in for the API. */
window.SKYRO = window.SKYRO || {};
(function (S) {
  "use strict";

  /* ---------- money ---------- */

  /* 5,50 €. The server hardcodes the same number (config.lunchPriceCents);
     this copy is only so the UI can show a price before any order exists. */
  const LUNCH_PRICE_CENTS = 550;

  /* Format integer cents as Slovak currency: 4750 -> "47,50 €".
     Thousands are grouped with a non-breaking space. */
  function eur(cents) {
    var v = Number(cents);
    if (!isFinite(v)) return "— €";
    var neg = v < 0;
    var whole = Math.floor(Math.abs(v) / 100);
    var rest = String(Math.abs(v) % 100).padStart(2, "0");
    var grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
    return (neg ? "−" : "") + grouped + "," + rest + " €";
  }

  /* "12,50" / "12.50" typed by a human -> 1250 cents, or null if unusable.
     Deliberately strict: bare Number() accepts "0x10" and "1e3". */
  function parseAmountCents(text) {
    var t = String(text == null ? "" : text).trim().replace(/\u00a0/g, " ");
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
     The server sends a Slovak LABEL, already translated from its MealCategory
     enum. It also sends its own tint (hex) and icon (emoji); we ignore both and
     keep our own tint class + thin-stroke Material Symbol, so the canteen keeps
     one visual language whatever the database happens to hold.

     Keyed by the label, because the label is what arrives. The server's enum
     keys are aliased below so an older payload — or a screen that still holds
     an enum — resolves to the same card. */
  const CATEGORY = {
    "Mäsité":             { label: "Mäsité",             tint: "t-peach", icon: "restaurant" },
    "Hydina":             { label: "Hydina",             tint: "t-blue",  icon: "kebab_dining" },
    "Vegetariánske":      { label: "Vegetariánske",      tint: "t-green", icon: "rice_bowl" },
    "Ryba":               { label: "Ryba",               tint: "t-lilac", icon: "set_meal" },
    "Polievka a múčnik":  { label: "Polievka a múčnik",  tint: "t-cream", icon: "soup_kitchen" }
  };

  /* The five labels, in menu order — what the manager picks from. */
  const CATEGORY_LABELS = [
    "Mäsité", "Hydina", "Vegetariánske", "Ryba", "Polievka a múčnik"
  ];

  /* Enum key -> label. The server's MealCategory, plus the five keys this
     frontend used before the real API was known, so nothing that still holds
     an old key renders a blank chip. */
  const CATEGORY_ALIAS = {
    MEAT: "Mäsité",
    POULTRY: "Hydina",
    VEGETARIAN: "Vegetariánske",
    FISH: "Ryba",
    SOUP_DESSERT: "Polievka a múčnik",

    MAIN: "Mäsité",
    SOUP: "Polievka a múčnik",
    SIDE: "Hydina",
    SALAD: "Vegetariánske",
    DESSERT: "Polievka a múčnik"
  };

  /* Takes whatever the server put in `category` and returns the card's dress.
     An unrecognised value keeps its own text and gets no tint class, which is
     a plain card — never an exception, never an empty label. */
  function category(value) {
    var key = String(value == null ? "" : value).trim();
    if (CATEGORY[key]) return CATEGORY[key];
    var alias = CATEGORY_ALIAS[key.toUpperCase()];
    if (alias && CATEGORY[alias]) return CATEGORY[alias];
    return { label: key || "Jedlo", tint: "", icon: "restaurant" };
  }

  /* ---------- order status → chip ----------
     Orders arrive with a ready-made chip: { st, l }. Use it. This map is only
     the fallback for a payload that somehow lacks one (an older server, a
     locally invented row), mirroring the server's STATUS_CHIP exactly. */
  const STATUS_CHIP = {
    OPEN:           { st: "open", l: "Otvorené" },
    ORDERED:        { st: "ok",   l: "Objednané" },
    CHANGED:        { st: "warn", l: "Zmenené" },
    CANCELLED:      { st: "bad",  l: "Zrušené" },
    AUTO_CANCELLED: { st: "bad",  l: "Zrušené" },
    SERVED:         { st: "ok",   l: "Vydané" }
  };

  /* Pass an order (or a bare status). Always returns a usable chip. */
  function chip(order) {
    if (order && order.chip && order.chip.l) return order.chip;
    var status = order && order.status ? order.status : order;
    return STATUS_CHIP[String(status || "").toUpperCase()] ||
      { st: "open", l: "Neznámy stav" };
  }

  /* Slovak canteens must print EU Annex II allergen numbers. The API sends
     whatever the kitchen typed — "1, 7" as one entry is normal — so render it
     as it came, and keep "veg" special. */
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


  /* "Jana Nováková" -> "jana.novakova".

     The school issues a username as the name with the diacritics stripped,
     lowercased, and spaces turned into dots — the same string that sits in
     front of @skyro.ai. NFD splits a letter like ľ or ô into its base plus a
     combining mark, so removing the marks leaves plain ASCII; anything still
     not a letter or digit becomes a separator, and runs of separators
     collapse so "Mária  Anna" cannot produce "maria..anna". */
  function usernameFromName(name) {
    return String(name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/\.{2,}/g, ".")
      .replace(/^\.+|\.+$/g, "");
  }

  function usernameOf(email) { return String(email || "").split("@")[0].toLowerCase(); }

  function looksLikeUsername(v) {
    return /^[a-z0-9._-]{2,64}$/.test(String(v).trim().toLowerCase());
  }

  /* =================================================================
     FIXTURES — mock mode only. Field for field what the API answers,
     with the seeded database's own people, classes and balances.

     Mock mode is a world with a stopped clock. It is
         Tuesday 15 September 2026, 09:30 (UTC),
     which is what makes every open/closed flag and every "dnes / včera"
     below consistent with each other:

       ordering for day D runs (D−1) 08:00 → (D−1) 14:00,
       so right now exactly one day is open: Wednesday the 16th.

     That is the day /menu/today stands for here, because it is the day a
     student can actually act on. Tuesday's lunches are already being served
     — that is the sheet the manager sees.
     ================================================================= */

  const MOCK_NOW = "2026-09-15T09:30:00.000Z";

  /* The day the kitchen is serving right now — GET /orders (manager) with no
     ?date= answers for this day. */
  const KITCHEN_DATE = "2026-09-15";

  /* GET /me */
  const ME = {
    id: "s1",
    name: "Matej Hrušovský",
    username: "matej.hrusovsky",
    role: "STUDENT",
    classCode: "3.A",
    active: true,
    balanceCents: 4750
  };

  /* The dish library, exactly as seeded. `tint` and `icon` are the server's
     own and are never read by the UI — category() dresses the card. */
  const MEALS = [
    { id: "meal_1", name: "Bryndzové halušky so slaninou", desc: "Zemiakové cesto, ovčia bryndza, opražená slanina", category: "Mäsité", tint: "#f6c89f", allergens: ["1, 7"], icon: "🍲", capacity: 41 },
    { id: "meal_2", name: "Vyprážaný bravčový rezeň", desc: "Zemiaková kaša, citrón, kyslá uhorka", category: "Mäsité", tint: "#f6c89f", allergens: ["1, 3, 7"], icon: "🍖", capacity: 38 },
    { id: "meal_3", name: "Kuracie prsia na grile", desc: "Dusená ryža, dusená zelenina, bylinkové maslo", category: "Hydina", tint: "#bcd3f7", allergens: ["7"], icon: "🍗", capacity: 27 },
    { id: "meal_4", name: "Šošovicová polievka a pirohy", desc: "Pirohy plnené tvarohom, kyslá smotana", category: "Polievka a múčnik", tint: "#efe7b8", allergens: ["1, 3, 7"], icon: "🥣", capacity: 19 },
    { id: "meal_5", name: "Zeleninové rizoto", desc: "Arborio ryža, cuketa, hrášok, parmezán", category: "Vegetariánske", tint: "#bfe3c6", allergens: ["veg", "7"], icon: "🍚", capacity: 16 },
    { id: "meal_6", name: "Segedínsky guláš s knedľou", desc: "Bravčové mäso, kyslá kapusta, parená knedľa", category: "Mäsité", tint: "#f6c89f", allergens: ["1, 3, 7"], icon: "🍛", capacity: 14 },
    { id: "meal_7", name: "Treska na masle", desc: "Varené zemiaky s petržlenovou vňaťou", category: "Ryba", tint: "#d8c8f7", allergens: ["4, 7"], icon: "🐟", capacity: 11 },
    { id: "meal_8", name: "Cestoviny s bazalkovým pestom", desc: "Paradajky, rukola, píniové oriešky", category: "Vegetariánske", tint: "#bfe3c6", allergens: ["veg", "1, 7, 8"], icon: "🍝", capacity: 10 },
    { id: "meal_9", name: "Caesar šalát s kuracím mäsom", desc: "Rímsky šalát, krutóny, parmezán, dresing", category: "Hydina", tint: "#bcd3f7", allergens: ["1, 3, 4, 7"], icon: "🥗", capacity: 8 }
  ];

  /* One MealOnDay row as /menu/today sends it: the dish, plus what is true
     about it on this one day. `withMine` because /menu/week omits orderedByMe
     — the week carries myOrder per day instead. */
  function mealRow(dayKey, slot, orderCount, withMine, minePicked) {
    var m = MEALS[slot - 1];
    var row = {
      mealOnDayId: "mod_" + dayKey + "_" + slot,
      slot: slot,
      id: m.id,
      name: m.name,
      desc: m.desc,
      category: m.category,
      tint: m.tint,
      allergens: m.allergens.slice(),
      icon: m.icon,
      capacity: m.capacity,
      orderCount: orderCount
    };
    if (withMine) row.orderedByMe = !!minePicked;
    return row;
  }

  function dayMeals(dayKey, counts, withMine) {
    return counts.map(function (n, i) {
      return mealRow(dayKey, i + 1, n, withMine, false);
    });
  }

  /* The dish inside myOrder is the same object the meal list carries, without
     the per-day numbers — mealDto() on the server. */
  function orderedMeal(slot) {
    var m = MEALS[slot - 1];
    return {
      id: m.id, name: m.name, desc: m.desc, category: m.category,
      tint: m.tint, allergens: m.allergens.slice(), icon: m.icon
    };
  }

  /* GET /menu/today
     Wednesday is the day whose ordering window is open right now, so it is the
     day this screen can act on. Slot 9 is sold out (8 of 8) and slot 2 nearly
     so — the two states the card has to survive. */
  const TODAY_MENU = {
    day: {
      key: "2026-09-16",
      label: "Streda 16. septembra 2026",
      isServing: true,
      open: true,
      deadline: "2026-09-15T14:00:00.000Z"
    },
    balanceCents: 4750,
    meals: dayMeals("2026-09-16", [1, 36, 1, 4, 0, 2, 0, 0, 8], true),
    myOrder: null
  };

  /* GET /menu/week — Monday 14 to Friday 18 September 2026.
     Mon/Tue closed (their windows have passed), Wed open, Thu not open yet
     (its window starts Wednesday 08:00), Fri a holiday: the canteen is not
     cooking, which is not the same as a missed deadline. */
  const WEEK_MENU = {
    monday: "2026-09-14",
    days: [
      {
        key: "2026-09-14",
        label: "Pondelok 14. septembra 2026",
        isServing: true,
        open: false,
        deadline: "2026-09-13T14:00:00.000Z",
        weekday: "Po",
        dateNumber: 14,
        shortLabel: "14. septembra 2026",
        meals: dayMeals("2026-09-14", [12, 9, 7, 3, 5, 2, 1, 4, 6], false),
        myOrder: { mealOnDayId: "mod_2026-09-14_1", slot: 1, meal: orderedMeal(1), status: "SERVED" }
      },
      {
        key: "2026-09-15",
        label: "Utorok 15. septembra 2026",
        isServing: true,
        open: false,
        deadline: "2026-09-14T14:00:00.000Z",
        weekday: "Ut",
        dateNumber: 15,
        shortLabel: "15. septembra 2026",
        meals: dayMeals("2026-09-15", [8, 11, 14, 2, 6, 3, 1, 2, 5], false),
        myOrder: { mealOnDayId: "mod_2026-09-15_3", slot: 3, meal: orderedMeal(3), status: "ORDERED" }
      },
      {
        key: "2026-09-16",
        label: "Streda 16. septembra 2026",
        isServing: true,
        open: true,
        deadline: "2026-09-15T14:00:00.000Z",
        weekday: "St",
        dateNumber: 16,
        shortLabel: "16. septembra 2026",
        meals: dayMeals("2026-09-16", [1, 36, 1, 4, 0, 2, 0, 0, 8], false),
        myOrder: null
      },
      {
        key: "2026-09-17",
        label: "Štvrtok 17. septembra 2026",
        isServing: true,
        open: false,
        deadline: "2026-09-16T14:00:00.000Z",
        weekday: "Št",
        dateNumber: 17,
        shortLabel: "17. septembra 2026",
        meals: dayMeals("2026-09-17", [0, 2, 1, 0, 0, 0, 0, 0, 1], false),
        myOrder: null
      },
      {
        key: "2026-09-18",
        label: "Piatok 18. septembra 2026",
        isServing: false,
        open: false,
        deadline: "2026-09-17T14:00:00.000Z",
        weekday: "Pi",
        dateNumber: 18,
        shortLabel: "18. septembra 2026",
        meals: [],
        myOrder: null
      }
    ]
  };

  /* GET /orders (student) — the `orders` array of that response.
     The server hides CANCELLED rows from a student but keeps AUTO_CANCELLED,
     so a lunch the system dropped still shows its "Zrušené" chip. There is no
     weekday, dateNumber or label here: the list gets a plain ISO date. */
  const MY_ORDERS = [
    { id: "ord_5", mealOnDayId: "mod_2026-09-15_3", date: "2026-09-15", slot: 3, meal: { id: "meal_3", name: "Kuracie prsia na grile", category: "Hydina" }, status: "ORDERED", chip: { st: "ok", l: "Objednané" } },
    { id: "ord_4", mealOnDayId: "mod_2026-09-14_1", date: "2026-09-14", slot: 1, meal: { id: "meal_1", name: "Bryndzové halušky so slaninou", category: "Mäsité" }, status: "SERVED", chip: { st: "ok", l: "Vydané" } },
    { id: "ord_3", mealOnDayId: "mod_2026-09-11_2", date: "2026-09-11", slot: 2, meal: { id: "meal_2", name: "Vyprážaný bravčový rezeň", category: "Mäsité" }, status: "SERVED", chip: { st: "ok", l: "Vydané" } },
    { id: "ord_2", mealOnDayId: "mod_2026-09-10_8", date: "2026-09-10", slot: 8, meal: { id: "meal_8", name: "Cestoviny s bazalkovým pestom", category: "Vegetariánske" }, status: "AUTO_CANCELLED", chip: { st: "bad", l: "Zrušené" } },
    { id: "ord_1", mealOnDayId: "mod_2026-09-09_9", date: "2026-09-09", slot: 9, meal: { id: "meal_9", name: "Caesar šalát s kuracím mäsom", category: "Hydina" }, status: "SERVED", chip: { st: "ok", l: "Vydané" } }
  ];

  /* GET /announcements — the `announcements` array.
     `meta` is the server's own wording (smartTimeLabels), already relative to
     the stopped clock above; `createdAt` is the ISO the label came from. */
  const ANNOUNCEMENTS = [
    { id: "a1", title: "Objednávky sa uzatvárajú deň vopred o 14:00", body: "Na obed v konkrétny deň sa objednáva deň vopred, od 8:00 do 14:00. Platí pre všetky ročníky.", important: true, author: "Katarína Vrábľová", createdAt: "2026-09-15T09:12:00.000Z", meta: "dnes 09:12" },
    { id: "a2", title: "Tri nové vegetariánske jedlá od októbra", body: "Do ponuky pribudnú tri bezmäsité jedlá. Hlasovanie o štvrtom nájdete v školskom Classroome do piatka.", important: false, author: "Katarína Vrábľová", createdAt: "2026-09-14T08:05:00.000Z", meta: "včera 08:05" },
    { id: "a3", title: "Výdaj obedov počas testovania", body: "V utorok 15. septembra sa vydáva až od 12:20 kvôli celoškolskému testovaniu v telocvični.", important: false, author: "Katarína Vrábľová", createdAt: "2026-09-11T13:05:00.000Z", meta: "11. septembra 2026 13:05" },
    { id: "a4", title: "Jesenné prázdniny bez výdaja", body: "Od 28. do 31. októbra sa obedy nevydávajú. Objednávky na tieto dni sa zrušia automaticky.", important: false, author: "Katarína Vrábľová", createdAt: "2026-09-08T10:22:00.000Z", meta: "8. septembra 2026 10:22" }
  ];

  /* GET /students (manager) — the `students` array, name ascending as the
     server sorts it. classCode is the Slovak trieda and belongs on every row
     that names a student. */
  const STUDENTS = [
    { id: "s4", name: "Adam Šimko",       username: "adam.simko",       classCode: "2.B", active: true,  balanceCents: 200 },
    { id: "s6", name: "Lenka Michalcová", username: "lenka.michalcova", classCode: "1.A", active: true,  balanceCents: 0 },
    { id: "s1", name: "Matej Hrušovský",  username: "matej.hrusovsky",  classCode: "3.A", active: true,  balanceCents: 4750 },
    { id: "s2", name: "Nina Bartošová",   username: "nina.bartosova",   classCode: "3.A", active: true,  balanceCents: 11200 },
    { id: "s7", name: "Peter Kollár",     username: "peter.kollar",     classCode: "4.A", active: true,  balanceCents: 3300 },
    { id: "s8", name: "Sofia Danišová",   username: "sofia.danisova",   classCode: "4.A", active: false, balanceCents: 6100 },
    { id: "s3", name: "Tomáš Ondrejka",   username: "tomas.ondrejka",   classCode: "2.B", active: true,  balanceCents: 550 },
    { id: "s5", name: "Zuzana Kráľová",   username: "zuzana.kralova",   classCode: "1.A", active: true,  balanceCents: 8850 }
  ];

  /* Managers. The API has one Account model with a role; this is the MANAGER
     row, kept apart only so mock sign-in can tell it from a student. The
     seeded database has exactly one, and the username is "prengac".

     NO PASSWORD APPEARS IN THIS FILE and none ever should — anyone can read
     it. Mock mode accepts any password and says so on screen. */
  const MANAGERS = [
    { id: "m1", name: "Katarína Vrábľová", username: "prengac", role: "MANAGER", classCode: null }
  ];

  /* GET /orders?date= (manager) — the `orders` array for the day being served.
     student and meal are STRINGS here, not objects, and every row carries the
     trieda and a ready-made chip. Sorted by slot, then student name. */
  const KITCHEN_ORDERS = [
    { id: "k1", student: "Adam Šimko",       classCode: "2.B", slot: 1, meal: "Bryndzové halušky so slaninou", status: "ORDERED", chip: { st: "ok", l: "Objednané" } },
    { id: "k2", student: "Nina Bartošová",   classCode: "3.A", slot: 1, meal: "Bryndzové halušky so slaninou", status: "SERVED",  chip: { st: "ok", l: "Vydané" } },
    { id: "k3", student: "Peter Kollár",     classCode: "4.A", slot: 2, meal: "Vyprážaný bravčový rezeň",      status: "SERVED",  chip: { st: "ok", l: "Vydané" } },
    { id: "k4", student: "Matej Hrušovský",  classCode: "3.A", slot: 3, meal: "Kuracie prsia na grile",        status: "ORDERED", chip: { st: "ok", l: "Objednané" } },
    { id: "k5", student: "Zuzana Kráľová",   classCode: "1.A", slot: 3, meal: "Kuracie prsia na grile",        status: "ORDERED", chip: { st: "ok", l: "Objednané" } },
    { id: "k6", student: "Tomáš Ondrejka",   classCode: "2.B", slot: 5, meal: "Zeleninové rizoto",             status: "ORDERED", chip: { st: "ok", l: "Objednané" } },
    { id: "k7", student: "Lenka Michalcová", classCode: "1.A", slot: 9, meal: "Caesar šalát s kuracím mäsom",  status: "ORDERED", chip: { st: "ok", l: "Objednané" } }
  ];

  Object.assign(S, {
    LUNCH_PRICE_CENTS, MAX_TOPUP_CENTS,
    eur, parseAmountCents, lunchesLeft,
    CATEGORY, CATEGORY_LABELS, category, allergenLabel,
    STATUS_CHIP, chip,
    plural, pluralObed, pluralZaznam, pluralUcet,
    initials, usernameOf, usernameFromName, looksLikeUsername,
    MOCK_NOW, KITCHEN_DATE, MEALS,
    ME, TODAY_MENU, WEEK_MENU, MY_ORDERS, ANNOUNCEMENTS,
    STUDENTS, MANAGERS, KITCHEN_ORDERS
  });
})(window.SKYRO);
