/* Prehľad — the vedúca jedálne's morning glance: how many lunches are ordered
   for today, what they are worth, how they split across the meals, and the
   list the kitchen works down while it hands them out.

   Everything on this page is derived at render time from one response and
   nothing is kept. The takings are count × LUNCH_PRICE_CENTS, two integers
   multiplied where they are printed — never a running total added to on each
   render, which is the bug the earlier build shipped, and never a float.

   The kitchen list is the only write here. It follows the same rule as every
   other write in the app: the button disables itself, says "Ukladá sa…", and
   the row keeps the status the server gave it until the server gives another
   one. A second click while the request is open is dropped, not queued — a
   lunch cannot be handed out twice.

   The CSV export is a read, and a deliberately blunt one. A static page cannot
   be trusted to trigger a file download — a blob URL behind an <a download> is
   blocked, ignored or silently swallowed often enough that the button would
   look alive and do nothing. So the export puts the text on screen and asks to
   have it copied. That is honest about what this page can actually do. */
var page = function (S, root) {
  "use strict";

  /* Under this many portions a bar is drawn in the pale violet: the kitchen
     cooks those in one pot and wants to see them apart from the big two. */
  var QUIET = 20;

  var sheet   = S.__kitchen || {};
  var roster  = S.__students || [];
  var orders  = sheet.orders || [];

  /* The count is the server's own, not our row tally: the sheet may be a page
     of a longer list, and the takings must match what the canteen billed.
     Only when it sends none do we count the rows that stand. */
  var count = typeof sheet.count === "number" ? sheet.count : cooked().length;

  /* What is in flight: { kind: "serve", id } or { kind: "export" }. One at a
     time, so every control on the page is inert while any of them is open. */
  var busy = null;
  var note = null;   // { ok: Boolean, text: String } — the last thing that happened
  var csv = null;    // the export, once it has arrived

  /* ------------------------------------------------------------ reading */

  function orderById(id) {
    var found = null;
    orders.forEach(function (o) { if (o.id === id) found = o; });
    return found;
  }

  /* A cancelled order is not a portion: nobody cooks it and nobody hands it
     out. It stays visible in the list — the kitchen should see that a name it
     expected is gone — but it is counted nowhere. */
  function cooked() {
    return orders.filter(function (o) { return o.status !== "CANCELLED"; });
  }

  function servedCount() {
    return orders.filter(function (o) { return o.status === "SERVED"; }).length;
  }

  function pending() {
    return orders.filter(function (o) { return o.status === "ORDERED"; });
  }

  /* Active accounts that cannot pay for a single lunch. Derived from the
     roster on every render, so it can never drift from the Žiaci page. */
  function lowCredit() {
    return roster.filter(function (s) {
      return s.active && Number(s.balanceCents) < S.LUNCH_PRICE_CENTS;
    }).length;
  }

  /* 1 čaká, 2–4 čakajú, 5+ čaká. */
  function waits(n) { return n >= 2 && n <= 4 ? "čakajú" : "čaká"; }

  /* "2026-09-16" -> "16. septembra 2026". A format, not a clock: the date is
     the server's and is split as text, so no timezone can move it a day. */
  var MONTHS = ["januára", "februára", "marca", "apríla", "mája", "júna",
                "júla", "augusta", "septembra", "októbra", "novembra", "decembra"];

  function dateLabel(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    if (!m) return iso ? String(iso) : "Dnešný rozpis";
    var month = MONTHS[Number(m[2]) - 1];
    if (!month) return String(iso);
    return Number(m[3]) + ". " + month + " " + Number(m[1]);
  }

  /* Portions per meal, grouped by the name the server sent. A bare {} would
     let a meal called "constructor" collide with Object's own keys, so the
     map has no prototype at all. */
  function breakdown() {
    var byName = Object.create(null);
    var out = [];

    cooked().forEach(function (o) {
      var name = (o.meal && o.meal.name) || "Neznáme jedlo";
      if (!byName[name]) {
        byName[name] = { name: name, count: 0 };
        out.push(byName[name]);
      }
      byName[name].count += 1;
    });

    out.sort(function (a, b) { return b.count - a.count; });
    return out;
  }

  /* -------------------------------------------------------------- markup */

  function heroHtml() {
    var served = servedCount();
    var total = cooked().length;

    return '<div class="hero">' +
      '<div class="hl">Objednávky na dnes</div>' +
      '<div class="hn">' + S.esc(count) + "</div>" +
      '<div class="hd">' + S.icon("payments") +
        S.esc(S.eur(count * S.LUNCH_PRICE_CENTS)) + "</div>" +
      (total
        ? '<div class="hd" style="margin-left:8px">' + S.icon("room_service") +
          "vydaných " + S.esc(served) + " z " + S.esc(total) + "</div>"
        : "") +
      "</div>";
  }

  /* One shortcut row: a violet disc, the label, an optional trailing chip and
     the chevron. The two that go somewhere are links; the export is a button
     because it acts on this page. Anchors need the underline turned off
     explicitly — skyro.css resets no link styling. */
  function qlink(ic, label, href, trail) {
    return '<a class="qbtn" href="' + S.esc(href) + '" style="text-decoration:none">' +
      '<span class="disc">' + S.icon(ic) + "</span>" +
      S.esc(label) + (trail || "") + S.icon("chevron_right", "ar") + "</a>";
  }

  function exportHtml() {
    var working = !!busy && busy.kind === "export";

    return '<button class="qbtn" type="button" id="export"' +
      (busy ? " disabled" : "") + (working ? ' aria-busy="true"' : "") + ">" +
      '<span class="disc">' + S.icon(working ? "progress_activity" : "table_view") + "</span>" +
      (working ? "Načítavame…" : "Export rozpisu do kuchyne") +
      (working ? "" : S.icon("chevron_right", "ar")) + "</button>";
  }

  function csvHtml() {
    if (csv === null) return "";

    return '<div class="plain">' +
      '<div class="ph"><span class="pd">Rozpis do kuchyne (CSV)</span>' +
        '<button class="sq" type="button" id="csv-close" aria-label="Zavrieť rozpis">' +
          S.icon("close") + "</button></div>" +
      /* tabindex so the box can be scrolled from the keyboard; it is wider
         than the panel and must not push the page sideways. */
      '<pre class="csvbox" id="csv-text" tabindex="0">' + S.esc(csv) + "</pre>" +
      '<p class="note mt-s">Súbor sa odtiaľto nesťahuje. Označte text (Ctrl+A) ' +
        "a skopírujte ho (Ctrl+C) do tabuľky alebo e-mailu.</p>" +
      "</div>";
  }

  /* One meal's share of the day. The widest bar is the busiest meal, not the
     whole day, so the top row always reaches the end of its track. .pv carries
     the count as text — the bar is decoration and never the only place the
     number appears. */
  function prow(m, max) {
    var pct = max > 0 ? Math.round((m.count / max) * 100) : 0;

    return '<div class="prow' + (m.count < QUIET ? " q" : "") + '">' +
      '<span class="pn">' + S.esc(m.name) + "</span>" +
      '<span class="pv">' + S.esc(m.count) + "</span>" +
      '<span class="pk"><span class="pf" style="width:' + pct + '%"></span></span>' +
      "</div>";
  }

  function breakdownHtml() {
    var rows = breakdown();
    var max = 0;
    rows.forEach(function (m) { if (m.count > max) max = m.count; });

    return '<div class="plain">' +
      '<div class="ph"><span class="pd">Rozdelenie podľa jedla</span>' +
        '<span class="pd">Porcie</span></div>' +
      (rows.length
        ? '<div class="prog">' + rows.map(function (m) { return prow(m, max); }).join("") + "</div>"
        : '<p class="pempty"><b>Na dnes nie je nič objednané</b>' +
          "Kým žiaci objednávajú, tento rozpis zostáva prázdny.</p>") +
      "</div>";
  }

  /* The action a row is up to. Only an ORDERED lunch can be handed out; a
     served one says so, and anything else — cancelled, or a status this
     build does not know — is reported rather than dressed as a button. */
  function actionHtml(o) {
    if (o.status === "SERVED")    return S.chip("ok", "Vydané");
    if (o.status === "CANCELLED") return S.chip("bad", "Zrušené");
    if (o.status !== "ORDERED")   return S.chip("open", "Stav neznámy");

    var working = !!busy && busy.kind === "serve" && busy.id === o.id;

    return '<button class="btn soft" type="button" data-serve="' + S.esc(o.id) + '"' +
      (busy ? " disabled" : "") + (working ? ' aria-busy="true"' : "") + ">" +
      S.icon(working ? "progress_activity" : "done") +
      (working ? "Ukladá sa…" : "Vydať") + "</button>";
  }

  function mealLine(meal) {
    var parts = [];
    if (meal.name) parts.push(meal.name);
    if (meal.slot) parts.push("Obed " + meal.slot);
    return parts.join(" · ") || "Obed";
  }

  function orderRow(o) {
    var student = o.student || {};
    var meal = o.meal || {};
    var name = student.name || student.username || "Neznámy žiak";

    return '<div class="erow">' +
      '<span class="en">' + S.esc(S.initials(name)) + "</span>" +
      '<span class="ei">' +
        '<span class="et">' + S.esc(name) + "</span>" +
        '<span class="ed">' + S.esc(mealLine(meal)) + "</span>" +
      "</span>" +
      '<span class="kact">' + actionHtml(o) + "</span>" +
    "</div>";
  }

  function kitchenHtml() {
    var left = pending().length;

    return "<div>" +
      /* The tally is only worth saying while there is something left to hand
         out; on a finished list the chip in the header has already said so. */
      '<div class="gl" id="kitchen-label">Výdaj obedov' +
        (left ? " · " + S.esc(left) + " " + waits(left) + " na výdaj" : "") + "</div>" +
      /* The container takes focus while a write is open: every button in the
         list is disabled for that moment, and a disabled button cannot hold
         the keyboard. Without somewhere to park it, one click would drop the
         user at the top of the document. */
      '<div class="stack" id="kitchen" tabindex="-1" role="group" aria-labelledby="kitchen-label">' +
        (orders.length
          ? orders.map(orderRow).join("")
          : '<div class="empty">' + S.icon("receipt_long") +
            "<b>Na dnes nie sú žiadne objednávky</b>" +
            '<p class="boot-msg">Hneď ako žiak objedná obed, objaví sa tu ' +
              "riadok na výdaj.</p></div>") +
      "</div>" +
      (note
        ? '<p class="note mt-s" role="' + (note.ok ? "status" : "alert") +
          '" style="font-weight:600;color:' +
          (note.ok ? "var(--c-green)" : "var(--c-rose)") + '">' +
          S.esc(note.text) + "</p>"
        : "") +
      "</div>";
  }

  function headChip() {
    if (!cooked().length) return S.chip("open", "Žiadne objednávky");
    var left = pending().length;
    return left
      ? S.chip("warn", left + " " + waits(left) + " na výdaj")
      : S.chip("ok", "Všetko vydané");
  }

  /* --------------------------------------------------------------- view */

  function render(focus) {
    var low = lowCredit();
    var credit = low > 0
      ? '<span class="chip bad push"><i></i>' + S.esc(low) + " bez kreditu</span>"
      : "";

    root.innerHTML =
      S.pageHead("Prehľad", dateLabel(sheet.date), headChip()) +
      '<div class="split aside-main">' +
        '<div class="stack l">' +
          heroHtml() +
          qlink("group", "Žiaci a kredit", "ziaci.html", credit) +
          qlink("campaign", "Nový oznam", "oznamy.html") +
          exportHtml() +
        "</div>" +

        '<div class="stack l">' +
          csvHtml() +
          breakdownHtml() +
          kitchenHtml() +
        "</div>" +
      "</div>";

    bind();
    applyFocus(focus);
  }

  /* An order id goes into a data attribute, never into a CSS selector: one
     quote in an id the server chose would turn querySelector into a thrown
     SyntaxError in the middle of a click handler. */
  function serveButton(id) {
    var found = null;
    S.$$("#kitchen [data-serve]", root).forEach(function (b) {
      if (b.getAttribute("data-serve") === id) found = b;
    });
    return found;
  }

  /* render() replaces innerHTML, so whatever had focus is destroyed. Every
     path that re-renders says where the keyboard should land, and this chain
     guarantees it lands somewhere — never on <body>. */
  function applyFocus(focus) {
    if (!focus) return;

    var el = null;
    if (focus.serve) el = serveButton(focus.serve);
    else if (focus.sel) el = S.$(focus.sel, root);

    if (!el || el.disabled) {
      /* The button that was pressed is gone or disabled: the next lunch to
         hand out is where the kitchen is going anyway. */
      var next = pending()[0];
      el = next ? serveButton(next.id) : null;
    }
    if (!el || el.disabled) el = S.$("#kitchen", root);
    if (!el) el = root; // <main tabindex="-1">
    if (el.focus) el.focus();
  }

  function bind() {
    S.$$("#kitchen [data-serve]", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (btn.disabled) return;
        serve(btn.getAttribute("data-serve"));
      });
    });

    var exp = S.$("#export", root);
    if (exp) {
      exp.addEventListener("click", function () {
        if (exp.disabled) return;
        runExport();
      });
    }

    var close = S.$("#csv-close", root);
    if (close) {
      close.addEventListener("click", function () {
        csv = null;
        render({ sel: "#export" }); // back to the control that opened it
      });
    }
  }

  /* -------------------------------------------------------------- writes */

  function serve(id) {
    /* A write is already on its way. A second press is not a second lunch:
       it is dropped, never queued behind the first. */
    if (busy) return;

    var row = orderById(id);
    if (!row) return;

    busy = { kind: "serve", id: id };
    note = null;
    render({ serve: id });

    S.api.serveOrder(id).then(
      function (resp) {
        busy = null;

        /* The status drawn is the one that came back, never the one that was
           asked for. A confirmation with no status in it confirms nothing we
           can act on, so the row is left exactly as it was and says why. */
        if (!resp || !resp.status) {
          note = { ok: false, text: "Server nepotvrdil výdaj. Obnovte stránku a skúste to znova." };
          render({ serve: id });
          S.announce(S.$("#live"), note.text);
          return;
        }

        row.status = resp.status;
        /* The name is left in the nominative and set off with a dash rather
           than run into "obed pre …", which would need it declined — and a
           Slovak surname cannot be declined by a template. */
        var who = (row.student && row.student.name) || "Žiak";
        note = { ok: true, text: who + " — obed je vydaný." };

        /* Computed after the row changed, so the keyboard lands on the next
           lunch still waiting rather than on the one just handed out. */
        var next = pending()[0];
        render(next ? { serve: next.id } : { sel: "#kitchen" });
        S.announce(S.$("#live"), note.text);
      },
      /* Two-argument then rather than .catch(): a bug thrown while rendering
         a success must not reach the kitchen dressed as a refused write. */
      function (err) {
        /* Nothing was handed out, so nothing on screen moves but this line. */
        busy = null;
        note = { ok: false, text: (err && err.message) || "Nastala chyba. Skúste to znova." };
        render({ serve: id });
        S.announce(S.$("#live"), note.text);
      }
    );
  }

  /* ------------------------------------------------------------- export */

  /* A cell that contains a comma, a quote or a newline has to be quoted, or
     one meal name with a comma in it shifts every column after it. */
  function cell(v) {
    var s = String(v === null || v === undefined ? "" : v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /* The API answers text/csv as a string — api.js reads the content type and
     hands the text straight back. Mock mode has no CSV writer and answers with
     the same JSON sheet, so the rows are laid out here instead. That is a
     formatting of the server's own answer, the way cents become "5,50 €":
     nothing is in the file that was not in the response. */
  function asCsv(resp) {
    if (typeof resp === "string") return resp;

    var rows = resp && resp.orders;
    if (!rows) return null;

    var out = ["id,stav,ziak,pouzivatel,jedlo,obed"];
    rows.forEach(function (o) {
      var student = o.student || {};
      var meal = o.meal || {};
      out.push([
        cell(o.id), cell(o.status), cell(student.name), cell(student.username),
        cell(meal.name), cell(meal.slot)
      ].join(","));
    });
    return out.join("\n");
  }

  function runExport() {
    if (busy) return;

    busy = { kind: "export" };
    note = null;
    render({ sel: "#kitchen" }); // the export button is disabled for the moment

    S.api.kitchenOrders({ format: "csv" }).then(
      function (resp) {
        busy = null;
        var text = asCsv(resp);

        if (!text) {
          note = { ok: false, text: "Server nevrátil rozpis. Skúste to o chvíľu." };
          render({ sel: "#export" });
          S.announce(S.$("#live"), note.text);
          return;
        }

        csv = text;
        render({ sel: "#csv-text" });
        S.announce(S.$("#live"), "Rozpis je pripravený na skopírovanie.");
      },
      function (err) {
        busy = null;
        note = { ok: false, text: (err && err.message) || "Nastala chyba. Skúste to znova." };
        render({ sel: "#export" });
        S.announce(S.$("#live"), note.text);
      }
    );
  }

  render();
};

/* Two reads, one spinner: boot holds the loading state until both land and
   shows its own retry, in Slovak, if either does not. The kitchen sheet is
   the page; the roster is only there so the Žiaci shortcut can say how many
   accounts cannot pay for lunch. */
page.load = function (S) {
  return Promise.all([S.api.kitchenOrders(), S.api.students()]).then(function (res) {
    S.__kitchen = res[0] || {};
    S.__students = (res[1] && res[1].students) || [];
  });
};

SKYRO.page(page);
