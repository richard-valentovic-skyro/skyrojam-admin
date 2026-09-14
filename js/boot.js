/* Page startup.

   Page scripts do not run immediately any more — they register with
   S.page(fn) and boot calls them once the data is in. That single indirection
   is what lets data come from a server instead of a literal array, without
   any page script knowing the difference.

   Sequence:
     1. shell renders the rail and topbar, so the app never flashes blank
     2. a loading state goes into <main>
     3. S.api.bootstrap() resolves (instantly in mock mode)
     4. the payload is written onto window.SKYRO, replacing the fixtures
     5. the registered page function runs and renders as it always did

   A failure renders a retry, in Slovak, inside the shell. */
window.SKYRO = window.SKYRO || {};
(function (S) {
  "use strict";

  /* Distinguishes this page load, for idempotency keys. Not a clock read:
     a counter that survives nothing is exactly what we want here. */
  S.BOOT_ID = String(
    (window.performance && Math.round(window.performance.now())) || 0
  );

  var pageFn = null;

  function page(fn) { pageFn = fn; }

  function loadingHtml() {
    return '<div class="boot"><span class="boot-spin" aria-hidden="true"></span>' +
      '<p class="boot-msg">Načítavame…</p></div>';
  }

  function errorHtml(err) {
    return '<div class="empty" role="alert">' +
      S.icon("cloud_off") +
      "<b>Údaje sa nepodarilo načítať</b>" +
      '<p class="boot-msg">' + S.esc(err && err.message ? err.message : "Skúste to znova.") + "</p>" +
      '<button class="btn" id="boot-retry" type="button">' + S.icon("refresh") + "Skúsiť znova</button>" +
      "</div>";
  }

  /* Everything the payload carries, mapped onto the globals page scripts
     already read. Keys the server omits leave the fixture in place. */
  function apply(payload) {
    if (!payload) return;
    var map = {
      meals: "MEALS", week: "WEEK", orders: "ORDERS", posts: "POSTS",
      conversations: "CONVS", thread: "THREAD", students: "STUDENTS",
      ledger: "LEDGER", staff: "STAFF"
    };
    Object.keys(map).forEach(function (k) {
      if (payload[k] !== undefined && payload[k] !== null) S[map[k]] = payload[k];
    });
    if (payload.price !== undefined) S.LUNCH_PRICE = payload.price;
    if (payload.me && payload.me.id) S.CURRENT_STUDENT_ID = payload.me.id;
    if (payload.me && payload.me.name && S.APP) S.APP.account = payload.me.name;
    S.TOTAL_TODAY = (S.MEALS || []).reduce(function (a, m) { return a + (m.c || 0); }, 0);
  }

  function run(root) {
    try {
      pageFn(S, root);
    } catch (e) {
      root.innerHTML = errorHtml({ message: "Stránku sa nepodarilo zobraziť." });
      if (window.console) window.console.error(e);
    }
  }

  function start() {
    /* The guard already redirected; do not paint a page we are leaving. */
    if (S.session && S.session.allowed === false) return;

    var root = S.mount();

    if (!pageFn) return; // a page with no script (should not happen)

    root.innerHTML = loadingHtml();

    S.api.bootstrap().then(
      function (payload) {
        apply(payload);
        run(root);
      },
      function (err) {
        root.innerHTML = errorHtml(err);
        var retry = S.$("#boot-retry");
        if (retry) retry.addEventListener("click", start);
      }
    );
  }

  /* Pages that render their own chrome (the login screen) opt out entirely
     and keep running immediately. */
  function pageWithoutShell(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () { fn(S); });
    } else {
      fn(S);
    }
  }

  S.page = page;
  S.pageWithoutShell = pageWithoutShell;
  S.bootStart = start;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { if (pageFn) start(); });
  } else {
    window.setTimeout(function () { if (pageFn) start(); }, 0);
  }
})(window.SKYRO);
