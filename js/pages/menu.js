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
   about what had just disappeared. Both are handled here. */
(function (S) {
  "use strict";

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

  var root = S.mount();

  function count() { return rows.length + " " + S.plural(rows.length); }

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

  function render() {
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
              '<span class="dxb">Nepublikované</span></span>' +
            '<button class="sq" type="button" aria-label="Nasledujúci deň">' +
              S.icon("chevron_right") + "</button>" +
          "</div>" +

          '<button class="btn block" type="button"' + (rows.length === 0 ? " disabled" : "") + ">" +
            S.icon("publish") + "Publikovať menu" +
            '<span class="qty">' + count() + "</span></button>" +

          '<p class="note">Po publikovaní uvidia žiaci menu okamžite. ' +
            "Objednávky sa uzatvárajú deň vopred o 14:00.</p>" +
        "</aside>" +
      "</div>";

    bind();
  }

  /* innerHTML threw every node away, so the listeners go back on. */
  function bind() {
    S.$("#add").addEventListener("click", function () {
      rows = rows.concat([blankMeal()]);
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
        render();
        focusAfterRemove(i);

        /* The row is gone from the screen before the eye catches it, and the
           publish count changed off to the side — say both. */
        S.announce(S.$("#live"),
          "Odstránené jedlo " + gone.n + ". Menu má " + count() + ".");
      });
    });
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
})(window.SKYRO);
