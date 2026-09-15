/* Renders the chrome every page shares: the violet rail and the glass topbar.
   Each page carries only its own content; this fills in the rest and marks
   the current nav item from the filename.

   THE TILL IS IN THE HEADER NOW. Topping a student up is the thing a manager
   does most and from everywhere — mid-list, mid-announcement, with a student
   standing at the counter — so it is a dialog over whatever page they are on
   rather than a screen they have to travel to and come back from. The page
   underneath is untouched and still there when the dialog closes.

   No balance sits in this topbar. A manager has no lunch account; showing one
   would be a number about nobody.

   What the dialog owes the keyboard: Escape closes it, Tab cannot walk out of
   it, it names itself to a screen reader, and focus goes back to the button
   that opened it. What it owes the money: one write at a time, a second click
   dropped rather than queued, and the new balance taken from the server's
   answer — never added up here. A refusal moves nothing but the sentence
   under the button. */
window.SKYRO = window.SKYRO || {};
(function (S) {
  "use strict";

  var SAVING = "Ukladá sa…";
  var DEBOUNCE_MS = 250;

  /* /tyzden and /tyzden.html are the same page; the nav speaks filenames. */
  function currentFile() {
    var f = window.location.pathname.split("/").pop();
    if (!f) return "index.html";
    return f.indexOf(".") === -1 ? f + ".html" : f;
  }

  function rail(app, here) {
    var items = app.nav.map(function (it) {
      var active = it.href === here;
      return '<a class="rbtn" href="' + S.esc(it.href) + '" title="' + S.esc(it.label) + '"' +
        ' aria-label="' + S.esc(it.label) + '"' + (active ? ' aria-current="page"' : "") + ">" +
        S.icon(it.icon) +
        (it.badge ? '<span class="railbadge">' + S.esc(it.badge) + "</span>" : "") +
        "</a>";
    }).join("");

    return '<nav class="rail" aria-label="' + S.esc(app.navLabel) + '">' +
      '<a href="' + S.esc(app.home) + '" aria-label="Skyro Obedy">' + S.logoSvg("logo") + "</a>" +
      '<div class="railnav">' + items + "</div>" +
      '<div class="railfoot">' +
        '<a class="rbtn" href="prihlasenie.html" title="Odhlásiť sa" aria-label="Odhlásiť sa">' +
          S.icon("logout") + "</a>" +
      "</div></nav>";
  }

  function topbar(app) {
    return '<header class="topbar glass">' +
      '<span class="beta">Beta</span>' +
      '<div class="tbend">' +
        /* The label is on the button as well as in it: below 560px the
           topbar has no room for the words and the CSS drops them, and a
           button that is only an icon still has to say what it does. */
        '<button class="btn soft" type="button" id="topup-open" aria-label="Dobiť kredit">' +
          S.icon("add_card") + '<span class="btl">Dobiť kredit</span></button>' +
        '<div class="who"><span class="av">' + S.icon("person") + "</span>" +
        '<span class="wn">' + S.esc(app.account) + "</span>" +
        S.icon("expand_more", "cv") + "</div>" +
      "</div></header>";
  }

  /* ================================================================ top-up */

  /* Everything the dialog knows. It is reset on every open: an amount typed
     for one student, or a refusal about one student, must never be standing
     there the next time the dialog is opened for another. */
  var m = null;

  /* Outside the state object on purpose. It is reset to nothing on every
     open, and a counter that restarts at zero would let an answer from the
     previous opening match a token from this one — the exact stale write
     this counter exists to stop. */
  var searchSeq = 0;

  function blank() {
    return {
      open: false,
      opener: null,   // the control focus returns to on close
      q: "",          // the search text
      timer: null,    // the debounce
      loading: false,
      list: [],       // students exactly as the server last sent them
      listErr: "",    // a search that did not land, said where the rows would be
      selId: "",
      amount: "",     // as typed: "12,50"
      busy: false,    // a top-up is in flight; every handler returns early
      note: "",       // the one sentence under the button
      noteOk: true    // false turns it into a refusal
    };
  }

  function dialogHtml() {
    return '<div class="modal-wrap" id="topup" hidden>' +
      '<div class="modal-back" id="topup-back"></div>' +
      '<div class="modal glass" id="topup-dialog" role="dialog" aria-modal="true"' +
        ' aria-labelledby="topup-title" tabindex="-1">' +

        '<div class="ph"><span class="pd" id="topup-title">Dobiť kredit žiakovi</span>' +
          '<button type="button" class="sq" id="topup-close" aria-label="Zavrieť">' +
            S.icon("close") + "</button></div>" +

        '<div class="search">' + S.icon("search") +
          '<input id="topup-q" type="text" autocomplete="off" aria-label="Hľadať žiaka"' +
            ' placeholder="Hľadajte žiaka">' +
        "</div>" +

        '<div class="modal-list" id="topup-list" role="group"' +
          ' aria-label="Nájdení žiaci"></div>' +

        "<div>" +
          '<label class="flabel" for="topup-amt">Suma</label>' +
          '<input id="topup-amt" class="finput" type="text" inputmode="decimal"' +
            ' autocomplete="off" placeholder="0,00">' +
          '<div class="mt-s" id="topup-confirm-slot"></div>' +
          '<div id="topup-note"></div>' +
        "</div>" +
      "</div></div>";
  }

  /* ---------- reading ---------- */

  /* The student the amount belongs to — and only if they are still on screen.
     A search that narrows the list past the selected name disarms the button
     rather than leaving a sum armed for an account nobody can see. */
  function selected() {
    var found = null;
    m.list.forEach(function (s) { if (s.id === m.selId) found = s; });
    return found;
  }

  function cents() { return S.parseAmountCents(m.amount); }

  function studentsWord(n) {
    return n === 1 ? "nájdený žiak" : n >= 2 && n <= 4 ? "nájdení žiaci" : "nájdených žiakov";
  }

  /* ---------- markup ---------- */

  function rowHtml(s) {
    var sel = s.id === m.selId;
    return '<button type="button" class="urow' + (sel ? " sel" : "") +
      (s.active === false ? " off" : "") + '" data-id="' + S.esc(s.id) + '"' +
      ' aria-pressed="' + (sel ? "true" : "false") + '"' + (m.busy ? " disabled" : "") + ">" +
      '<span class="av">' + S.esc(S.initials(s.name)) + "</span>" +
      '<span class="ui">' +
        '<span class="un2">' + S.esc(s.name) + "</span>" +
        '<span class="ue">' + S.esc(s.username) + "</span>" +
        /* The greyed row says "inactive" in colour alone; say it in words too.
           Whether money may land on it is the server's answer, not ours. */
        (s.active === false ? '<span class="sr-only">Neaktívny účet</span>' : "") +
      "</span>" +
      '<span class="ubal money">' + S.esc(S.eur(s.balanceCents)) + "</span></button>";
  }

  function listHtml() {
    /* A search still on its way keeps the rows it has, so the list does not
       blink out from under the pointer on every keystroke. Only a list with
       nothing in it yet is worth a spinner. */
    if (m.loading && !m.list.length) {
      return '<div class="boot"><span class="boot-spin" aria-hidden="true"></span>' +
        '<p class="boot-msg">Hľadáme…</p></div>';
    }
    if (m.listErr) {
      return '<div class="empty">' + S.icon("cloud_off") +
        '<p class="boot-msg">' + S.esc(m.listErr) + "</p></div>";
    }
    if (!m.list.length) {
      return '<div class="empty">' + S.icon("person_off") +
        "Nikto sa nenašiel.<br>Skúste iné meno." + "</div>";
    }
    return m.list.map(rowHtml).join("");
  }

  function confirmHtml() {
    if (m.busy) {
      return '<button class="btn block" type="button" id="topup-confirm" disabled aria-busy="true">' +
        S.icon("progress_activity") + SAVING + "</button>";
    }
    var value = cents();
    var ok = !!selected() && value !== null;
    return '<button class="btn block" type="button" id="topup-confirm"' +
      (ok ? "" : " disabled") + ">" + S.icon("add_card") + "Pripísať" +
      (ok ? '<span class="qty">' + S.esc(S.eur(value)) + "</span>" : "") + "</button>";
  }

  /* One slot, one sentence, in priority order: what just happened outranks
     what to do next. */
  function noteHtml() {
    if (m.note) {
      return '<p class="note mt-s ' + (m.noteOk ? "ok" : "warn") + '" role="status">' +
        S.esc(m.note) + "</p>";
    }
    if (m.busy || m.loading) return "";
    if (!selected()) return '<p class="note mt-s">Vyberte žiaka zo zoznamu a zadajte sumu.</p>';
    if (m.amount && cents() === null) {
      return '<p class="note mt-s warn">Zadajte sumu ako 12,50 — najviac ' +
        S.esc(S.eur(S.MAX_TOPUP_CENTS)) + ".</p>";
    }
    var s = selected();
    return '<p class="note mt-s">' + S.esc(s.name) + " má teraz " +
      S.esc(S.eur(s.balanceCents)) + ". Suma sa pripíše po potvrdení.</p>";
  }

  /* ---------- painting ----------
     The search box and the amount field are never rewritten: replacing an
     input while it is being typed into takes the caret out of it. Only the
     rows, the button and the sentence are repainted. */

  function paintList() {
    var host = S.$("#topup-list");
    if (!host) return;
    host.setAttribute("aria-busy", m.loading ? "true" : "false");
    host.innerHTML = listHtml();
    S.$$(".urow", host).forEach(function (btn) {
      btn.addEventListener("click", function () { select(btn.getAttribute("data-id")); });
    });
  }

  function paintConfirm() {
    var slot = S.$("#topup-confirm-slot");
    if (!slot) return;
    slot.innerHTML = confirmHtml();
    var btn = S.$("#topup-confirm");
    if (btn) btn.addEventListener("click", credit);
  }

  function paintNote() {
    var slot = S.$("#topup-note");
    if (slot) slot.innerHTML = noteHtml();
  }

  /* The three static controls belong to the write while it is out. The rows
     say it in their own markup, so they are not touched here. */
  function lock(flag) {
    ["#topup-q", "#topup-amt", "#topup-close"].forEach(function (sel) {
      var el = S.$(sel);
      if (el) el.disabled = flag;
    });
  }

  /* ---------- searching ---------- */

  /* Cancel-safe by sequence number, not by AbortController: a slow answer to
     "mat" must never land on top of the answer to "matej". Anything that is
     not the newest search — including every answer still out when the dialog
     closes — is dropped on arrival. */
  function runSearch(text) {
    var token = ++searchSeq;
    m.loading = true;
    m.listErr = "";
    paintList();

    S.api.students(text).then(function (res) {
      if (token !== searchSeq || !m.open) return;
      m.loading = false;
      m.list = (res && res.students) || [];
      paintList();
      paintConfirm(); // the selected name may have just left the list
      paintNote();
      if (m.q) {
        var n = m.list.length;
        S.announce(S.$("#live"), n === 0
          ? "Nenašiel sa žiadny žiak."
          : n + " " + studentsWord(n) + ".");
      }
    }, function (err) {
      if (token !== searchSeq || !m.open) return;
      m.loading = false;
      /* The rows we had describe a search nobody is running any more, so they
         go; the reason stands where they were, in the server's own Slovak. */
      m.list = [];
      m.listErr = (err && err.message) || "Zoznam sa nepodarilo načítať.";
      paintList();
      paintConfirm();
      paintNote();
    });
  }

  function queueSearch() {
    window.clearTimeout(m.timer);
    m.timer = window.setTimeout(function () { runSearch(m.q); }, DEBOUNCE_MS);
  }

  /* ---------- actions ---------- */

  /* Choosing is local and free. It clears the note: a refusal, or a
     confirmation, was about the student who is no longer the one selected. */
  function select(id) {
    if (m.busy || id === m.selId) return;
    m.selId = id;
    m.note = "";
    m.noteOk = true;
    paintList();
    paintConfirm();
    paintNote();

    /* paintList() replaced the row that was just clicked; put the keyboard
       back on its successor rather than on the document. */
    S.$$("#topup-list .urow").forEach(function (btn) {
      if (btn.getAttribute("data-id") === id) btn.focus();
    });
  }

  function credit() {
    /* A write is already on its way. A second press is not a second charge:
       it is dropped, never queued behind the first. */
    if (m.busy) return;

    var s = selected();
    var value = cents();
    if (!s || value === null) return;

    m.busy = true;
    m.note = "";
    lock(true);
    paintList();    // the rows go inert for the moment the write takes
    paintConfirm(); // "Ukladá sa…", and the button that was pressed is gone
    paintNote();
    /* A disabled button cannot hold focus, and focus must not escape the
       dialog, so the keyboard parks on the dialog itself for the duration. */
    var box = S.$("#topup-dialog");
    if (box) box.focus();

    S.api.topUp(s.id, value).then(function (resp) {
      m.busy = false;
      lock(false);

      /* The balance is the server's arithmetic: it is copied out of the
         response, never computed from the amount we sent. */
      var rec = applyBalance(resp) || s;
      var known = resp && typeof resp.balanceCents === "number";

      /* Emptying the field disarms the button, so the same sum cannot be
         credited twice by a second press. */
      m.amount = "";
      var amt = S.$("#topup-amt");
      if (amt) amt.value = "";

      m.note = known
        ? "Pripísané " + S.eur(value) + " · " + rec.name + " má teraz " + S.eur(rec.balanceCents) + "."
        : "Pripísané " + S.eur(value) + " žiakovi " + rec.name + ".";
      m.noteOk = true;

      paintList();
      paintConfirm();
      paintNote();
      if (amt) amt.focus(); // the button it was pressed on is disabled now
      S.announce(S.$("#live"), m.note);
    }, function (err) {
      /* No money moved. The amount is still in the field to try again with,
         the list is the list it was, and only this sentence is new. */
      m.busy = false;
      lock(false);
      m.note = (err && err.message) || "Nastala chyba. Skúste to znova.";
      m.noteOk = false;

      paintList();
      paintConfirm();
      paintNote();
      var btn = S.$("#topup-confirm");
      if (btn && !btn.disabled) btn.focus();
      else { var box2 = S.$("#topup-dialog"); if (box2) box2.focus(); }
      S.announce(S.$("#live"), m.note);
    });
  }

  function applyBalance(resp) {
    if (!resp || !resp.id) return null;
    var found = null;
    m.list.forEach(function (s) {
      if (s.id !== resp.id) return;
      if (typeof resp.balanceCents === "number") s.balanceCents = resp.balanceCents;
      found = s;
    });
    return found;
  }

  /* ---------- opening, closing, and the keyboard ---------- */

  function focusables() {
    var box = S.$("#topup-dialog");
    if (!box) return [];
    return S.$$("button:not([disabled]), input:not([disabled]), a[href]", box);
  }

  function onKeydown(e) {
    if (!m.open) return;

    if (e.key === "Escape" || e.key === "Esc") {
      /* Not while the server is answering: closing here would leave the
         manager guessing whether the money landed. It is at most the API's
         own timeout, and the answer always arrives in this dialog. */
      if (m.busy) return;
      e.preventDefault();
      closeDialog();
      return;
    }

    if (e.key !== "Tab") return;

    var f = focusables();
    var box = S.$("#topup-dialog");
    if (!f.length) { e.preventDefault(); if (box) box.focus(); return; }

    var first = f[0], last = f[f.length - 1];
    var active = document.activeElement;
    var inside = box && box.contains(active);

    if (e.shiftKey && (!inside || active === first)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (!inside || active === last)) { e.preventDefault(); first.focus(); }
  }

  function openDialog() {
    if (m.open) return;
    var wrap = S.$("#topup");
    if (!wrap) return;

    var opener = document.activeElement;
    m = blank();
    m.open = true;
    m.opener = opener;

    var q = S.$("#topup-q");
    var amt = S.$("#topup-amt");
    if (q) { q.value = ""; q.disabled = false; }
    if (amt) { amt.value = ""; amt.disabled = false; }
    var close = S.$("#topup-close");
    if (close) close.disabled = false;

    wrap.hidden = false;
    document.documentElement.classList.add("modal-open");
    document.addEventListener("keydown", onKeydown);

    paintList();
    paintConfirm();
    paintNote();

    /* The roster, before a single letter is typed: a manager usually knows
       the face at the counter, not how the name is spelled. */
    runSearch("");

    if (q) q.focus();
  }

  function closeDialog() {
    if (!m.open || m.busy) return;
    var wrap = S.$("#topup");

    window.clearTimeout(m.timer);
    searchSeq++;    // every answer still out is now answering nobody
    m.open = false;
    document.removeEventListener("keydown", onKeydown);
    document.documentElement.classList.remove("modal-open");
    if (wrap) wrap.hidden = true;

    var back = m.opener;
    m = blank();
    if (back && back.focus && document.contains(back)) back.focus();
    else {
      var btn = S.$("#topup-open");
      if (btn) btn.focus();
    }
  }

  function bindDialog() {
    var opener = S.$("#topup-open");
    if (opener) opener.addEventListener("click", openDialog);

    var close = S.$("#topup-close");
    if (close) close.addEventListener("click", closeDialog);

    /* The backdrop is a sheet of its own under the panel, so a click that
       lands on it is a click outside the dialog and nothing else. */
    var back = S.$("#topup-back");
    if (back) back.addEventListener("click", closeDialog);

    var q = S.$("#topup-q");
    if (q) {
      q.addEventListener("input", function (e) {
        if (m.busy) return;
        m.q = e.target.value;
        queueSearch();
      });
    }

    var amt = S.$("#topup-amt");
    if (amt) {
      amt.addEventListener("input", function (e) {
        if (m.busy) return;
        m.amount = e.target.value;
        /* The field is never repainted, only what depends on it. */
        paintConfirm();
        if (m.note) { m.note = ""; m.noteOk = true; }
        paintNote();
      });
    }
  }

  /* ---------------------------------------------------------------- mount */

  /* Call once per page. Returns the element page content should render into. */
  function mount() {
    var app = S.APP, here = currentFile();
    var host = document.body;

    m = blank();

    var skip = '<a class="skip" href="#obsah">Preskočiť na obsah</a>';
    var content = S.$("#page-content");
    var inner = content ? content.innerHTML : "";

    host.innerHTML = skip +
      '<div class="mesh"></div>' +
      rail(app, here) +
      '<div class="main">' + topbar(app) +
      '<main class="page" id="obsah" tabindex="-1">' + inner + "</main></div>" +
      dialogHtml() +
      '<div id="live" role="status" aria-live="polite" class="sr-only"></div>';

    bindDialog();

    return S.$("#obsah");
  }

  /* Reveal icons only once the ligature font can render them. Any failure
     path — no document.fonts, a timeout, an offline school wifi — reveals
     them anyway rather than leaving the UI iconless. */
  function revealIconsWhenReady() {
    var show = function () { document.documentElement.classList.add("fonts-ready"); };
    window.setTimeout(show, 3000); // never hide icons for longer than this
    if (!document.fonts || !document.fonts.load) { show(); return; }
    document.fonts.load('24px "Material Symbols Outlined"').then(show, show);
  }

  Object.assign(S, { mount: mount, currentFile: currentFile });
  revealIconsWhenReady();
})(window.SKYRO);
