/* Prehľad — the morning glance for the vedúca jedálne: how many lunches are
   ordered today, what that is worth, the four things she starts the day with,
   and how the portions split across the nine meals.

   Every number on this page is derived at render time and nothing is stored.
   The day's takings is TOTAL_TODAY × LUNCH_PRICE, computed here and never
   kept — the student build's confirmed bug was a money value held as a running
   total and added to on each render, which a page like this makes impossible
   by never holding one.

   The bars are scaled against the busiest meal rather than the total, so the
   widest row always reaches the end of its track; the .q modifier marks the
   meals the kitchen cooks fewer than 20 portions of. */
(function (S) {
  "use strict";

  var QUIET = 20; // under this many portions a row is drawn in the pale violet

  var root = S.mount();

  /* The busiest meal sets the scale for every bar. */
  var max = Math.max.apply(null, S.MEALS.map(function (m) { return m.c; }));

  /* Active students who cannot pay for a single lunch. Derived from the roster
     every render, so it can never drift from the Žiaci page. */
  var lowCredit = S.STUDENTS.filter(function (s) {
    return s.active && s.balance < S.LUNCH_PRICE;
  }).length;

  /* One shortcut row: a violet disc, the label, an optional trailing chip and
     the chevron. Three of the four go somewhere, so they are links; the export
     stays a button because it goes nowhere. Anchors need the underline turned
     off explicitly — skyro.css resets no link styling. */
  function qbtn(ic, label, href, trail) {
    var inner = '<span class="disc">' + S.icon(ic) + "</span>" +
      S.esc(label) + (trail || "") + S.icon("chevron_right", "ar");

    return href
      ? '<a class="qbtn" href="' + S.esc(href) + '" style="text-decoration:none">' + inner + "</a>"
      : '<button class="qbtn" type="button">' + inner + "</button>";
  }

  /* One meal's share of the day. .pv carries the count as text, so the bar is
     decoration and never the only place the number appears. */
  function prow(m, i) {
    var pct = Math.round((m.c / max) * 100);

    return '<div class="prow' + (m.c < QUIET ? " q" : "") + '">' +
      '<span class="pn">' + (i + 1) + ". " + S.esc(m.n) + "</span>" +
      '<span class="pv">' + S.esc(m.c) + "</span>" +
      '<span class="pk"><span class="pf" style="width:' + pct + '%"></span></span>' +
      "</div>";
  }

  function render() {
    /* chip() with layout.css's .push on it — margin-left:auto, the same shove
       to the right the React build spent an inline style on. */
    var credit = lowCredit > 0
      ? '<span class="chip bad push"><i></i>' + lowCredit + " bez kreditu</span>"
      : "";

    root.innerHTML =
      S.pageHead("Prehľad", "Pondelok 14. septembra", S.iconBtn("download", "Export")) +
      '<div class="split aside-main">' +
        '<div class="stack l">' +
          '<div class="hero">' +
            '<div class="hl">Objednávky na dnes</div>' +
            '<div class="hn">' + S.esc(S.TOTAL_TODAY) + "</div>" +
            '<div class="hd">' + S.icon("north_east") +
              "o 12 viac ako minulý pondelok</div>" +
            '<div class="hd" style="margin-left:8px">' + S.icon("payments") +
              S.eur(S.TOTAL_TODAY * S.LUNCH_PRICE) + "</div>" +
          "</div>" +

          qbtn("group", "Žiaci a kredit", "ziaci.html", credit) +
          qbtn("publish", "Publikovať menu na utorok", "menu.html") +
          qbtn("campaign", "Nový oznam", "oznamy.html") +
          qbtn("table_view", "Export rozpisu do kuchyne") +
        "</div>" +

        '<div class="plain">' +
          '<div class="ph"><span class="pd">Rozdelenie podľa jedla</span>' +
            '<span class="pd">Porcie</span></div>' +
          '<div class="prog">' + S.MEALS.map(prow).join("") + "</div>" +
        "</div>" +
      "</div>";
  }

  render();
})(window.SKYRO);
