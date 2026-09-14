/* Student accounts: find a student, read their credit, top it up.

   The React build staged the top-up amount in state that outlived the
   selection. Arm 100 €, click a different name in the list, press Pripísať,
   and the money landed on the wrong account — the panel had already redrawn
   with the new student's name above the armed sum. select() clears the staged
   amount and the status line here, so a sum can only ever be credited to the
   student it was typed for.

   The balance is the number the canteen keeps on the account, exactly as on
   the student's own credit page: it is read from the record and never
   re-summed from the ledger rows below it. A top-up moves it once, on an
   explicit click, and the amount is cleared the moment the server confirms
   the charge — so a second press of an already-spent sum does nothing.

   NOTHING HERE IS ADDED UP LOCALLY AND NOTHING IS SHOWN BEFORE THE SERVER
   AGREES TO IT. Every write goes out through S.api; the new balance, the new
   ledger row and its timestamp come back in the response and are copied in as
   they are. A refused or lost request therefore leaves the list, the balance
   and the ledger exactly as they were, and says why in the status line under
   the button. While a write is in flight the control that started it reads
   "Ukladá sa…" and the page takes no further commands, so one click can never
   become two charges. */
SKYRO.page(function (S, root) {
  "use strict";

  var QUICK = [10, 20, 50, 100];
  var SAVING = "Ukladá sa…";

  /* Working copies: this page edits accounts and writes ledger rows, the
     fixtures stay clean. */
  var students = S.STUDENTS.map(function (s) { return Object.assign({}, s); });
  var ledger = S.LEDGER.slice();

  var q = "";                       // search text
  var selId = students[0].id;       // the account on the right
  var creating = false;             // the sidebar shows the new-account form
  var amount = "";                  // staged top-up, exactly as typed ("12,50")
  var note = "";                    // status line under the top-up button
  var noteOk = true;                // false turns that line into a refusal

  /* The write on its way to the server: "credit", "toggle" or "create", plus
     the account it belongs to. Every action returns early while this is set,
     so a second click is ignored rather than queued — which is the whole
     reason one press cannot charge an account twice. */
  var busy = "";
  var busyId = "";

  /* the new-account form */
  var newName = "";
  var newTrieda = "";
  var newEmail = "";
  var emailEdited = false;          // once true, the name stops filling the address
  var sub = null;                   // the page-head subtitle, re-read when counts move
  var announceTimer = null;

  /* Green covers lunches, peach is nearly out, rose is empty. */
  function balanceState(balance) {
    if (balance < S.LUNCH_PRICE) return "bad";
    if (balance < S.LUNCH_PRICE * 3) return "warn";
    return "ok";
  }

  function balanceColor(balance) {
    var st = balanceState(balance);
    return st === "bad" ? "var(--c-rose)" : st === "warn" ? "var(--c-peach)" : "var(--ink)";
  }

  /* Slovak counts lunches in three shapes: 1 obed, 2–4 obedy, 5+ obedov. */
  function obed(n) { return n === 1 ? "obed" : n < 5 ? "obedy" : "obedov"; }

  /* True while the control on screen is the one waiting for an answer. The
     markup asks as well as the click handler: anything that repaints during a
     write must draw the same pending button, or the control comes back
     clickable while the request is still out. */
  function writing(kind, id) {
    return busy === kind && (id === undefined || busyId === id);
  }

  /* The pending state, written in place so the panel around it is not rebuilt
     and the amount typed into the field beside it is not disturbed: the button
     keeps its class and its place, says what it is doing, and stops taking
     clicks. Same wording and same icon as the student app's confirm button. */
  function pendingHtml() {
    return S.icon("progress_activity") + SAVING;
  }

  function pending(btn) {
    if (!btn) return;
    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    btn.innerHTML = pendingHtml();
  }

  /* The server's record replaces ours whole — balance, active flag and all.
     Nothing about an account is recomputed on this side. */
  function applyStudent(rec) {
    if (!rec || !rec.id) return null;
    for (var i = 0; i < students.length; i++) {
      if (students[i].id === rec.id) {
        students[i] = Object.assign({}, rec);
        return students[i];
      }
    }
    return null;
  }

  /* One ending for every failed write. err.message is already Slovak and
     already safe to show, so this page never writes its own text for it: the
     refusal goes into the same status line a local refusal uses, the control
     comes back enabled, and not one byte of local state has moved. */
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

  function selected() {
    return students.filter(function (s) { return s.id === selId; })[0] || null;
  }

  /* Name, e-mail and trieda all answer the same box. */
  function matches() {
    var n = q.trim().toLowerCase();
    if (!n) return students;
    return students.filter(function (s) {
      return s.name.toLowerCase().indexOf(n) > -1 ||
        s.email.toLowerCase().indexOf(n) > -1 ||
        s.trieda.toLowerCase().indexOf(n) > -1;
    });
  }

  /* Slovak keyboards type "12,50", not "12.50". */
  /* Bare Number() accepted "0x10" (16 €), "1e3" (1000 €) and a third decimal
     that drifted the ledger a cent from the balance. S.parseAmount refuses
     all of those and caps a typo at S.MAX_TOPUP. */
  function parsed() { return S.parseAmount(amount); }
  function validAmount() { return parsed() !== null; }

  function subtitle() {
    var low = students.filter(function (s) {
      return s.active && s.balance < S.LUNCH_PRICE;
    }).length;
    return students.length + " účtov · " + low + " bez kreditu na obed";
  }

  /* ---------- markup ---------- */

  function studentRow(s) {
    return '<button type="button" class="urow' + (s.id === selId ? " sel" : "") +
      (s.active ? "" : " off") + '" data-id="' + S.esc(s.id) + '"' +
      ' aria-pressed="' + (s.id === selId) + '">' +
      '<span class="av">' + S.esc(S.initials(s.name)) + "</span>" +
      '<span class="ui">' +
        '<span class="un2">' + S.esc(s.name) + "</span>" +
        '<span class="ue">' + S.esc(s.email) + "</span>" +
        /* The greyed-out row says "inactive" in colour alone; say it in words
           too, for anyone who never sees the colour. */
        (s.active ? "" : '<span class="sr-only">Neaktívny účet</span>') +
      "</span>" +
      '<span class="utr">' + S.esc(s.trieda) + "</span>" +
      '<span class="ubal" style="color:' + balanceColor(s.balance) + '">' +
        S.eur(s.balance) + "</span>" +
    "</button>";
  }

  function listHtml() {
    var list = matches();
    if (list.length === 0) {
      return '<div class="empty">' + S.icon("person_off") +
        "Nikto sa nenašiel.<br>Skúste iné meno alebo triedu.</div>";
    }
    return list.map(studentRow).join("");
  }

  function ledRow(l) {
    var up = l.amount > 0;
    return '<div class="led ' + (up ? "up" : "down") + '">' +
      '<span class="ldisc">' + S.icon(up ? "add" : "restaurant") + "</span>" +
      '<span class="li">' +
        '<span class="ll">' + S.esc(l.label) + "</span>" +
        '<span class="lt">' + S.esc(l.at) +
          (l.by ? " · " + S.esc(l.by) : "") + "</span>" +
      "</span>" +
      '<span class="la">' + (up ? "+" : "") + S.eur(l.amount) + "</span>" +
    "</div>";
  }

  /* A shortcut, not a sum on an account: it stays "50 €", the way the button
     is labelled on the till. Every amount that lands on a balance goes
     through S.eur below. */
  function quickBtn(a) {
    return '<button type="button" class="qamt" data-amt="' + S.esc(a) + '"' +
      ' aria-pressed="' + (amount === String(a)) + '">' + S.esc(a) + " €</button>";
  }

  function creditBtn() {
    if (writing("credit", selId)) {
      return '<button type="button" class="btn block" id="credit" disabled aria-busy="true">' +
        pendingHtml() + "</button>";
    }
    var ok = validAmount();
    return '<button type="button" class="btn block" id="credit"' + (ok ? "" : " disabled") + ">" +
      S.icon("add_card") + "Pripísať" +
      (ok ? '<span class="qty">' + S.eur(parsed()) + "</span>" : "") + "</button>";
  }

  function createForm() {
    var ready = newName.trim() !== "" && newTrieda.trim() !== "";

    return '<form class="plain" id="create">' +
      '<div class="ph"><span class="pd">Nový účet žiaka</span>' +
        '<button type="button" class="sq" id="close" aria-label="Zavrieť">' +
          S.icon("close") + "</button></div>" +

      '<div class="stack l">' +
        "<div>" +
          '<label class="flabel" for="n">Meno a priezvisko</label>' +
          '<input id="n" class="finput" type="text" autocomplete="off"' +
            ' placeholder="Napríklad Jana Nováková" value="' + S.esc(newName) + '">' +
        "</div>" +

        "<div>" +
          '<label class="flabel" for="tr">Trieda</label>' +
          '<input id="tr" class="finput" type="text" autocomplete="off"' +
            ' placeholder="3.A" value="' + S.esc(newTrieda) + '">' +
        "</div>" +

        "<div>" +
          '<label class="flabel" for="em">Školský e-mail</label>' +
          '<input id="em" class="finput" type="email" autocomplete="off"' +
            ' placeholder="meno.priezvisko@skyro.ai" value="' + S.esc(newEmail) + '">' +
          '<p class="note mt-s">Predvyplní sa z mena bez diakritiky. ' +
            "Žiak sa prihlasuje jednorazovým odkazom na túto adresu.</p>" +
        "</div>" +

        (writing("create")
          ? '<button class="btn block" type="submit" id="make" disabled aria-busy="true">' +
            pendingHtml() + "</button>"
          : '<button class="btn block" type="submit" id="make"' + (ready ? "" : " disabled") + ">" +
            S.icon("person_add") + "Vytvoriť účet</button>") +

        /* The same status line as the top-up panel below. A refusal from here
           — an address the server already knows, or a request that never
           landed — has to be readable without closing the form. */
        (note
          ? '<p class="note mt-s" role="status" style="font-weight:600;color:' +
            (noteOk ? "var(--c-green)" : "var(--c-rose)") + '">' +
            S.esc(note) + "</p>"
          : "") +
      "</div></form>";
  }

  function asideHtml() {
    if (creating) return createForm();

    var s = selected();
    if (!s) {
      return '<div class="plain dash"><p class="pempty"><b>Vyberte žiaka</b>' +
        "Kliknite na účet v zozname a uvidíte jeho kredit, pohyby a možnosť dobiť.</p></div>";
    }

    var left = S.lunchesLeft(s.balance);
    var rows = ledger.filter(function (l) { return l.studentId === s.id; }).slice(0, 6);

    return '<div class="plain">' +
        '<div class="ph"><span class="pd">' + S.esc(s.name) + "</span>" +
          S.chip(s.active ? "ok" : "open", s.active ? "Aktívny" : "Neaktívny") + "</div>" +

        '<div class="row mb-m"><div class="ue">' + S.esc(s.email) + "</div>" +
          '<span class="utr">' + S.esc(s.trieda) + "</span></div>" +

        '<div class="balbig" style="color:' + balanceColor(s.balance) + '">' +
          S.eur(s.balance) + "</div>" +
        '<div class="balsub">' +
          (s.balance < S.LUNCH_PRICE
            ? "Nestačí ani na jeden obed (" + S.eur(S.LUNCH_PRICE) + ")"
            : "Vystačí na " + left + " " + obed(left) + " po " + S.eur(S.LUNCH_PRICE)) +
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
        (note
          ? '<p class="note mt-s" role="status" style="font-weight:600;color:' +
            (noteOk ? "var(--c-green)" : "var(--c-rose)") + '">' +
            S.esc(note) + "</p>"
          : "") +

        '<button type="button" class="btn soft block mt-s" id="toggle"' +
          (writing("toggle", s.id) ? ' disabled aria-busy="true"' : "") + ">" +
          (writing("toggle", s.id)
            ? pendingHtml()
            : S.icon(s.active ? "block" : "check_circle") +
              (s.active ? "Deaktivovať účet" : "Aktivovať účet")) + "</button>" +
      "</div>" +

      '<div class="plain">' +
        '<div class="ph"><span class="pd">Posledné pohyby</span>' +
          '<span class="pd">Účet od ' + S.esc(s.created) + "</span></div>" +
        (rows.length === 0
          ? '<p class="pempty"><b>Zatiaľ žiadne pohyby</b>' +
            "Po prvom dobití alebo objednávke sa tu objaví záznam.</p>"
          : rows.map(ledRow).join("")) +
      "</div>";
  }

  /* ---------- painting ----------
     One full write at startup, then three narrow ones. Rewriting the whole
     page on every keystroke would take the caret out of the field being
     typed into, so the search box and the amount field are never replaced
     while they are in use. */

  function render() {
    root.innerHTML =
      S.pageHead("Žiaci", subtitle(),
        '<button class="btn" type="button" id="new">' +
          S.icon("person_add") + "Nový žiak</button>") +

      '<div class="split main-aside">' +
        '<div class="stack" id="left">' +
          '<div class="search">' + S.icon("search") +
            '<input id="q" type="text" autocomplete="off" aria-label="Hľadať žiaka"' +
              ' placeholder="Hľadajte meno, e-mail alebo triedu" value="' + S.esc(q) + '">' +
          "</div>" +
          listHtml() +
        "</div>" +

        '<aside class="aside sticky stack l" id="aside">' + asideHtml() + "</aside>" +
      "</div>";

    sub = S.$("h1 + p", root); // pageHead gives the subtitle no id of its own
    bindPage();
    bindList();
    bindAside();
  }

  function paintHead() {
    if (sub) sub.textContent = subtitle();
  }

  /* Only the rows are rewritten; the search field above them keeps focus. */
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

  /* ---------- binding ---------- */

  function bindPage() {
    S.$("#new", root).addEventListener("click", startCreate);

    S.$("#q", root).addEventListener("input", function (e) {
      q = e.target.value;
      paintList();

      /* The result count is announced once the typing settles — a message per
         keystroke would talk over the letters being typed. */
      window.clearTimeout(announceTimer);
      announceTimer = window.setTimeout(function () {
        var n = matches().length;
        S.announce(S.$("#live"), n === 0
          ? "Nenašiel sa žiadny žiak."
          : n + " " + (n === 1 ? "nájdený žiak" : n < 5 ? "nájdení žiaci" : "nájdených žiakov") + ".");
      }, 500);
    });
  }

  function bindList() {
    S.$$("#left .urow", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        select(btn.getAttribute("data-id"));
      });
    });
  }

  function bindAside() {
    if (creating) { bindCreate(); return; }
    if (!selected()) return;

    S.$$("#aside .qamt", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        amount = btn.getAttribute("data-amt");
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

  function bindCreate() {
    var nameEl = S.$("#n", root);
    var triedaEl = S.$("#tr", root);
    var emailEl = S.$("#em", root);

    S.$("#close", root).addEventListener("click", closeCreate);

    nameEl.addEventListener("input", function (e) {
      newName = e.target.value;
      /* The school issues the address from the name — until someone types
         their own, and from then on it is theirs. */
      if (!emailEdited) {
        newEmail = S.schoolEmail(newName);
        emailEl.value = newEmail;
      }
      syncCreate();
    });

    triedaEl.addEventListener("input", function (e) {
      newTrieda = e.target.value;
      syncCreate();
    });

    emailEl.addEventListener("input", function (e) {
      newEmail = e.target.value;
      emailEdited = true;
    });

    S.$("#create", root).addEventListener("submit", function (e) {
      e.preventDefault();
      createStudent();
    });
  }

  /* The staged amount drives three things. Redrawing the panel to update them
     would pull the caret out of the field, so they are set in place. */
  function syncAmount() {
    var amt = S.$("#amt", root);
    if (amt && amt.value !== amount) amt.value = amount;

    S.$$("#aside .qamt", root).forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.getAttribute("data-amt") === amount));
    });

    /* The button belongs to the write in flight; typing must not hand it
       back before the server has answered. */
    var btn = S.$("#credit", root);
    if (!btn || writing("credit", selId)) return;

    var ok = validAmount();
    btn.disabled = !ok;
    btn.innerHTML = S.icon("add_card") + "Pripísať" +
      (ok ? '<span class="qty">' + S.eur(parsed()) + "</span>" : "");
  }

  function syncCreate() {
    if (writing("create")) return; // the submit button is waiting on the server
    var make = S.$("#make", root);
    if (make) make.disabled = !(newName.trim() && newTrieda.trim());
  }

  /* ---------- actions ---------- */

  /* THE FIX: a staged amount belongs to the student it was typed for. Moving
     to another account clears it, and the status line with it, so 100 € armed
     for one account can never be pressed onto the next one. */
  function select(id) {
    /* A write in flight belongs to the account it was started on. Letting the
       panel move to another name underneath it is exactly the bug this file
       opens with, so the list is inert for the moment the write takes. */
    if (busy) return;

    selId = id;
    creating = false;
    amount = "";
    note = "";
    noteOk = true;

    paintList();
    paintAside();

    /* paintList() replaced the row that was just clicked; put the keyboard
       back on its successor. */
    S.$$("#left .urow", root).forEach(function (btn) {
      if (btn.getAttribute("data-id") === id) btn.focus();
    });
  }

  function credit() {
    if (busy) return; // a write is already on its way; a second press is not a second charge
    var s = selected();
    if (!s || !validAmount()) return;
    /* A deactivated account cannot order lunch, so putting money on it just
       strands the money. Refuse, and say so. The server refuses it too — this
       only saves the round trip. */
    if (!s.active) {
      note = "Účet je neaktívny — najprv ho aktivujte, potom pripíšte kredit.";
      noteOk = false;
      paintAside();
      var refused = S.$("#credit", root);
      if (refused) refused.focus();
      S.announce(S.$("#live"), note);
      return;
    }

    var value = parsed();
    var id = s.id;

    busy = "credit";
    busyId = id;
    pending(S.$("#credit", root));

    S.api.creditStudent(id, value).then(function (resp) {
      busy = "";
      busyId = "";

      /* The money is the server's arithmetic, not ours: the balance and the
         ledger row — amount, label, timestamp, who did it — are copied out of
         the response exactly as they came. */
      var rec = applyStudent(resp && resp.student) || s;
      if (resp && resp.entry) ledger.unshift(resp.entry);
      var charged = resp && resp.entry && typeof resp.entry.amount === "number"
        ? resp.entry.amount : value;

      /* Emptying the field disarms the button, so the same sum cannot be
         credited twice by a second click. */
      amount = "";
      note = "Pripísané " + S.eur(charged) + " žiakovi " + rec.name + ".";
      noteOk = true;

      paintHead();
      paintList();
      paintAside();

      var amt = S.$("#amt", root);
      if (amt) amt.focus(); // the button it was pressed on is disabled now
      S.announce(S.$("#live"), note + " Nový zostatok " + S.eur(rec.balance) + ".");
    }, function (err) {
      /* No balance moved, no ledger row was written, and the typed amount is
         still in the field to try again with. */
      fail(err, "#credit");
    });
  }

  function toggleActive() {
    if (busy) return;
    var s = selected();
    if (!s) return;

    var next = !s.active;

    busy = "toggle";
    busyId = s.id;
    pending(S.$("#toggle", root));

    S.api.setStudentActive(s.id, next).then(function (resp) {
      busy = "";
      busyId = "";

      /* The flag the list and the chip draw is the one that came back, never
         the one that was asked for. */
      var rec = applyStudent(resp && resp.student) || s;

      /* A standing refusal was about the account as it was a moment ago — it
         must not outlive the change. A green confirmation stands. */
      if (!noteOk) { note = ""; noteOk = true; }

      paintHead();
      paintList();
      paintAside();

      var btn = S.$("#toggle", root);
      if (btn) btn.focus(); // paintAside() replaced the button under us
      S.announce(S.$("#live"), "Účet žiaka " + rec.name +
        (rec.active ? " je aktívny." : " je neaktívny."));
    }, function (err) {
      /* The account is still whatever it was before the click. */
      fail(err, "#toggle");
    });
  }

  function startCreate() {
    if (busy) return;
    creating = true;
    newName = "";
    newTrieda = "";
    newEmail = "";
    emailEdited = false;
    amount = ""; // nothing stays armed behind a panel that is no longer shown
    note = "";
    noteOk = true;

    paintAside();
    S.$("#n", root).focus();
  }

  function closeCreate() {
    if (busy) return;
    creating = false;
    paintAside();
    S.$("#new", root).focus(); // back to the control that opened the form
  }

  function createStudent() {
    if (busy) return;

    var nm = newName.trim();
    var tr = newTrieda.trim();
    if (!nm || !tr) return;

    var addr = newEmail.trim() || S.schoolEmail(nm);

    /* The school address is the account's identity. Two accounts sharing one
       means whichever is found first gets the credit. The server checks this
       against every account, not just the ones on this screen — the check
       here only saves the round trip. */
    var wanted = addr.toLowerCase();
    var clash = students.filter(function (x) { return x.email.toLowerCase() === wanted; })[0];
    if (clash) {
      note = "Účet s adresou " + wanted + " už existuje (" + clash.name + ").";
      noteOk = false;
      paintAside();
      var dup = S.$("#em", root);
      if (dup) dup.focus(); // the field that has to change is the address
      S.announce(S.$("#live"), note);
      return;
    }

    busy = "create";
    busyId = "";
    pending(S.$("#make", root));

    S.api.createStudent({ name: nm, email: addr, trieda: tr }).then(function (resp) {
      var fresh = resp && resp.student;
      /* No account in the response means no account was created: say so
         rather than putting a row in the list the server knows nothing of. */
      if (!fresh || !fresh.id) { fail(null, "#make"); return; }

      busy = "";
      busyId = "";

      /* The id, the address and the opening balance are the server's. */
      students.unshift(Object.assign({}, fresh));
      selId = fresh.id;
      creating = false;
      amount = "";
      note = "Účet pre " + fresh.name + " je vytvorený. Kredit je zatiaľ nulový.";
      noteOk = true;

      paintHead();
      paintList();
      paintAside();

      var amt = S.$("#amt", root);
      if (amt) amt.focus(); // a new account starts empty; dobiť is next
      S.announce(S.$("#live"), note);
    }, function (err) {
      /* The form stays open with everything still typed into it. */
      fail(err, "#make");
    });
  }

  render();
});
