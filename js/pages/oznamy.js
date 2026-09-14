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
   all.

   "Publikovať oznam" now goes through S.api.postAnnouncement, and the two
   rules that follow from that are the whole of the write path:

   1. NOTHING IS CLEARED UNTIL THE SERVER SAYS SO. The form is emptied inside
      the success handler, out of the post the response carried back — never
      up front, and never out of what we sent. A failed publish leaves every
      character the user typed exactly where it was, with err.message under
      the buttons, so the fix is one more click and not one more retyping.

   2. AN EMPTY NOTICE NEVER REACHES THE NETWORK. The old build announced a
      successful publish for a form containing nothing but spaces. The check
      happens here, before the request, and says so in the same status line.

   "Uložiť ako koncept" has no endpoint behind it, so it is disabled and
   labelled "Zatiaľ nedostupné" rather than left looking live and doing
   nothing. "Zahodiť" really does empty the form it offers to throw away. */
SKYRO.page(function (S, root) {
  "use strict";

  var AUTHOR = "Katarína Vrábľová";

  var title = "Uzávierka objednávok sa mení na 14:00";
  var body = "Od pondelka 21. septembra sa objednávky na nasledujúci deň " +
    "uzatvárajú o 14:00 namiesto 15:30. Platí pre všetky ročníky.";
  var important = true;

  /* A write is in flight, and what the last one had to say. Both are rendered
     out of state, so a render that happens mid-write — Zahodiť, say — still
     paints the button as busy instead of inviting a second click. */
  var saving = false;
  var status = null; // { ok: Boolean, text: String }

  /* The boot spinner, shrunk to sit on one line of a button. Reusing the class
     keeps it inside the prefers-reduced-motion rule that already slows it. */
  function spinner() {
    return '<span class="boot-spin" aria-hidden="true"' +
      ' style="width:14px;height:14px;border-width:2px;flex:none"></span>';
  }

  function publishLabel() {
    return saving
      ? spinner() + "Ukladá sa…"
      : S.icon("send") + "Publikovať oznam";
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

  function render(focusSel) {
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
            '<button class="btn" type="button" id="publish"' +
              (saving ? ' disabled aria-busy="true"' : "") + ">" +
              publishLabel() + "</button>" +
            /* No endpoint exists for a draft. Disabled and named, rather than
               a live-looking button that swallows the click. */
            '<button class="btn soft" type="button" id="draft" disabled' +
              ' title="Zatiaľ nedostupné">' +
              S.icon("schedule") + "Uložiť ako koncept</button>" +
          "</div>" +

          statusHtml() +
        "</div>" +

        /* Live preview, in the exact card the students will see. */
        '<aside class="aside sticky">' +
          '<div class="gl">Náhľad</div>' +
          '<div id="preview">' + postCard() + "</div>" +
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

  /* Only the card is rewritten, so the fields keep their caret and selection. */
  function preview() {
    var host = S.$("#preview", root);
    if (host) host.innerHTML = postCard();
  }

  /* The busy state goes on in place rather than through render(), so the two
     text fields are not replaced out from under the user mid-write. Any later
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
        /* A second click while the first request is still open is dropped,
           not queued. One click must never publish two notices. */
        if (saving) return;

        /* Refused here, before the network: a notice made of spaces is not a
           notice, and the old build confirmed one anyway. */
        if (!title.trim() || !body.trim()) {
          status = { ok: false, text: "Zadajte nadpis a text oznamu." };
          render("#publish"); // role="alert" reads the line out by itself
          return;
        }

        saving = true;
        status = null;
        markBusy();

        S.api.postAnnouncement({ title: title, body: body, important: important }).then(
          function (res) {
            var post = (res && res.post) || {};
            var published = post.t || title;

            saving = false;
            /* Confirmed, so the form may be emptied — and the sentence the
               user reads is built from the response, not from what we sent. */
            title = "";
            body = "";
            important = false;
            status = { ok: true, text: "Oznam „" + published + "“ bol publikovaný." };
            render("#publish");
            S.announce(S.$("#live"), "Oznam „" + published + "“ bol publikovaný. Formulár je prázdny.");
          },
          function (err) {
            /* Nothing was published, so nothing on the page moves: the form
               still holds exactly what was typed, ready for a second try. */
            saving = false;
            status = { ok: false, text: (err && err.message) || "Nastala chyba. Skúste to znova." };
            render("#publish");
          }
        );
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
        status = null;
        render(".iconbtn"); // render() replaced the button under the cursor
        S.announce(S.$("#live"), "Oznam bol zahodený. Formulár je prázdny.");
      });
    }
  }

  render();
});
