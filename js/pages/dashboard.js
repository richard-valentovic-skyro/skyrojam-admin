/* Prehľad — what the canteen is cooking today, and the way in to everything else.

   Read-only. Serving lunches was taken out of this screen: the endpoint still
   exists on the server, but nobody was going to stand at the counter tapping a
   laptop, so the page no longer pretends otherwise. What is left is the day's
   shape — how many lunches, what they come to, and which dish is winning — plus
   the links out and the kitchen export.

   Everything shown is the server's own figure. The kitchen sheet is

     { date, count, orders: [{ id, student, classCode, slot, meal, status, chip }] }

   where student and meal are plain STRINGS — the name and the dish, not objects
   with a .name inside them — and every row carries the trieda and a ready-made
   chip. What is counted here is portions rather than rows: a cancelled order is
   a line the server still sends and nobody cooks. */
var page = function (S, root) {
  "use strict";

  /* Under this many portions a bar is drawn pale, so the tail of the list
     reads as the tail rather than as a second group of equals. */
  var QUIET = 20;

  var sheet  = S.__kitchen || {};
  var roster = S.__students || [];
  var orders = sheet.orders || [];

  /* sheet.count is every row the server sent, cancellations included, and the
     route pages nothing — it answers with one whole day. So the honest figure
     for the lunches to cook, and for what they come to, is the rows themselves,
     which is also exactly what the breakdown below adds up. */
  var count = cooked().length;

  var busy = false;  // the export is out
  var note = null;   // { ok, text } — the last thing that happened
  var csv = null;    // the export, once it has arrived

  var MONTHS = ["januára", "februára", "marca", "apríla", "mája", "júna",
    "júla", "augusta", "septembra", "októbra", "novembra", "decembra"];

  /* A cancelled order is not a portion the kitchen has to cook — and the
     system cancels some of them itself, which counts exactly the same. */
  function cooked() {
    return orders.filter(function (o) {
      return o.status !== "CANCELLED" && o.status !== "AUTO_CANCELLED";
    });
  }

  /* The dish is a string on this sheet. Anything else is a payload this page
     does not understand, and it is grouped as such rather than read for a
     .name that is not there and printed as "undefined". */
  function mealName(o) {
    var name = o && typeof o.meal === "string" ? o.meal.trim() : "";
    return name || "Neznáme jedlo";
  }

  /* Every order comes with its own chip — { st, l } — already worded by the
     server, so it is used as it came and never mapped again here. A row that
     somehow arrives without one falls back to the same table the server uses.

     NOT S.chip(): data.js exports a chip READER of that name, but ui.js is
     loaded after it and overwrites S.chip with the chip MARKUP helper, so
     S.chip(order) returns a string of HTML with no .l on it. */
  function chipOf(o) {
    if (o && o.chip && o.chip.l) return o.chip;
    var map = S.STATUS_CHIP || {};
    return map[String((o && o.status) || "").toUpperCase()] ||
      { st: "open", l: "Neznámy stav" };
  }

  function lowCredit() {
    return roster.filter(function (s) {
      return s.active && Number(s.balanceCents) < S.LUNCH_PRICE_CENTS;
    }).length;
  }

  /* The date is the server's and is split as text, so no timezone can move it
     a day either way. */
  function dateLabel(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    if (!m) return iso ? String(iso) : "Dnešný rozpis";
    var month = MONTHS[Number(m[2]) - 1];
    if (!month) return String(iso);
    return Number(m[3]) + ". " + month + " " + Number(m[1]);
  }

  /* Portions per meal, grouped by the name the server sent. */
  function breakdown() {
    var byName = Object.create(null);
    var out = [];

    cooked().forEach(function (o) {
      var name = mealName(o);
      if (!byName[name]) {
        byName[name] = { name: name, count: 0 };
        out.push(byName[name]);
      }
      byName[name].count += 1;
    });

    out.sort(function (a, b) { return b.count - a.count; });
    return out;
  }

  function heroHtml() {
    return '<div class="hero">' +
      '<div class="hl">Objednávky na dnes</div>' +
      '<div class="hn">' + S.esc(count) + "</div>" +
      '<div class="hd">' + S.icon("payments") +
        S.esc(S.eur(count * S.LUNCH_PRICE_CENTS)) + "</div>" +
      "</div>";
  }

  function qlink(ic, label, href, trail) {
    return '<a class="qbtn" href="' + S.esc(href) + '">' +
      '<span class="disc">' + S.icon(ic) + "</span>" + S.esc(label) +
      (trail || "") + S.icon("chevron_right", "ar") + "</a>";
  }

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

  function exportHtml() {
    return '<button class="qbtn" type="button" id="export"' + (busy ? " disabled" : "") + ">" +
      '<span class="disc">' + S.icon(busy ? "progress_activity" : "table_view") + "</span>" +
      (busy ? "Ukladá sa…" : "Export rozpisu do kuchyne") +
      S.icon("chevron_right", "ar") + "</button>";
  }

  /* A static page cannot be trusted to hand the browser a file, so the export
     is shown to copy rather than offered as a download that might do nothing. */
  function csvHtml() {
    if (note && !note.ok) {
      return '<p class="note warn" role="alert">' + S.esc(note.text) + "</p>";
    }
    if (csv === null) return "";
    return '<div class="plain">' +
      '<div class="ph"><span class="pd">Rozpis pre kuchyňu</span>' +
        '<span class="pd">CSV</span></div>' +
      '<p class="note" style="padding:0 0 10px">Označte text a skopírujte ho ' +
        "do tabuľky.</p>" +
      '<pre id="csv" tabindex="0" style="margin:0;max-height:260px;overflow:auto;' +
        'font-size:12px;line-height:1.6;white-space:pre;background:var(--paper);' +
        'border-radius:var(--r-btn);padding:12px">' + S.esc(csv) + "</pre></div>";
  }

  function render(focusSel) {
    var low = lowCredit();
    var credit = low > 0
      ? '<span class="chip bad push"><i></i>' + S.esc(low) + " bez kreditu</span>"
      : "";

    root.innerHTML =
      S.pageHead("Prehľad", dateLabel(sheet.date)) +
      '<div class="split aside-main">' +
        '<div class="stack l">' +
          heroHtml() +
          qlink("edit_note", "Správa menu", "menu.html") +
          qlink("group", "Žiaci a kredit", "ziaci.html", credit) +
          qlink("campaign", "Nový oznam", "oznamy.html") +
          exportHtml() +
        "</div>" +

        '<div class="stack l">' +
          csvHtml() +
          breakdownHtml() +
        "</div>" +
      "</div>";

    bind();
    if (focusSel) {
      var el = S.$(focusSel, root);
      if (el) el.focus();
    }
  }

  function cell(v) {
    var s = String(v == null ? "" : v);
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /* The server may answer with CSV already, or with rows. Either is fine — but
     rows are turned into the server's own columns, in the server's own order,
     so the kitchen gets one file whichever way it arrived: Meno;Trieda;Obed;
     Jedlo;Stav, with the state in the chip's own Slovak word. */
  function asCsv(resp) {
    if (typeof resp === "string") return resp;
    var rows = (resp && resp.orders) || [];
    var head = ["Meno", "Trieda", "Obed", "Jedlo", "Stav"].join(";");
    return [head].concat(rows.map(function (o) {
      return [
        cell(o.student),
        cell(o.classCode || ""),
        cell(o.slot),
        cell(mealName(o)),
        cell(chipOf(o).l)
      ].join(";");
    })).join("\n");
  }

  function runExport() {
    if (busy) return;
    busy = true;
    note = null;
    render("#export");

    S.api.kitchenOrders({ date: sheet.date, format: "csv" }).then(
      function (resp) {
        busy = false;
        csv = asCsv(resp);
        render("#csv");
        S.announce(S.$("#live"), "Rozpis je pripravený na skopírovanie.");
      },
      function (err) {
        busy = false;
        note = { ok: false, text: (err && err.message) || "Export zlyhal." };
        render("#export");
      }
    );
  }

  function bind() {
    var btn = S.$("#export", root);
    if (btn) btn.addEventListener("click", runExport);
  }

  render();
};

/* Both reads are needed before the first paint: the sheet for the numbers,
   the roster for the low-credit badge on the Žiaci link. */
page.load = function (S) {
  return Promise.all([S.api.kitchenOrders(), S.api.students()]).then(function (res) {
    S.__kitchen = res[0] || {};
    S.__students = (res[1] && res[1].students) || [];
  });
};

SKYRO.page(page);
