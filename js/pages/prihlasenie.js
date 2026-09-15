/* Prihlásenie do administrácie — username and password.

   Apple's restraint: a centred column, light display type, fields that stand
   directly on the ground with no card or panel, and one field carrying its
   own submit.

   NO PASSWORD IS EVER CHECKED IN THE BROWSER. That would be theatre — anyone
   can read this file. The password is collected, checked only for being
   present, and handed to POST /auth/login through S.api.login. The local
   checks below exist to catch typos before a round trip, nothing more: who
   exists, whose password is right and who is staff are all answers only the
   server is allowed to give.

   THERE IS NO PASSWORD RESET. The backend implements no reset endpoint, so
   the screen does not offer one — a "Zabudli ste heslo?" link that leads
   nowhere is worse than no link. The help panel says who to ask instead.

   ROLE. This app moves money and creates accounts, so a student account is
   refused at the door: the server hands back the account it authenticated,
   and anything that is not a MANAGER has its session dropped again
   immediately, before a single admin screen is drawn. That refusal is a
   courtesy to the person standing there, not a security control — the real
   one is the API rejecting every manager endpoint for a student token, plus
   Cloudflare Access in front of this whole folder.

   Until CONFIG.API_BASE is set this runs in mock mode against the fixtures in
   data.js: the username has to exist in the roster, the password is not
   verified at all, and a visible notice says so — a sign-in screen that
   appeared to accept a password it never checked would be a lie. */
SKYRO.pageWithoutShell(function (S) {
  "use strict";

  var REMEMBER_KEY = "skyro.admin.username";
  var HOME = "index.html";


  var username = "";
  var password = "";
  /* Off unless this device has been remembered before. Staff computers in a
     canteen are shared too, so opting in has to be deliberate. */
  var remember = false;
  var peek = false;
  var error = "";
  var helpOpen = false;
  var busy = false; // a request is in flight; a second submit is ignored

  var host = S.$("#page-content");

  /* ------------------------------------------------------------ remember */

  /* localStorage throws in some privacy modes — never let that break sign-in. */
  function readRemembered() {
    try {
      var v = window.localStorage.getItem(REMEMBER_KEY);
      if (v) { username = v; remember = true; }
    } catch (e) { /* ignore */ }
  }

  function writeRemembered() {
    try {
      /* The username only. A password never touches storage. */
      if (remember && username.trim()) window.localStorage.setItem(REMEMBER_KEY, username.trim());
      else window.localStorage.removeItem(REMEMBER_KEY);
    } catch (e) { /* ignore */ }
  }

  /* -------------------------------------------------------------- checks */

  /* Cheap local refusals, and the complete list of them: present, not an
     email, shaped like a username, password present. Everything else — is
     this account real, is the password right, is this person staff — is the
     server's to answer, and is never guessed here.
     Returns a message, or "" to let the request through. */
  function localSignInProblem(u, p) {
    var v = String(u).trim().toLowerCase();
    if (!v) return "Zadajte používateľské meno.";
    if (v.indexOf("@") !== -1) return "Zadajte len používateľské meno, bez @skyro.ai.";
    if (!S.looksLikeUsername(v)) {
      return "Používateľské meno môže obsahovať len písmená, číslice, bodku, pomlčku a podčiarkovník.";
    }
    if (!p) return "Zadajte heslo.";
    return "";
  }

  /* ------------------------------------------------------------- network
     Resolves with "" on success or with the message to show. Never rejects:
     the caller has one job, which is to decide between "go" and "say this".

     The server MUST answer a wrong password and an unknown username
     identically, or this screen becomes a way to discover who has an account.
     S.api.login stores the token; the only thing left to do here is to check
     the role, hand the returned account to the session and leave. */
  function submitSignIn(u, p) {
    var local = localSignInProblem(u, p);
    if (local) return Promise.resolve(local);

    return S.api.login(String(u).trim().toLowerCase(), p).then(
      function (res) {
        var account = res && res.account;
        if (!account) return "Prihlásenie zlyhalo. Skúste to znova.";

        /* Authenticated, but not staff. The token is thrown away again
           rather than left lying in storage for the next page load, and the
           message says what happened without pretending the credentials
           were wrong. */
        if (account.role !== "MANAGER") {
          return S.api.signOut().then(function () {
            return "Toto konto nemá prístup do administrácie.";
          });
        }

        /* The account the server authenticated, not the one we typed — and
           identity only. A balance stored here would be read by the header on
           every later page and could not be invalidated when it changed. */
        S.session.set({
          id: account.id,
          name: account.name,
          username: account.username,
          role: account.role
        });
        return "";
      },
      function (err) {
        /* A 401 is answered with one fixed sentence, never the server's own
           wording: "unknown username" and "wrong password" have to be
           indistinguishable here, or this screen becomes a way to find out
           who has an account. Every other failure shows what the server
           said, which is already Slovak and already honest. */
        if (err && err.status === 401) return "Nesprávne používateľské meno alebo heslo.";
        return (err && err.message) || "Prihlásenie zlyhalo. Skúste to znova.";
      }
    );
  }

  /* -------------------------------------------------------------- pieces */

  function errorHtml() {
    return error ? '<p class="aerr" id="err" role="alert">' + S.esc(error) + "</p>" : "";
  }

  var HELP =
    "<p><b>Aké je moje meno?</b> Je to vaša školská adresa bez @skyro.ai — " +
      "napríklad <b>meno.priezvisko</b>. Prihlásiť sa môže len personál jedálne.</p>" +
    "<p><b>Nepamätáte si heslo?</b> Nové heslo nastavuje vedúca jedálne alebo " +
      "správca systému — odkaz na zmenu hesla e-mailom neposielame.</p>" +
    "<p><b>Stále to nejde?</b> Obráťte sa na správcu systému.</p>";

  function helpHtml() {
    return '<button class="alink" type="button" id="help" aria-expanded="' + helpOpen + '"' +
        ' aria-controls="helppanel">Nedarí sa vám prihlásiť?</button>' +
      (helpOpen ? '<div class="ahelp" id="helppanel">' + HELP + "</div>" : "");
  }

  function protoHtml() {
    if (!S.api.mock) return "";
    return '<p class="aproto"><b>Ukážka bez servera.</b> Heslo sa zatiaľ nikde ' +
      "neoveruje" +
      "." +
      "</p>";
  }

  /* --------------------------------------------------------------- form */

  function formHtml() {
    var ready = username.trim() && password;
    return '<form id="form" novalidate>' +
        '<div class="astack">' +
          '<div class="afield solo' + (error ? " bad" : "") + '">' +
            '<span class="fl">' +
              '<span class="fk" id="fk-u">Používateľské meno</span>' +
              '<input id="username" type="text" autocomplete="username" spellcheck="false"' +
                ' autocapitalize="none" aria-labelledby="fk-u"' +
                (error ? ' aria-invalid="true" aria-describedby="err"' : "") +
                ' placeholder="meno.priezvisko" value="' + S.esc(username) + '">' +
            "</span>" +
          "</div>" +

          '<div class="afield' + (error ? " bad" : "") + '">' +
            '<span class="fl">' +
              '<span class="fk" id="fk-p">Heslo</span>' +
              '<input id="password" type="' + (peek ? "text" : "password") + '"' +
                ' autocomplete="current-password" aria-labelledby="fk-p"' +
                (error ? ' aria-invalid="true" aria-describedby="err"' : "") +
                ' value="' + S.esc(password) + '">' +
            "</span>" +
            '<button class="apeek" type="button" id="peek" aria-pressed="' + peek + '"' +
              ' aria-label="' + (peek ? "Skryť heslo" : "Zobraziť heslo") + '">' +
              S.icon(peek ? "visibility_off" : "visibility") + "</button>" +
            /* The arrow is the submit, so the pending state lives on it: the
               icon and the accessible name both say a request is open, and
               it is disabled for as long as one is. */
            '<button class="ago" type="submit" id="submit"' +
              ' aria-label="' + (busy ? "Prihlasujeme vás…" : "Prihlásiť sa") + '"' +
              (busy ? ' aria-busy="true"' : "") +
              (ready && !busy ? "" : " disabled") + ">" +
              S.icon(busy ? "hourglass_empty" : "arrow_forward") + "</button>" +
          "</div>" +
        "</div>" +

        errorHtml() +

        '<button class="acheck" type="button" id="remember" aria-pressed="' + remember + '">' +
          '<span class="bx">' + S.icon("check") + "</span>Zapamätať si ma</button>" +
      "</form>" +

      protoHtml() +
      '<div class="ahr"></div>' +
      helpHtml() +
      '<p class="afine" id="fine">Do administrácie sa prihlasuje personál jedálne školským ' +
        "menom a heslom. Heslo nikomu neposielajte — škola vás oň nikdy nepožiada.</p>";
  }

  /* -------------------------------------------------------------- render */

  function render(focusSel) {
    host.innerHTML =
      '<div class="alogin"></div>' +
      '<div class="awrap"><div class="acol">' +
        S.logoSvg("amark") +
        '<h1 class="atitle">Prihlásenie<br>do administrácie</h1>' +
        formHtml() +
      "</div></div>";
    bind();
    /* innerHTML threw away whatever had focus; every caller says where the
       keyboard goes next, or it lands on <body>. */
    if (focusSel) {
      var el = S.$(focusSel);
      if (el) el.focus();
    }
  }

  function goOn() {
    var next = S.session.intended();
    window.location.href = next || HOME;
  }

  /* --------------------------------------------------------------- binds */

  function bind() {
    var u = S.$("#username");
    var p = S.$("#password");

    function clearError() {
      if (!error) return;
      error = "";
      S.$$(".afield").forEach(function (f) { f.classList.remove("bad"); });
      var e = S.$("#err");
      if (e) e.remove();
      u.removeAttribute("aria-invalid");
      p.removeAttribute("aria-invalid");
    }

    /* The arrow lives or dies on both fields, so re-check on every keystroke. */
    function syncSubmit() {
      var go = S.$("#submit");
      if (go) go.disabled = busy || !(u.value.trim() && p.value);
    }

    u.addEventListener("input", function () { username = u.value; clearError(); syncSubmit(); });
    p.addEventListener("input", function () { password = p.value; clearError(); syncSubmit(); });
    syncSubmit();

    S.$("#peek").addEventListener("click", function () {
      peek = !peek;
      password = p.value;
      var pos = p.selectionStart;
      render("#password");
      var np = S.$("#password");
      try { np.setSelectionRange(pos, pos); } catch (e) { /* ignore */ }
    });

    S.$("#remember").addEventListener("click", function () {
      remember = !remember;
      S.$("#remember").setAttribute("aria-pressed", String(remember));
      writeRemembered();
    });

    S.$("#help").addEventListener("click", function () {
      helpOpen = !helpOpen;
      render("#help");
    });

    S.$("#form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      /* A second submit while the first request is open is dropped, not
         queued. The disabled arrow makes that hard; Enter held down on a
         slow line makes it easy again. */
      if (busy) return;
      username = u.value;
      password = p.value;

      busy = true;
      render(); // repaints the arrow as a pending state and disables it

      submitSignIn(username, password).then(function (problem) {
        busy = false;
        if (problem) {
          /* Nothing on screen moves except the arrow, which becomes
             pressable again, and the error line the server dictated. */
          error = problem;
          password = ""; // never keep a rejected password around
          render("#password");
          return;
        }
        writeRemembered();
        password = "";
        goOn();
      });
    });

    if (username && !password) p.focus(); else u.focus();
  }

  /* Landing here always ends the current session — the rail's logout link is
     just a link to this page. */
  S.session.clear();

  readRemembered();
  render();
});
