/* Content carried over verbatim from the mobile app.
   Slovak UI copy, real Slovak school-canteen food, and allergens using the
   EU Annex II numbering that Slovak canteens are legally required to print
   (1 lepok, 3 vajcia, 4 ryby, 7 mlieko, 8 orechy). Portions sum to 184. */

export type Tint = "t-blue" | "t-peach" | "t-green" | "t-lilac" | "t-cream" | "t-rose";

export type Meal = {
  n: string;
  d: string;
  cat: string;
  tint: Tint;
  a: string[];
  ic: string;
  c: number;
};

export const MEALS: Meal[] = [
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

export type Status = "ok" | "warn" | "bad" | "open";

export type WeekDay = {
  w: string;
  d: number;
  i: number | null;
  st: Status;
  l: string;
};

export const WEEK: WeekDay[] = [
  { w: "Po", d: 14, i: 0, st: "ok", l: "Objednané" },
  { w: "Ut", d: 15, i: 2, st: "warn", l: "Zmenené" },
  { w: "St", d: 16, i: 4, st: "ok", l: "Objednané" },
  { w: "Št", d: 17, i: null, st: "open", l: "Otvorené" },
  { w: "Pi", d: 18, i: null, st: "open", l: "Otvorené" },
];

export type Order = {
  w: string;
  d: number;
  meal: string;
  sub: string;
  st: Status;
  l: string;
};

export const ORDERS: { group: string; rows: Order[] }[] = [
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

export type Post = {
  imp?: boolean;
  t: string;
  b: string;
  m: string;
};

export const POSTS: Post[] = [
  {
    imp: true,
    t: "Uzávierka objednávok sa mení na 14:00",
    b: "Od pondelka 21. septembra sa objednávky na nasledujúci deň uzatvárajú o 14:00 namiesto 15:30. Platí pre všetky ročníky.",
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

export type Conv = { n: string; p: string; t: string; u: number };

export const CONVS: Conv[] = [
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

export type ChatItem =
  | { kind: "day"; label: string }
  | { kind: "msg"; from: "them" | "me"; text: string; at: string };

export const THREAD: ChatItem[] = [
  { kind: "day", label: "Piatok 11. septembra" },
  {
    kind: "msg",
    from: "them",
    text: "Dobrý deň Matej, objednávku na piatok som zrušila podľa vašej žiadosti.",
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

export const TOTAL_TODAY = MEALS.reduce((s, m) => s + m.c, 0); // 184

export function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function plural(n: number) {
  return n === 1 ? "jedlo" : n < 5 ? "jedlá" : "jedál";
}
