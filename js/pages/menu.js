/* Správa menu — the list of meals for a day, editable in place.

   One piece of state: `rows`, a working copy of the fixtures. Adding and
   removing a meal are the only things that touch it, and both rebuild the
   whole list, so the numbering in .en and the count on the publish button are
   always read back out of the array instead of being patched by hand. That is
   the same discipline the student build got wrong with money — a derived value
   cannot drift, an accumulated one can.

   The React build rebuilt the list on every change too, but never moved focus:
   pressing a delete button destroyed the button you were standing on and
   dropped the keyboard back at the top of the document, with nothing said
   about what had just disappeared. Both are handled here.

   Editing is local; publishing is not. S.api.publishMenu sends the whole list
   for one day in a single call, which is why the per-row edit and delete
   buttons have no request behind them — they shape the draft, and one press of
   "Publikovať menu" is the write.

   Two rules the publish path obeys:

   1. THE LIST COMES BACK FROM THE SERVER. On success `rows` is replaced by
      response.meals, not left as the array we happened to send. If the server
      normalised something, this screen shows the normalised version.

   2. "Nepublikované" ONLY FLIPS ON A CONFIRMED WRITE, and flips back the
      moment a row is added or removed. A label that says Publikované over a
      list the server has never seen is worse than no label at all. A failed
      publish changes nothing but the rose line under the button. */
SKYRO.page(function (S, root) {
  "use strict";

  /* The day this screen edits. The API call and the label in the date card
     both hang off this, so they cannot drift apart. */
  var DATE = "2026-09-15"; // Utorok 15. septembra

  /* What a new row starts as. Same shape as a meal in data.js, so nothing
     downstream needs a special case for it. */
  function blankMeal() {
    return {
      n: "Nové jedlo",
      d: "Doplňte popis a prílohu",
      cat: "Mäsité",
      tint: "t-peach",
      a: ["1, 7"],
      ic: "restaurant",
      c: 0
    };
  }

  /* A copy — S.MEALS stays the fixture the Prehľad page reads. */
  var rows = S.MEALS.slice();

  /* A publish is in flight; the server has confirmed the current list; what
     the last publish had to say. All three are rendered out of state, so a
     render that happens mid-write still paints the button as busy. */
  var saving = false;
  var published = false;
  var status = null; // { ok: Boolean, text: String }

  function count() { return rows.length + " " + S.plural(rows.length); }

  /* The boot spinner, shrunk to sit on one line of a button. Reusing the class
     keeps it inside the prefers-reduced-motion rule that already slows it. */
  function spinner() {
    return '<span class="boot-spin" aria-hidden="true"' +
      ' style="width:14px;height:14px;border-width:2px;flex:none"></span>';
  }

  function publishLabel() {
    return (saving
      ? spinner() + "Ukladá sa…"
      : S.icon("publish") + "Publikovať menu") +
      '<span class="qty">' + count() + "</span>";
  }

  /* A failure gets role="alert" so it interrupts — the user is waiting on it.
     A success is a quiet role="status", because S.announce has already said
     the same sentence into the live region. */
  function statusHtml() {
    if (!status) return "";
    return '<p class="note" id="status-msg" role="' + (status.ok ? "status" : "alert") +
      '" style="font-weight:600;color:' + (status.ok ? "var(--c-green)" : "var(--c-rose)") +
      '">' + S.esc(status.text) + "</p>";
  }

  /* The two .mini buttons carry the meal name in their label, otherwise a
     screen reader hears nine identical "Odstrániť" buttons in a row. */
  function erow(m, i) {
    return '<div class="erow">' +
      '<span class="en">' + (i + 1) + "</span>" +
      '<span class="ei">' +
        '<span class="et">' + S.esc(m.n) + "</span>" +
        '<span class="ed">' + S.esc(m.d) + "</span>" +
        '<span class="eg">' + m.a.map(S.tag).join("") + "</span>" +
      "</span>" +
      '<span class="ea">' +
        '<button class="mini" type="button" aria-label="Upraviť ' + S.esc(m.n) + '">' +
          S.icon("edit") + "</button>" +
        '<button class="mini del" type="button" data-i="' + i +
          '" aria-label="Odstrániť ' + S.esc(m.n) + '">' + S.icon("delete") + "</button>" +
      "</span>" +
      "</div>";
  }

  function render(focusSel) {
    root.innerHTML =
      S.pageHead("Správa menu", "Utorok 15. septembra",
        S.iconBtn("content_copy", "Kopírovať z minulého týždňa")) +

      '<div class="split main-aside-slim">' +
        '<div class="stack" id="rows">' +
          rows.map(erow).join("") +
          '<button class="addrow" type="button" id="add">' + S.icon("add") +
            "Pridať jedlo</button>" +
        "</div>" +

        '<aside class="aside sticky stack l">' +
          '<div class="datecard">' +
            '<button class="sq" type="button" aria-label="Predchádzajúci deň">' +
              S.icon("chevron_left") + "</button>" +
            '<span class="dx"><span class="dxa">Utorok 15. septembra</span>' +
              '<span class="dxb">' + (published ? "Publikované" : "Nepublikované") + "</span></span>" +
            '<button class="sq" type="button" aria-label="Nasledujúci deň">' +
              S.icon("chevron_right") + "</button>" +
          "</div>" +

          '<button class="btn block" type="button" id="publish"' +
            (saving || rows.length === 0 ? " disabled" : "") +
            (saving ? ' aria-busy="true"' : "") + ">" +
            publishLabel() + "</button>" +

          statusHtml() +

          '<p class="note">Po publikovaní uvidia žiaci menu okamžite. ' +
            "Objednávky sa uzatvárajú o 14:00 v deň obeda.</p>" +
        "</aside>" +
      "</div>";

    bind();

    /* innerHTML threw away whatever had focus. Every caller that re-renders
       says where the keyboard goes next, or it lands on <body>. */
    if (focusSel) {
      var el = S.$(focusSel, root);
      if (el) el.focus();
    }
  }

  /* The busy state goes on in place rather than through render(), so the row
     list is not rebuilt for something only the button is doing. Any later
     render() paints the same thing, because both read `saving`. */
  function markBusy() {
    var btn = S.$("#publish", root);
    if (btn) {
      btn.disabled = true;
      btn.setAttribute("aria-busy", "true");
      btn.innerHTML = publishLabel();
    }
    var old = S.$("#status-msg", root);
    if (old && old.parentNode) old.parentNode.removeChild(old);
  }

  /* innerHTML threw every node away, so the listeners go back on. */
  function bind() {
    S.$("#add").addEventListener("click", function () {
      rows = rows.concat([blankMeal()]);
      /* The draft no longer matches what was published, and the old line
         about it is stale — both go. */
      published = false;
      status = null;
      render();
      S.$("#add").focus(); // the button has not moved; the new row landed above it
      S.announce(S.$("#live"),
        "Pridané jedlo číslo " + rows.length + ". Menu má " + count() + ".");
    });

    S.$$("#rows .mini.del").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var i = Number(btn.getAttribute("data-i"));
        var gone = rows[i];

        rows = rows.filter(function (_, idx) { return idx !== i; });
        published = false;
        status = null;
        render();
        focusAfterRemove(i);

        /* The row is gone from the screen before the eye catches it, and the
           publish count changed off to the side — say both. */
        S.announce(S.$("#live"),
          "Odstránené jedlo " + gone.n + ". Menu má " + count() + ".");
      });
    });

    var publish = S.$("#publish", root);
    if (publish) {
      publish.addEventListener("click", function () {
        /* A second click while the first request is still open is dropped,
           not queued. The day's menu must not be written twice. */
        if (saving || rows.length === 0) return;

        saving = true;
        status = null;
        markBusy();

        S.api.publishMenu(DATE, rows).then(
          function (res) {
            saving = false;
            /* What the screen shows next is the server's list, not ours. */
            if (res && res.meals) rows = res.meals;
            published = !!(res && res.published);

            var n = rows.length;
            var said = "Menu bolo publikované: " + n + " " + S.plural(n) + ".";
            status = { ok: true, text: said };
            render("#publish");
            S.announce(S.$("#live"), "Menu na utorok 15. septembra bolo publikované. " +
              "Žiaci vidia " + n + " " + S.plural(n) + ".");
          },
          function (err) {
            /* Nothing reached the kitchen, so nothing here moves: the same
               rows, still "Nepublikované", and the reason under the button. */
            saving = false;
            status = { ok: false, text: (err && err.message) || "Nastala chyba. Skúste to znova." };
            render("#publish");
          }
        );
      });
    }
  }

  /* The button that was pressed no longer exists. Hand the keyboard to the row
     that slid into its place, to the last row if the list just got shorter at
     the end, and to "Pridať jedlo" once nothing is left. */
  function focusAfterRemove(i) {
    var dels = S.$$("#rows .mini.del");
    var next = dels[i] || dels[dels.length - 1] || S.$("#add");
    if (next) next.focus();
  }

  render();
});
