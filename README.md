# Skyro Obedy — Administrácia

Canteen management for Skyro (skyro.ai), a Slovak high school. Pure HTML, CSS
and JavaScript: no framework, no build step, no dependencies.

> ## ⚠️ There is no authentication
>
> This panel creates student accounts and moves money. Anyone who can reach the
> URL can do both. **Put an access control layer in front of it before it is
> reachable from the internet** — Cloudflare Access (Zero Trust) restricted to
> staff email addresses is the least-effort option and needs no code change.
>
> `prihlasenie.html` is a login *screen*, not a login *system*. It checks
> nothing. Treat it as a placeholder until the backend issues real sessions.

## Run

Open `index.html` in a browser. It works from `file://` with no server.

```bash
python3 -m http.server 8091   # then http://localhost:8091
```

## Deploy — Cloudflare Pages

| Setting | Value |
|---|---|
| Build command | *(leave empty)* |
| Build output directory | `/` (this folder) |
| Framework preset | None |

Then add a Cloudflare Access policy over the whole site. `_headers` already
sends `X-Robots-Tag: noindex` and `no-store` on HTML, and `robots.txt`
disallows crawling — but none of that is access control.

## Pages

| File | Screen |
|---|---|
| `index.html` | Dashboard — today's orders, takings, per-meal breakdown |
| `menu.html` | Manage the menu — add, edit, remove, publish |
| `oznamy.html` | Post an announcement, with a live preview of what students see |
| `ziaci.html` | Student accounts — create, credit, activate/deactivate |
| `schranka.html` | Message inbox |
| `prihlasenie.html` | Login screen (see the warning above) |
| `404.html` | Not found |

## How it is put together

```
index.html            each page loads the same five core scripts, then its own
css/skyro.css         the design system (colours, cards, rail, chips, glass)
css/layout.css        page layout + fixes; replaces what Tailwind used to do
js/logo.js            the Skyro wordmark as inline SVG
js/data.js            ALL application data (see "Connecting a backend")
js/ui.js              helpers: $, esc, icon, chip, pageHead, announce
js/nav.js             this app's identity: nav items, who is signed in
js/shell.js           renders the rail and topbar; S.mount() returns <main>
js/pages/<name>.js    one file per page, an IIFE over window.SKYRO
```

Every page script follows the same shape:

```js
(function (S) {
  "use strict";
  var root = S.mount();          // draws the chrome, returns <main>
  function render() { root.innerHTML = "..."; bind(); }
  function bind()   { /* re-attach listeners after every render */ }
  render();
})(window.SKYRO);
```

Everything interpolated into `innerHTML` goes through `S.esc()`, and money
always goes through `S.eur()`.

## Connecting a backend

**All data lives in `js/data.js` and nothing else reads data from anywhere
else.** Replace the literal arrays with fetches, keep the same shapes, and the
page scripts do not change.

| Symbol | What it is |
|---|---|
| `MEALS` | the menu — name, description, category, tint, allergens, icon, portions |
| `STUDENTS`, `LEDGER` | accounts, balances, and credit movements |
| `POSTS` | announcements |
| `CONVS`, `THREAD` | conversations and messages |
| `LUNCH_PRICE`, `eur()`, `lunchesLeft()` | money |
| `schoolEmail()` | derives the school address from a name, diacritics stripped |

Three invariants the backend must hold, each learned from a bug found here:

1. **A lunch is charged once per (student, day).** A meal change before the
   deadline is an update, not a second debit.
2. **The ledger is the record.** Derive the balance from the sum of movements;
   a stored balance that disagrees with its ledger is a bug.
3. **Crediting must be idempotent and auditable.** Every top-up already records
   who did it and when — keep that, and make the write safe to retry.

## Keeping the two apps in sync

`css/skyro.css`, `js/data.js`, `js/logo.js`, `js/ui.js` and `js/shell.js` are
duplicated in the student app so each folder deploys on its own. If you change
one, change the other:

```bash
diff -rq ../student/css ./css
diff -rq ../student/js/data.js ./js/data.js
```
