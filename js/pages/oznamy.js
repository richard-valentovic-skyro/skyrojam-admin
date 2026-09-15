/* Nový oznam — compose a notice, with the student's feed card rendered live
   beside it.

   The preview is the real thing: the same .post markup, the same "Dôležité"
   chip, the same violet edge the students get on their Oznamy page. Writing
   the card twice would let the two drift, so it is built from the same pieces
   and nothing about it is a mock-up.

   Why the page is not re-rendered on every keystroke: an innerHTML write
   replaces the <input> and the <textarea> under the cursor, which drops the
   caret to the end of the text and loses any selection. So render() runs once
   and preview() rewrites only the aside. The toggle flips its own aria-pressed
   in place for the same reason — the CSS reads that attribute, so the switch
   animates off the accessible state rather than off a second class.

   "Publikovať oznam" goes through S.api.postAnnouncement, and two rules follow
   from that:

   1. NOTHING IS CLEARED UNTIL THE SERVER SAYS SO. The form is emptied inside
      the success handler. A failed publish leaves every character the user
      typed exactly where it was, with err.message under the button, so the fix
      is one more click and not one more retyping.

   2. AN EMPTY NOTICE NEVER REACHES THE NETWORK. The old build announced a
      successful publish for a form containing nothing but spaces. The check
      happens here, before the request, and says so in the same status line.

   "Uložiť ako koncept" is gone. There is no draft endpoint in the spec, and a
   button that is permanently disabled is still a button taking up room for
   something the product cannot do. "Zahodiť" stays, because it really does
   empty the form it offers to throw away. */
var page = function (S, root) {
  "use strict";

  /* The notice is published as whoever is signed in; the session holds the
     account the server authenticated at sign-in. */
  var AUTHOR = (S.session && S.session.get() && S.session.get().name) ||
    (S.APP && S.APP.account) || "Školská jedáleň";

  var title = "";
  var body = "";
  var important = false;

  /* A write is in flight, and what the last one had to say. Both are rendered
     out of state, so a render that happens mid-write — Zahodiť, say — still
     paints the button as busy instead of inviting a second click. */
  var saving = false;
  var status = null; // { ok: Boolean, text: String }

  /* ------------------------------------------------------------- markup */

  function publishLabel() {
    return saving
      ? S.icon("progress_activity") + "Ukladá sa…"
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
            '<input class="finput" id="t" type="text" autocomplete="off"' +
              ' placeholder="Napríklad Vo štvrtok sa vydáva až od 12:20"' +
              ' value="' + S.esc(title) + '">' +
          "</div>" +

          "<div>" +
            '<label class="flabel" for="b">Text oznamu</label>' +
            '<textarea class="finput" id="b"' +
              ' placeholder="Napíšte, čoho sa oznam týka a koho sa dotkne.">' +
              S.esc(body) + "</textarea>" +
          "</div>" +

          '<button class="toggle" type="button" id="imp" aria-pressed="' + important + '">' +
            '<span class="tl"><span class="tt">Označiť ako dôležité</span>' +
            '<span class="ts">Dôležitý oznam sa zobrazí navrchu feedu s fialovým' +
              " okrajom a výraznou značkou.</span></span>" +
            '<span class="sw"></span>' +
          "</button>" +

          '<div class="row">' +
            '<button class="btn" type="button" id="publish"' +
              (saving ? ' disabled aria-busy="true"' : "") + ">" +
              publishLabel() + "</button>" +
          "</div>" +

          statusHtml() +

          '<p class="note">Oznam uvidia všetci žiaci na stránke Oznamy hneď po ' +
            "publikovaní. Upraviť ani stiahnuť sa odtiaľto zatiaľ nedá.</p>" +
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

  /* ------------------------------------------------------------ binding */

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
    if (publish) publish.addEventListener("click", submit);

    /* Zahodiť empties the form for real — announcing that a notice was thrown
       away while its text is still on screen would be a lie. */
    var discard = S.$(".iconbtn", root);
    if (discard) {
      discard.addEventListener("click", function () {
        if (saving) return;
        if (!title && !body && !important) {
          S.announce(S.$("#live"), "Formulár je prázdny.");
          return;
        }
        title = "";
        body = "";
        important = false;
        status = null;
        render(".iconbtn"); // render() replaced the button under the cursor
        S.announce(S.$("#live"), "Oznam bol zahodený. Formulár je prázdny.");
      });
    }
  }

  /* -------------------------------------------------------------- write */

  function submit() {
    /* A second click while the first request is still open is dropped, not
       queued. One click must never publish two notices. */
    if (saving) return;

    var t = title.trim();
    var b = body.trim();

    /* Refused here, before the network: a notice made of spaces is not a
       notice, and the old build confirmed one anyway. */
    if (!t || !b) {
      status = { ok: false, text: "Zadajte nadpis aj text oznamu." };
      render(!t ? "#t" : "#b"); // role="alert" reads the line out by itself
      return;
    }

    saving = true;
    status = null;
    markBusy();

    S.api.postAnnouncement({ title: t, body: b, important: important }).then(
      function (resp) {
        saving = false;

        /* The API answers with the id of what it stored and nothing else, so
           the sentence names the notice from what was confirmed sent — after
           the server agreed to it, never before. */
        if (!resp || !resp.id) {
          status = { ok: false, text: "Server nepotvrdil publikovanie. Skontrolujte stránku Oznamy." };
          render("#publish");
          S.announce(S.$("#live"), status.text);
          return;
        }

        /* Confirmed, so the form may be emptied. */
        title = "";
        body = "";
        important = false;
        status = { ok: true, text: "Oznam „" + t + "“ bol publikovaný." };
        render("#publish");
        S.announce(S.$("#live"), "Oznam „" + t + "“ bol publikovaný. Formulár je prázdny.");
      },
      /* Two-argument then rather than .catch(): a bug thrown while rendering
         a success must not reach the user dressed as a refused publish. */
      function (err) {
        /* Nothing was published, so nothing on the page moves: the form still
           holds exactly what was typed, ready for a second try. */
        saving = false;
        status = { ok: false, text: (err && err.message) || "Nastala chyba. Skúste to znova." };
        render("#publish");
      }
    );
  }

  render();
};

/* Nothing to fetch: the composer starts empty and the preview is drawn from
   what is typed. The loader exists so this page boots through the same path
   as every other one — spinner, then render — instead of being a special
   case. */
page.load = function () {
  return Promise.resolve(null);
};

SKYRO.page(page);
