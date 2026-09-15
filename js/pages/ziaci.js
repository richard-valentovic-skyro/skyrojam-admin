/* Žiaci — find a student, read their credit, top it up, turn the account on
   or off. Those are the only two writes the API has for an account, so they
   are the only two controls on this page.

   "NOVÝ ŽIAK" HAS NO ENDPOINT ON THIS BACKEND. There is no POST /students:
   the manager routes can list an account, activate it and top it up, and
   nothing opens one. The form stays anyway, because in mock mode it works end
   to end and the day the route exists it will work against the server with no
   edit here — and until then a live call gets its 404 turned into a plain
   Slovak sentence saying account creation is not supported yet. Written up in
   html/API-GAPS.md (§1).

   A STUDENT IS IDENTIFIED BY NAME AND TRIEDA. Every account carries classCode
   ("3.A"), so it sits on the row and in the panel: two Nina Bartošovás in a
   school of four hundred is not a hypothetical.

   THERE IS NO LEDGER EITHER. Nothing in the API returns movements, so the
   balance is the whole story — and it is the balance the server sent, never a
   sum of rows re-added on this side.

   Three rules hold this page together:

   1. A STAGED AMOUNT BELONGS TO THE STUDENT IT WAS TYPED FOR. The React build
      kept the amount in state that outlived the selection: arm 100 €, click
      another name, press Pripísať, and the money landed on the wrong account.
      select() clears the amount and the status line, so that is impossible.

   2. NOTHING IS SHOWN BEFORE THE SERVER AGREES TO IT. Every write goes out
      through S.api and the new balance or the new active flag is copied out of
      the response exactly as it came. A refused or lost request leaves the
      list, the balance and the panel exactly as they were and says why under
      the button. While a write is open its control reads "Ukladá sa…" and the
      page takes no further commands, so one click cannot become two charges.

   3. THE SEARCH IS THE SERVER'S. Typing calls GET /students?q=, debounced, and
      every reply carries the sequence number of the request that asked for it —
      a slow answer to "ni" can never overwrite the fast answer to "nina".

   The page paints once and then repaints in three narrow pieces. Rewriting the
   whole page on a keystroke would take the caret out of the field being typed
   into, so the search box and the amount field are never replaced while they
   are in use. */
var page = function (S, root) {
  "use strict";

  /* Shortcuts on the till, in cents. The label stays "10 €" the way the button
     is printed; every amount that lands on a balance goes through S.eur. */
  var QUICK = [
    { cents: 1000,  label: "10 €",  text: "10" },
    { cents: 2000,  label: "20 €",  text: "20" },
    { cents: 5000,  label: "50 €",  text: "50" },
    { cents: 10000, label: "100 €", text: "100" }
  ];

  var DEBOUNCE_MS = 300;

  var list = S.__students || [];

  /* The selected record is held apart from the list rather than looked up in
     it. A search that excludes the selected student must not blank the panel
     under the manager's hands mid-top-up. */
  var sel = list[0] || null;

  var q = "";              // search text
  var amount = "";         // staged top-up, exactly as typed ("12,50")
  var note = "";           // status line under the top-up button
  var noteOk = true;       // false turns that line into a refusal

  /* The write on its way to the server: "credit" or "toggle", plus the account
     it belongs to. Every action returns early while this is set, so a second
     click is dropped rather than queued — the whole reason one press cannot
     charge an account twice. */
  var busy = "";
  var busyId = "";

  /* Search bookkeeping. searchSeq is the cancel-safety: only the newest
     request may write to the list. */
  var searchSeq = 0;
  var searchTimer = null;
  var searchErr = null;
  var announceTimer = null;

  var sub = null;          // the page-head subtitle, re-read when counts move

  /* The create form takes over the sidebar rather than opening a dialog: it is
     the same column the selected account uses, and one thing is edited at a
     time either way. */
  var creating = false;
  var nName = "";
  var nUser = "";
  var nClass = "";         // the trieda — optional, the server allows none
  var nUserEdited = false; // once touched, the name stops overwriting it

  /* ------------------------------------------------------------ reading */

  /* Rose cannot buy a lunch, peach is down to the last few, otherwise the
     ordinary ink — a balance in good standing is not a status. */
  function balanceColor(cents) {
    var c = Number(cents);
    if (c < S.LUNCH_PRICE_CENTS) return "var(--c-rose)";
    if (c < S.LUNCH_PRICE_CENTS * 3) return "var(--c-peach)";
    return "var(--ink)";
  }

  function rowById(id) {
    var found = null;
    list.forEach(function (s) { if (s.id === id) found = s; });
    return found;
  }

  /* The server's answer replaces our copy field by field, in both places the
     same account is drawn. Nothing about an account is recomputed here. */
  function applyPatch(id, fields) {
    if (sel && sel.id === id) Object.assign(sel, fields);
    var row = rowById(id);
    if (row && row !== sel) Object.assign(row, fields);
  }

  function parsed() { return S.parseAmountCents(amount); }

  function quickByCents(cents) {
    var found = null;
    QUICK.forEach(function (item) { if (item.cents === cents) found = item; });
    return found;
  }

  function subtitle() {
    /* A search that failed knows nothing about the roster. Counting the rows
       it did not get would put "0 účtov" in the header as if that were a
       fact about the school. */
    if (searchErr) return "Zoznam sa nepodarilo načítať";

    var n = list.length;
    var low = list.filter(function (s) {
      return s.active && Number(s.balanceCents) < S.LUNCH_PRICE_CENTS;
    }).length;
    return n + " " + S.pluralUcet(n) + " · " + low + " bez kreditu na obed";
  }

  function writing(kind, id) {
    return busy === kind && (id === undefined || busyId === id);
  }

  /* ------------------------------------------------------------- markup */

  /* Same wording and same icon as every other pending control in both apps,
     so a write looks the same everywhere. */
  function pendingHtml() {
    return S.icon("progress_activity") + "Ukladá sa…";
  }

  /* Put a control into that state in place, without repainting the panel
     around it: rebuilding the aside here would replace the amount field the
     click came from. Only the label changes, and clicks stop. */
  function markPending(btn) {
    if (!btn) return;
    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    btn.innerHTML = pendingHtml();
  }

  function studentRow(s) {
    return '<button type="button" class="urow' + (sel && s.id === sel.id ? " sel" : "") +
      (s.active ? "" : " off") + '" data-id="' + S.esc(s.id) + '"' +
      ' aria-pressed="' + (!!sel && s.id === sel.id) + '">' +
      '<span class="av">' + S.esc(S.initials(s.name)) + "</span>" +
      '<span class="ui">' +
        '<span class="un2">' + S.esc(s.name) + "</span>" +
        '<span class="ue">' + S.esc(s.username) + "</span>" +
        /* The greyed-out row says "inactive" in colour alone; say it in words
           too, for anyone who never sees the colour. */
        (s.active ? "" : '<span class="sr-only">Neaktívny účet</span>') +
      "</span>" +
      /* The trieda, in the pill the design keeps for it. An account without
         one — the server allows null — simply has no pill. */
      (s.classCode ? '<span class="utr">' + S.esc(s.classCode) + "</span>" : "") +
      '<span class="ubal" style="color:' + balanceColor(s.balanceCents) + '">' +
        S.esc(S.eur(s.balanceCents)) + "</span>" +
    "</button>";
  }

  function listHtml() {
    /* A failed search must not leave the previous rows on screen pretending
       to answer the query that was typed. Say what happened, and offer the
       same search again. */
    if (searchErr) {
      return '<div class="empty" role="alert">' + S.icon("cloud_off") +
        "<b>Vyhľadávanie zlyhalo</b>" +
        '<p class="boot-msg">' + S.esc(searchErr) + "</p>" +
        '<button class="btn" type="button" id="search-retry">' +
          S.icon("refresh") + "Skúsiť znova</button></div>";
    }

    if (!list.length) {
      return '<div class="empty">' + S.icon("person_off") +
        (q.trim()
          ? "<b>Nikto sa nenašiel</b>" +
            '<p class="boot-msg">Skúste iné meno alebo používateľské meno.</p>'
          : "<b>Zoznam účtov je prázdny</b>" +
            '<p class="boot-msg">Účty žiakov zakladá správca školského systému.</p>') +
        "</div>";
    }

    return list.map(studentRow).join("");
  }

  function quickBtn(item) {
    return '<button type="button" class="qamt" data-cents="' + S.esc(item.cents) + '"' +
      ' aria-pressed="' + (parsed() === item.cents) + '">' + S.esc(item.label) + "</button>";
  }

  function creditBtn() {
    if (writing("credit", sel.id)) {
      return '<button type="button" class="btn block" id="credit" disabled aria-busy="true">' +
        pendingHtml() + "</button>";
    }
    var cents = parsed();
    return '<button type="button" class="btn block" id="credit"' +
      (cents === null ? " disabled" : "") + ">" +
      S.icon("add_card") + "Pripísať" +
      (cents === null ? "" : '<span class="qty">' + S.esc(S.eur(cents)) + "</span>") +
      "</button>";
  }

  function noteHtml() {
    if (!note) return "";
    return '<p class="note mt-s" role="status" style="font-weight:600;color:' +
      (noteOk ? "var(--c-green)" : "var(--c-rose)") + '">' + S.esc(note) + "</p>";
  }

  /* A username is the school address without the domain, so it is derived
     from the name with the diacritics stripped — and stays editable, because
     two Jána Nováks need different ones. */
  function createHtml() {
    var ready = nName.trim() && nUser.trim() && S.looksLikeUsername(nUser);
    var working = writing("create");

    return '<form class="plain" id="newform" style="display:flex;flex-direction:column;gap:16px">' +
      '<div class="ph"><span class="pd">Nový účet žiaka</span>' +
        '<button class="sq" type="button" id="newcancel" aria-label="Zavrieť bez uloženia">' +
          S.icon("close") + "</button></div>" +

      '<div><label class="flabel" for="n-name">Meno a priezvisko</label>' +
        '<input class="finput" id="n-name" autocomplete="off" value="' + S.esc(nName) + '"' +
        ' placeholder="Napríklad Jana Nováková"></div>' +

      '<div><label class="flabel" for="n-user">Používateľské meno</label>' +
        '<input class="finput" id="n-user" autocomplete="off" spellcheck="false"' +
        ' autocapitalize="none" value="' + S.esc(nUser) + '" placeholder="meno.priezvisko">' +
        '<p class="note" style="padding:8px 0 0">Predvyplní sa z mena bez ' +
          "diakritiky. Týmto menom sa žiak prihlasuje; heslo mu nastaví správca." +
        "</p></div>" +

      '<div><label class="flabel" for="n-class">Trieda</label>' +
        '<input class="finput" id="n-class" autocomplete="off" value="' + S.esc(nClass) + '"' +
        ' placeholder="Napríklad 3.A"></div>' +

      '<button class="btn block" type="submit" id="newsave"' +
        (ready && !working ? "" : " disabled") + (working ? ' aria-busy="true"' : "") + ">" +
        S.icon(working ? "progress_activity" : "person_add") +
        (working ? "Ukladá sa…" : "Vytvoriť účet") + "</button>" +

      noteHtml() +
      '<p class="note">Nový účet začína s nulovým kreditom. Dobiť ho môžete ' +
        "hneď po vytvorení.</p>" +
      "</form>";
  }

  function asideHtml() {
    if (creating) return createHtml();
    if (!sel) {
      return '<div class="plain dash"><p class="pempty"><b>Vyberte žiaka</b>' +
        "Kliknite na účet v zozname a uvidíte jeho zostatok, kredit a prístup " +
        "k obedom.</p></div>";
    }

    var s = sel;
    var left = S.lunchesLeft(s.balanceCents);

    return '<div class="plain">' +
        '<div class="ph"><span class="pd">' + S.esc(s.name) + "</span>" +
          S.chip(s.active ? "ok" : "open", s.active ? "Aktívny" : "Neaktívny") + "</div>" +

        '<div class="row tight mb-m"><span class="ue grow">' +
          S.esc(s.username) + "</span>" +
          (s.classCode ? '<span class="utr">' + S.esc(s.classCode) + "</span>" : "") +
        "</div>" +

        '<div class="balbig" style="color:' + balanceColor(s.balanceCents) + '">' +
          S.esc(S.eur(s.balanceCents)) + "</div>" +
        '<div class="balsub">' +
          (Number(s.balanceCents) < S.LUNCH_PRICE_CENTS
            ? "Nestačí ani na jeden obed (" + S.esc(S.eur(S.LUNCH_PRICE_CENTS)) + ")"
            : "Vystačí na " + S.esc(left) + " " + S.esc(S.pluralObed(left)) +
              " po " + S.esc(S.eur(S.LUNCH_PRICE_CENTS))) +
        "</div>" +
      "</div>" +

      '<div class="plain">' +
        '<div class="ph"><span class="pd">Pripísať kredit</span></div>' +

        '<div class="quick" style="margin-bottom:12px">' +
          QUICK.map(quickBtn).join("") + "</div>" +

        '<label class="flabel" for="amt">Iná suma</label>' +
        '<input id="amt" class="finput" type="text" inputmode="decimal"' +
          ' autocomplete="off" placeholder="0,00" value="' + S.esc(amount) + '">' +

        '<div class="mt-s">' + creditBtn() + "</div>" +

        /* Written out for the eye; the live region says the same thing for
           screen readers, so this carries no role of its own. */
        noteHtml() +

        '<button type="button" class="btn soft block mt-s" id="toggle"' +
          (writing("toggle", s.id) ? ' disabled aria-busy="true"' : "") + ">" +
          (writing("toggle", s.id)
            ? pendingHtml()
            : S.icon(s.active ? "block" : "check_circle") +
              (s.active ? "Deaktivovať účet" : "Aktivovať účet")) + "</button>" +

        '<p class="note mt-s">' +
          (s.active
            ? "Neaktívny účet si nemôže objednať obed. Kredit na ňom zostáva."
            : "Kým je účet neaktívny, žiak si obed neobjedná.") + "</p>" +
      "</div>";
  }

  /* -------------------------------------------------------------- paint */

  function render() {
    root.innerHTML =
      S.pageHead("Žiaci", subtitle(),
        '<button class="btn" type="button" id="new"' +
          (creating ? " disabled" : "") + ">" + S.icon("person_add") +
          "Nový žiak</button>") +

      '<div class="split main-aside">' +
        '<div class="stack" id="left">' +
          '<div class="search">' + S.icon("search") +
            '<input id="q" type="text" autocomplete="off" aria-label="Hľadať žiaka"' +
              ' placeholder="Hľadajte meno alebo používateľské meno" value="' + S.esc(q) + '">' +
          "</div>" +
          listHtml() +
        "</div>" +

        '<aside class="aside sticky stack l" id="aside">' + asideHtml() + "</aside>" +
      "</div>";

    sub = S.$("h1 + p", root); // pageHead gives the subtitle no id of its own
    bindSearch();
    bindList();
    bindAside();
  }

  function paintHead() {
    if (sub) sub.textContent = subtitle();
  }

  /* Only the rows are rewritten; the search field above them keeps focus and
     its caret. */
  function paintList() {
    var host = S.$("#left", root);
    var box = S.$(".search", host);
    while (box.nextSibling) host.removeChild(box.nextSibling);
    box.insertAdjacentHTML("afterend", listHtml());
    bindList();
  }

  function paintAside() {
    S.$("#aside", root).innerHTML = asideHtml();
    bindAside();
  }

  /* The magnifier becomes the pending glyph while a query is out. Swapping the
     ligature in place is the one way to show it without replacing the input
     the manager is typing into. */
  function showSearching(on) {
    var ic = S.$(".search .ms", root);
    if (ic) ic.textContent = on ? "progress_activity" : "search";
  }

  /* ------------------------------------------------------------ binding */

  function bindSearch() {
    S.$("#q", root).addEventListener("input", function (e) {
      q = e.target.value;
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(function () { runSearch(q); }, DEBOUNCE_MS);
    });
  }

  function bindList() {
    S.$$("#left .urow", root).forEach(function (btn) {
      btn.addEventListener("click", function () { select(btn.getAttribute("data-id")); });
    });

    var retry = S.$("#search-retry", root);
    if (retry) retry.addEventListener("click", function () { runSearch(q); });
  }

  function openCreate() {
    creating = true;
    nName = "";
    nUser = "";
    nClass = "";
    nUserEdited = false;
    note = "";
    noteOk = true;
    render();
    var el = S.$("#n-name", root);
    if (el) el.focus();
  }

  function closeCreate(focusSel) {
    creating = false;
    note = "";
    noteOk = true;
    render();
    var el = S.$(focusSel || "#new", root);
    if (el) el.focus();
  }

  function bindCreate() {
    var name = S.$("#n-name", root);
    var user = S.$("#n-user", root);
    var klass = S.$("#n-class", root);
    if (!name || !user || !klass) return;

    function sync() {
      var save = S.$("#newsave", root);
      if (save) {
        save.disabled = !(nName.trim() && nUser.trim() && S.looksLikeUsername(nUser)) ||
          !!writing("create");
      }
    }

    name.addEventListener("input", function () {
      nName = name.value;
      if (!nUserEdited) {
        nUser = S.usernameFromName(nName);
        user.value = nUser;
      }
      sync();
    });

    user.addEventListener("input", function () {
      nUser = user.value;
      nUserEdited = true;
      sync();
    });

    /* The trieda is optional — it never arms or disarms the button. */
    klass.addEventListener("input", function () { nClass = klass.value; });

    S.$("#newcancel", root).addEventListener("click", function () { closeCreate(); });

    S.$("#newform", root).addEventListener("submit", function (ev) {
      ev.preventDefault();
      createAccount();
    });
  }

  function createAccount() {
    if (writing("create")) return;
    var payload = {
      name: nName.trim(),
      username: nUser.trim().toLowerCase(),
      classCode: nClass.trim() || null
    };
    if (!payload.name || !S.looksLikeUsername(payload.username)) return;

    busy = "create";
    busyId = "";
    note = "";
    render();

    /* THIS ROUTE DOES NOT EXIST ON THIS BACKEND — there is no POST /students.
       In mock mode the account is created and this page behaves exactly as it
       will the day the route ships. Against a live server the 404 comes back
       through the API layer as a plain Slovak sentence saying so, and it lands
       in the same status line as any other refusal. See html/API-GAPS.md (§1). */
    S.api.createStudent(payload).then(
      function (fresh) {
        busy = "";
        busyId = "";
        if (!fresh || !fresh.id) {
          noteOk = false;
          note = "Účet sa nepodarilo vytvoriť.";
          render();
          return;
        }
        /* The server's row, not the one that was typed. */
        list.unshift(fresh);
        sel = fresh;
        creating = false;
        noteOk = true;
        note = "Účet pre " + fresh.name + " je vytvorený. Kredit je zatiaľ nulový.";
        render();
        /* The panel now shows the new account, so the keyboard lands on the
           amount field — topping it up is the next thing anyone does. */
        var el = S.$("#amt", root) || S.$("#new", root);
        if (el) el.focus();
        S.announce(S.$("#live"), note);
      },
      function (err) {
        busy = "";
        busyId = "";
        noteOk = false;
        note = (err && err.message) || "Účet sa nepodarilo vytvoriť.";
        render();
        var el = S.$("#n-user", root);
        if (el) el.focus();
      }
    );
  }

  function bindAside() {
    var nw = S.$("#new", root);
    if (nw) nw.addEventListener("click", openCreate);
    if (creating) { bindCreate(); return; }
    if (!sel) return;

    S.$$("#aside .qamt", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        /* The shortcut fills the field it sits above rather than arming a
           separate number, so what is credited is always what is on screen.
           Its text comes from the table — cents are never divided back into
           euros to make it. */
        var item = quickByCents(Number(btn.getAttribute("data-cents")));
        if (!item) return;
        amount = item.text;
        syncAmount();
      });
    });

    S.$("#amt", root).addEventListener("input", function (e) {
      amount = e.target.value;
      syncAmount();
    });

    S.$("#credit", root).addEventListener("click", credit);
    S.$("#toggle", root).addEventListener("click", toggleActive);
  }

  /* The staged amount drives three things. Redrawing the panel to update them
     would pull the caret out of the field, so they are set in place. */
  function syncAmount() {
    var amt = S.$("#amt", root);
    if (amt && amt.value !== amount) amt.value = amount;

    var cents = parsed();
    S.$$("#aside .qamt", root).forEach(function (btn) {
      btn.setAttribute("aria-pressed",
        String(Number(btn.getAttribute("data-cents")) === cents));
    });

    /* The button belongs to the write in flight; typing must not hand it back
       before the server has answered. */
    var btn = S.$("#credit", root);
    if (!btn || writing("credit", sel && sel.id)) return;

    btn.disabled = cents === null;
    btn.innerHTML = S.icon("add_card") + "Pripísať" +
      (cents === null ? "" : '<span class="qty">' + S.esc(S.eur(cents)) + "</span>");
  }

  /* ------------------------------------------------------------- search */

  /* Every reply carries the number of the request that asked for it. A slow
     answer to "ni" arriving after the fast answer to "nina" is dropped, so the
     rows always belong to the letters on screen. */
  function runSearch(text) {
    var seq = ++searchSeq;
    showSearching(true);

    S.api.students(text.trim()).then(
      function (data) {
        if (seq !== searchSeq) return;
        showSearching(false);
        searchErr = null;
        list = (data && data.students) || [];

        /* The freshest copy of the selected account is the one that just
           arrived; adopt it rather than keeping ours beside it. */
        var again = sel ? rowById(sel.id) : null;
        if (again) sel = again;

        paintHead();
        paintList();
        paintAside();
        announceCount();
      },
      function (err) {
        if (seq !== searchSeq) return;
        showSearching(false);
        searchErr = (err && err.message) || "Nastala chyba. Skúste to znova.";
        list = [];
        paintHead();
        paintList();
        S.announce(S.$("#live"), searchErr);
      }
    );
  }

  /* Announced once the results land rather than per keystroke — a message per
     letter would talk over the letters being typed. */
  function announceCount() {
    window.clearTimeout(announceTimer);
    announceTimer = window.setTimeout(function () {
      var n = list.length;
      S.announce(S.$("#live"), n === 0
        ? "Nenašiel sa žiadny žiak."
        : n + " " + (n === 1 ? "nájdený žiak" : n < 5 ? "nájdení žiaci" : "nájdených žiakov") + ".");
    }, 250);
  }

  /* ------------------------------------------------------------ actions */

  function select(id) {
    /* A write in flight belongs to the account it was started on. Letting the
       panel move to another name underneath it is exactly the bug this file
       opens with, so the list is inert for the moment the write takes. */
    if (busy) return;

    var rec = rowById(id);
    if (!rec) return;

    sel = rec;
    amount = "";   // a sum can only ever be credited to the student it was typed for
    note = "";
    noteOk = true;

    paintList();
    paintAside();

    /* paintList() replaced the row that was just clicked; put the keyboard
       back on its successor. The id is compared, never spliced into a
       selector — one quote in it and querySelector throws mid-click. */
    S.$$("#left .urow", root).forEach(function (btn) {
      if (btn.getAttribute("data-id") === id) btn.focus();
    });
  }

  /* One ending for every failed write. err.message comes from the API layer
     already in Slovak and already safe to show, so this page never invents
     text for a refusal: the control comes back enabled and not one byte of
     the list or the balance has moved. */
  function fail(err, focusSel) {
    busy = "";
    busyId = "";
    note = (err && err.message) || "Nastala chyba. Skúste to znova.";
    noteOk = false;
    paintAside();
    var el = focusSel ? S.$(focusSel, root) : null;
    if (el) el.focus();
    S.announce(S.$("#live"), note);
  }

  function credit() {
    /* A write is already on its way. A second press is not a second charge:
       it is dropped, never queued behind the first. */
    if (busy) return;
    if (!sel) return;

    var cents = parsed();
    if (cents === null) return;

    var s = sel;
    busy = "credit";
    busyId = s.id;
    note = "";
    markPending(S.$("#credit", root));

    S.api.topUp(s.id, cents).then(
      function (resp) {
        busy = "";
        busyId = "";

        /* Emptied first, whatever the answer says: a request that may have
           gone through must never leave a primed amount behind a button. */
        amount = "";

        /* The money is the server's arithmetic. Without a balance in the
           response there is nothing honest to draw, so the old number stays
           and the line says the page can no longer vouch for it. */
        if (!resp || typeof resp.balanceCents !== "number") {
          note = "Server nepotvrdil nový zostatok. Obnovte stránku a skontrolujte účet.";
          noteOk = false;
          paintAside();
          var back = S.$("#amt", root);
          if (back) back.focus();
          S.announce(S.$("#live"), note);
          return;
        }

        applyPatch(s.id, { balanceCents: resp.balanceCents });
        note = "Kredit pripísaný. Nový zostatok " + S.eur(resp.balanceCents) + ".";
        noteOk = true;

        paintHead();
        paintList();
        paintAside();

        var amt = S.$("#amt", root);
        if (amt) amt.focus(); // the button it was pressed on is disabled now
        S.announce(S.$("#live"), note);
      },
      function (err) {
        /* No balance moved, and the typed amount is still in the field to try
           again with. */
        fail(err, "#credit");
      }
    );
  }

  function toggleActive() {
    if (busy) return;
    if (!sel) return;

    var s = sel;
    var next = !s.active;

    busy = "toggle";
    busyId = s.id;
    markPending(S.$("#toggle", root));

    S.api.setStudentActive(s.id, next).then(
      function (resp) {
        busy = "";
        busyId = "";

        /* The flag the list and the chip draw is the one that came back, never
           the one that was asked for. */
        if (!resp || typeof resp.active !== "boolean") {
          note = "Server nepotvrdil stav účtu. Obnovte stránku a skontrolujte ho.";
          noteOk = false;
          paintAside();
          var back = S.$("#toggle", root);
          if (back) back.focus();
          S.announce(S.$("#live"), note);
          return;
        }

        applyPatch(s.id, { active: resp.active });

        /* A standing refusal was about the account as it was a moment ago — it
           must not outlive the change. A green confirmation stands. */
        if (!noteOk) { note = ""; noteOk = true; }

        paintHead();
        paintList();
        paintAside();

        var btn = S.$("#toggle", root);
        if (btn) btn.focus(); // paintAside() replaced the button under us
        S.announce(S.$("#live"), "Účet žiaka " + s.name +
          (resp.active ? " je aktívny." : " je neaktívny."));
      },
      function (err) {
        /* The account is still whatever it was before the click. */
        fail(err, "#toggle");
      }
    );
  }

  render();
};

/* The roster is the page: boot holds the spinner until it lands and shows its
   own retry, in Slovak, if it does not. Every later list comes from the same
   endpoint with a q on it. */
page.load = function (S) {
  return S.api.students().then(function (data) {
    S.__students = (data && data.students) || [];
  });
};

SKYRO.page(page);
