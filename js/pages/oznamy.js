/* Compose a notice, with the student's feed card rendered live beside it.

   The preview is the real thing: the same .post markup, the same "Dôležité"
   chip, the same violet edge the students get. Writing it twice would let the
   two drift, so the card here is built from the same pieces as the student
   feed and nothing about it is a mock-up.

   Why the page is not re-rendered on every keystroke: an innerHTML write
   replaces the <input> and the <textarea> under the cursor, which drops the
   caret to the end of the text and loses any selection. So render() runs once
   and preview() rewrites only the aside. The toggle flips its own aria-pressed
   in place for the same reason — the CSS reads that attribute, so the switch
   animates off the accessible state rather than off a second class.

   Both fields are named by a real <label for>. The React build had that right;
   what it did not have was a single handler behind "Publikovať oznam",
   "Uložiť ako koncept" or "Zahodiť" — three buttons that answered nothing at
   all. There is no backend to publish to, but a control has to confirm that it
   heard the click, so each one reports to the live region, and "Zahodiť"
   really does empty the form it offers to throw away. */
(function (S) {
  "use strict";

  var AUTHOR = "Katarína Vrábľová";

  var title = "Uzávierka objednávok sa mení na 14:00";
  var body = "Od pondelka 21. septembra sa objednávky na nasledujúci deň " +
    "uzatvárajú o 14:00 namiesto 15:30. Platí pre všetky ročníky.";
  var important = true;

  var root = S.mount();

  /* The student feed labels every article by its own heading, so a screen
     reader stepping through the notices hears the title instead of "article". */
  function postCard() {
    return '<article class="post' + (important ? " imp" : "") + '" aria-labelledby="pv-title">' +
      (important ? S.chip("imp", "Dôležité") : "") +
      '<h3 class="pt" id="pv-title">' + S.esc(title || "Nadpis oznamu") + "</h3>" +
      '<p class="pb">' + S.esc(body || "Text oznamu sa zobrazí tu.") + "</p>" +
      '<div class="pm">dnes, ' + S.esc(AUTHOR) + "</div>" +
      "</article>";
  }

  function render() {
    root.innerHTML =
      S.pageHead("Nový oznam", "Školská jedáleň", S.iconBtn("delete", "Zahodiť")) +
      '<div class="split main-aside">' +
        '<div class="stack l" style="max-width:720px">' +
          "<div>" +
            '<label class="flabel" for="t">Nadpis</label>' +
            '<input class="finput" id="t" type="text" value="' + S.esc(title) + '">' +
          "</div>" +

          "<div>" +
            '<label class="flabel" for="b">Text oznamu</label>' +
            '<textarea class="finput" id="b">' + S.esc(body) + "</textarea>" +
          "</div>" +

          '<button class="toggle" type="button" id="imp" aria-pressed="' + important + '">' +
            '<span class="tl"><span class="tt">Označiť ako dôležité</span>' +
            '<span class="ts">Dôležitý oznam sa zobrazí navrchu feedu s fialovým' +
              " okrajom a pošle notifikáciu.</span></span>" +
            '<span class="sw"></span>' +
          "</button>" +

          '<div class="row">' +
            '<button class="btn" type="button" id="publish">' +
              S.icon("send") + "Publikovať oznam</button>" +
            '<button class="btn soft" type="button" id="draft">' +
              S.icon("schedule") + "Uložiť ako koncept</button>" +
          "</div>" +
        "</div>" +

        /* Live preview, in the exact card the students will see. */
        '<aside class="aside sticky">' +
          '<div class="gl">Náhľad</div>' +
          '<div id="preview">' + postCard() + "</div>" +
        "</aside>" +
      "</div>";

    bind();
  }

  /* Only the card is rewritten, so the fields keep their caret and selection. */
  function preview() {
    var host = S.$("#preview", root);
    if (host) host.innerHTML = postCard();
  }

  function bind() {
    var titleInput = S.$("#t", root);
    var bodyInput = S.$("#b", root);
    var toggle = S.$("#imp", root);

    if (titleInput) {
      titleInput.addEventListener("input", function () {
        title = titleInput.value;
        preview();
      });
    }

    if (bodyInput) {
      bodyInput.addEventListener("input", function () {
        body = bodyInput.value;
        preview();
      });
    }

    if (toggle) {
      toggle.addEventListener("click", function () {
        important = !important;
        toggle.setAttribute("aria-pressed", String(important));
        preview();
        S.announce(S.$("#live"), important
          ? "Oznam je označený ako dôležitý."
          : "Označenie dôležitosti je zrušené.");
      });
    }

    var publish = S.$("#publish", root);
    if (publish) {
      publish.addEventListener("click", function () {
        S.announce(S.$("#live"), "Oznam „" + title + "“ bol publikovaný.");
      });
    }

    var draft = S.$("#draft", root);
    if (draft) {
      draft.addEventListener("click", function () {
        S.announce(S.$("#live"), "Oznam je uložený ako koncept.");
      });
    }

    /* Zahodiť empties the form for real — announcing that a draft was thrown
       away while its text is still on screen would be a lie. */
    var discard = S.$(".iconbtn", root);
    if (discard) {
      discard.addEventListener("click", function () {
        title = "";
        body = "";
        important = false;
        render();
        S.$(".iconbtn", root).focus(); // render() replaced the button under the cursor
        S.announce(S.$("#live"), "Oznam bol zahodený. Formulár je prázdny.");
      });
    }
  }

  render();
})(window.SKYRO);
