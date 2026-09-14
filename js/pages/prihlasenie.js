/* Prihlásenie — username and password.

   Apple's restraint: a centred column, light display type, fields that stand
   directly on the ground with no card or panel, and one field carrying its
   own submit.

   NO PASSWORD IS EVER CHECKED IN THE BROWSER. That would be theatre — anyone
   can read this file. The password is collected, checked only for being
   present, and handed to the server. The local checks below exist to catch
   typos before a round trip, nothing more.

   Until CONFIG.API_BASE is set this runs in mock mode: the local checks decide
   everything and a visible notice says so, because a sign-in screen that
   appears to accept a password it never verified would be a lie. */
SKYRO.pageWithoutShell(function (S) {
  "use strict";

  var REMEMBER_KEY = "skyro.admin.username";
  var RESEND_SECONDS = 30;
  var HOME = "index.html";

  var step = "signin"; // "signin" | "reset" | "sent"
  var username = "";
  var password = "";
  /* Off unless this device has been remembered before. School computers are
     shared, so opting in has to be deliberate. */
  var remember = false;
  var peek = false;
  var error = "";
  var helpOpen = false;
  var cooldown = 0;
  var timer = null;
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

  /* Cheap local refusals. Returns a message, or "" to let the request through.
     The server re-checks all of this; none of it is security. */
  function localSignInProblem(u, p) {
    var v = String(u).trim().toLowerCase();
    if (!v) return "Zadajte používateľské meno.";
    if (v.indexOf("@") !== -1) return "Zadajte len používateľské meno, bez @skyro.ai.";
    if (!S.looksLikeUsername(v)) {
      return "Používateľské meno môže obsahovať len písmená, číslice, bodku, pomlčku a podčiarkovník.";
    }
    if (!p) return "Zadajte heslo.";

    /* Mock mode only: without a server, the roster is the only thing that can
       answer. Once the API is live the server decides and this is skipped. */
    if (S.api.mock) {
      var staff = S.STAFF.filter(function (m) { return S.usernameOf(m.email) === v; })[0];
      if (!staff) {
        /* A pupil typing their own name here deserves a straight answer; it
           reveals nothing they do not already know about themselves. */
        var isStudent = S.STUDENTS.some(function (x) { return S.usernameOf(x.email) === v; });
        return isStudent
          ? "Toto je žiacke konto. Do administrácie sa prihlasuje len personál jedálne."
          : "Nesprávne používateľské meno alebo heslo.";
      }
    }
    return "";
  }

  function localResetProblem(u) {
    var v = String(u).trim().toLowerCase();
    if (!v) return "Zadajte používateľské meno.";
    if (!S.looksLikeUsername(v)) return "Zadajte platné používateľské meno.";
    return "";
  }

  /* ------------------------------------------------------------- network
     Both resolve with "" on success or the message to show. Never reject. */

  /* The server MUST answer a wrong password and an unknown username
     identically, or this screen becomes a way to discover who has an account. */
  function submitSignIn(u, p) {
    var local = localSignInProblem(u, p);
    if (local) return Promise.resolve(local);
    if (S.api.mock) return Promise.resolve("");

    return S.api
      .request("POST", "/auth/sign-in", { username: String(u).trim().toLowerCase(), password: p })
      .then(function (res) {
        if (res && res.token) S.api.setToken(res.token);
        S.session.set((res && res.user) || { username: String(u).trim().toLowerCase() });
        return "";
      })
      .catch(function (e) {
        return (e && e.message) || "Prihlásenie zlyhalo. Skúste to znova.";
      });
  }

  /* Answers 202 whether or not the account exists, so this cannot be used to
     enumerate usernames. */
  function submitReset(u) {
    var local = localResetProblem(u);
    if (local) return Promise.resolve(local);
    if (S.api.mock) return Promise.resolve("");

    return S.api
      .request("POST", "/auth/request-reset", { username: String(u).trim().toLowerCase() })
      .then(function () { return ""; })
      .catch(function (e) { return (e && e.message) || "Nepodarilo sa odoslať odkaz."; });
  }

  /* -------------------------------------------------------------- pieces */

  function startCooldown() {
    cooldown = RESEND_SECONDS;
    if (timer) window.clearInterval(timer);
    timer = window.setInterval(function () {
      cooldown -= 1;
      var b = S.$("#resend");
      if (cooldown <= 0) {
        window.clearInterval(timer);
        timer = null;
        if (b) { b.disabled = false; b.innerHTML = "Poslať znova"; }
      } else if (b) {
        b.innerHTML = 'Poslať znova <span class="acount">' + cooldown + " s</span>";
      }
    }, 1000);
  }

  function stopCooldown() {
    if (timer) { window.clearInterval(timer); timer = null; }
  }

  function errorHtml() {
    return error ? '<p class="aerr" id="err" role="alert">' + S.esc(error) + "</p>" : "";
  }

  var HELP =
    "<p><b>Aké je moje meno?</b> Je to vaša školská adresa bez @skyro.ai — " +
      "napríklad <b>meno.priezvisko</b>. Prihlásiť sa môže len personál jedálne.</p>" +
    "<p><b>Nepamätáte si heslo?</b> Použite <b>Zabudli ste heslo?</b> a pošleme " +
      "vám odkaz na jeho zmenu.</p>" +
    "<p><b>Stále to nejde?</b> Obráťte sa na správcu systému.</p>";

  function helpHtml() {
    return '<button class="alink" type="button" id="help" aria-expanded="' + helpOpen + '"' +
        ' aria-controls="helppanel">Nedarí sa vám prihlásiť?</button>' +
      (helpOpen ? '<div class="ahelp" id="helppanel">' + HELP + "</div>" : "");
  }

  function protoHtml() {
    if (!S.api.mock) return "";
    return '<p class="aproto"><b>Ukážka bez servera.</b> Heslo sa zatiaľ nikde ' +
      "neoveruje — šípka vás pustí priamo do aplikácie.</p>";
  }

  /* --------------------------------------------------------------- steps */

  function stepSignIn() {
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
            '<button class="ago" type="submit" id="submit" aria-label="Prihlásiť sa"' +
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
      '<button class="alink" type="button" id="forgot">Zabudli ste heslo?</button>' +
      helpHtml() +
      '<p class="afine" id="fine">Prihlasujete sa školským menom a heslom. Heslo nikomu ' +
        "neposielajte — škola vás oň nikdy nepožiada.</p>";
  }

  function stepReset() {
    return '<form id="form" novalidate>' +
        '<div class="afield' + (error ? " bad" : "") + '">' +
          '<span class="fl">' +
            '<span class="fk" id="fk-r">Používateľské meno</span>' +
            '<input id="username" type="text" autocomplete="username" spellcheck="false"' +
              ' autocapitalize="none" aria-labelledby="fk-r"' +
              (error ? ' aria-invalid="true" aria-describedby="err"' : "") +
              ' placeholder="meno.priezvisko" value="' + S.esc(username) + '">' +
          "</span>" +
          '<button class="ago" type="submit" aria-label="Poslať odkaz na zmenu hesla"' +
            (username.trim() && !busy ? "" : " disabled") + ">" +
            S.icon(busy ? "hourglass_empty" : "arrow_forward") + "</button>" +
        "</div>" +
        errorHtml() +
      "</form>" +
      '<div class="ahr"></div>' +
      '<button class="alink" type="button" id="back">Späť na prihlásenie</button>' +
      '<p class="afine">Na školskú adresu vám pošleme odkaz, ktorým si nastavíte nové heslo.</p>';
  }

  function stepSent() {
    return '<div class="asent">' +
        '<span class="disc">' + S.icon("mark_email_read") + "</span>" +
        '<p class="afine" style="max-width:32ch;margin:0">' +
          (S.api.mock
            ? "Na školskú adresu bude chodiť odkaz na zmenu hesla. Platí 15 minút."
            : "Ak k tomuto menu patrí účet, poslali sme naň odkaz na zmenu hesla. Platí 15 minút.") +
        "</p>" +
        '<p class="addr">' + S.esc(username.trim()) + "@skyro.ai</p>" +
        '<div class="ahr"></div>' +
        '<button class="alink" type="button" id="resend" disabled>' +
          'Poslať znova <span class="acount">' + RESEND_SECONDS + " s</span></button>" +
        '<button class="alink" type="button" id="back">Späť na prihlásenie</button>' +
      "</div>";
  }

  /* -------------------------------------------------------------- render */

  function render(focusSel) {
    var body = step === "signin" ? stepSignIn() : step === "reset" ? stepReset() : stepSent();
    host.innerHTML =
      '<div class="alogin"></div>' +
      '<div class="awrap"><div class="acol">' +
        S.logoSvg("amark") +
        '<h1 class="atitle">Prihlásenie<br>do administrácie</h1>' +
        body +
      "</div></div>";
    bind();
    if (focusSel) {
      var el = S.$(focusSel);
      if (el) el.focus();
    }
  }

  function goHome() {
    /* The only place a session is created. Once the API is live the server's
       user object is stored instead of this stub. */
    if (!S.session.get()) {
      S.session.set({ username: username.trim().toLowerCase() });
    }
    var next = S.session.intended();
    window.location.href = next || HOME;
  }

  /* --------------------------------------------------------------- binds */

  function bindSignIn() {
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

    S.$("#forgot").addEventListener("click", function () {
      error = "";
      password = "";
      step = "reset";
      render("#username");
    });

    S.$("#help").addEventListener("click", function () {
      helpOpen = !helpOpen;
      render("#help");
    });

    S.$("#form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (busy) return;
      username = u.value;
      password = p.value;

      busy = true;
      render(); // repaints the arrow as a pending state and disables it

      submitSignIn(username, password).then(function (problem) {
        busy = false;
        if (problem) {
          error = problem;
          password = ""; // never keep a rejected password around
          render("#password");
          return;
        }
        writeRemembered();
        password = "";
        goHome();
      });
    });

    if (username && !password) p.focus(); else u.focus();
  }

  function bindReset() {
    var ru = S.$("#username");

    ru.addEventListener("input", function () {
      username = ru.value;
      var go = S.$(".ago");
      if (go) go.disabled = busy || !ru.value.trim();
    });

    S.$("#back").addEventListener("click", function () {
      stopCooldown();
      error = "";
      step = "signin";
      render("#username");
    });

    S.$("#form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (busy) return;
      username = ru.value;

      busy = true;
      render();

      submitReset(username).then(function (problem) {
        busy = false;
        if (problem) {
          error = problem;
          render("#username");
          return;
        }
        error = "";
        step = "sent";
        render();
        startCooldown();
      });
    });
  }

  function bindSent() {
    S.$("#resend").addEventListener("click", function () {
      if (cooldown > 0) return;
      S.$("#resend").disabled = true;
      startCooldown();
      submitReset(username);
      S.announce(S.$("#live"), "Odkaz bol vyžiadaný znova.");
    });

    S.$("#back").addEventListener("click", function () {
      stopCooldown();
      error = "";
      step = "signin";
      render("#username");
    });
  }

  function bind() {
    if (step === "signin") return bindSignIn();
    if (step === "reset") return bindReset();
    return bindSent();
  }

  /* Landing here always ends the current session — the rail's logout link is
     just a link to this page. */
  S.session.clear();

  readRemembered();
  render();
});
