# Skyro Obedy — Administrácia

Part of **Skyro Obedy** — lunch ordering for Skyro (skyro.ai), a Slovak high
school specializing in innovative technologies and AI. Ported from the mobile
app design, relaid out for desktop.

This repository is **standalone**. The companion app lives in its own
repository: `skyro-obedy-student`.

## Run

```bash
npm install
npm run dev     # http://localhost:3001
npm run build   # static export into ./out
npm run lint
```

## Deploy — Cloudflare Pages

`output: "export"` is set, so this builds to plain static files. No adapter,
no Workers runtime.

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Output directory | `out` |
| Root directory | *(blank)* |

If a backend ever lands **inside** this app (Route Handlers or Server Actions),
remove `output: "export"` from `next.config.ts` and switch to
`@opennextjs/cloudflare`. A separate API called over `NEXT_PUBLIC_API_URL`
needs no change — see `.env.example`.

## Routes

| Route | Screen |
|---|---|
| `/` | Dashboard — today's orders, takings, per-meal breakdown |
| `/menu` | Manage menu — add, edit, remove, publish |
| `/oznamy` | Post announcement — with live preview |
| `/ziaci` | Student accounts — create, add credit, activate/deactivate |
| `/schranka` | Inbox — conversation list and thread |
| `/prihlasenie` | Login |

> **No authentication.** Anyone who can reach this site can create accounts and
> add credit. Put Cloudflare Access (or equivalent) in front of it until real
> auth exists.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 5 · Tailwind CSS 4.
No UI library, no icon package, no state manager, no auth library.

## ⚠️ src/shared is duplicated

`src/shared/` — the design system (`skyro.css`), the app shell (rail, topbar),
shared components, and the fixture data — is **byte-identical in skyro-obedy-student**.
Splitting the apps into separate repositories traded a shared package for this
duplication.

**If you change anything in `src/shared/`, make the same change in the other
repository.** Otherwise the two apps will drift apart visually.

## Design system

- `#6C29F2` violet on `#FAF9FE` paper, `#17123A` ink. Single accent.
- Plus Jakarta Sans throughout; Material Symbols Outlined at `wght 300`.
- Pastel category tints carry meaning: peach is meat, blue poultry, green
  vegetarian, lilac fish, cream soup and dessert.
- Shape rule: 22px cards, 16px tiles, 14px buttons, pills for status.
- **Glass** (`.glass`) is a web approximation of the liquid-glass material —
  `backdrop-filter` plus layered borders and an inner highlight, not Apple's
  API. Spent only on surfaces that float over content: the topbar, sticky
  action bars, the chat composer, icon discs, the login field. Flat content
  never gets glass. Falls back to solid fills under
  `prefers-reduced-transparency`.

## Content

UI copy is Slovak. The menu is real Slovak school-canteen food and allergens use
the EU Annex II numbering Slovak canteens are legally required to print
(1 lepok, 3 vajcia, 4 ryby, 7 mlieko, 8 orechy). One lunch costs **5,50 €**
(`src/shared/lib/pricing.ts` — the only place the price is written).

**There is no backend yet.** Every screen reads fixtures from
`src/shared/lib/`, so nothing persists — state lives in React and resets on
reload. That directory is the seam to replace when the API lands; no screen
fetches anything on its own.
