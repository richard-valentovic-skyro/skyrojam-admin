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
   explicit click, and the amount is cleared in the same breath — so a second
   press of an already-spent sum does nothing.

   The clock is read only inside credit(), which cannot run before the first
   paint, so no stale timestamp is ever shipped in the markup. */
(function (S) {
  "use strict";

  var QUICK = [10, 20, 50, 100];
  var ADMIN_NAME = "Katarína Vrábľová";

  /* Working copies: this page edits accounts and writes ledger rows, the
     fixtures stay clean. */
  var students = S.STUDENTS.map(function (s) { return Object.assign({}, s); });
  var ledger = S.LEDGER.slice();

  var q = "";                       // search text
  var selId = students[0].id;       // the account on the right
  var creating = false;             // the sidebar shows the new-account form
  var amount = "";                  // staged top-up, exactly as typed ("12,50")
  var note = "";                    // status line under the top-up button

  /* the new-account form */
  var newName = "";
  var newTrieda = "";
  var newEmail = "";
  var emailEdited = false;          // once true, the name stops filling the address

  var root = S.mount();
  var sub = null;                   // the page-head subtitle, re-read when counts move
  var announceTimer = null;

  function pad2(v) { return v < 10 ? "0" + v : "" + v; }

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

  function stamp() {
    var d = new Date();
    return "dnes " + d.getHours() + ":" + pad2(d.getMinutes());
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
  function parsed() { return Number(amount.replace(",", ".")); }
  function validAmount() { var v = parsed(); return isFinite(v) && v > 0; }

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

        '<button class="btn block" type="submit" id="make"' + (ready ? "" : " disabled") + ">" +
          S.icon("person_add") + "Vytvoriť účet</button>" +
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
          ? '<p class="note mt-s" style="color:var(--c-green);font-weight:600">' +
            S.esc(note) + "</p>"
          : "") +

        '<button type="button" class="btn soft block mt-s" id="toggle">' +
          S.icon(s.active ? "block" : "check_circle") +
          (s.active ? "Deaktivovať účet" : "Aktivovať účet") + "</button>" +
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

    var ok = validAmount();
    var btn = S.$("#credit", root);
    btn.disabled = !ok;
    btn.innerHTML = S.icon("add_card") + "Pripísať" +
      (ok ? '<span class="qty">' + S.eur(parsed()) + "</span>" : "");
  }

  function syncCreate() {
    var make = S.$("#make", root);
    if (make) make.disabled = !(newName.trim() && newTrieda.trim());
  }

  /* ---------- actions ---------- */

  /* THE FIX: a staged amount belongs to the student it was typed for. Moving
     to another account clears it, and the status line with it, so 100 € armed
     for one account can never be pressed onto the next one. */
  function select(id) {
    selId = id;
    creating = false;
    amount = "";
    note = "";

    paintList();
    paintAside();

    /* paintList() replaced the row that was just clicked; put the keyboard
       back on its successor. */
    S.$$("#left .urow", root).forEach(function (btn) {
      if (btn.getAttribute("data-id") === id) btn.focus();
    });
  }

  function credit() {
    var s = selected();
    if (!s || !validAmount()) return;

    var value = parsed();
    s.balance = Number((s.balance + value).toFixed(2));
    ledger.unshift({
      id: "l" + Date.now(),
      studentId: s.id,
      amount: value,
      label: "Dobitie kreditu",
      at: stamp(),
      by: ADMIN_NAME,
    });

    /* Emptying the field disarms the button, so the same sum cannot be
       credited twice by a second click. */
    amount = "";
    note = "Pripísané " + S.eur(value) + " žiakovi " + s.name + ".";

    paintHead();
    paintList();
    paintAside();

    S.$("#amt", root).focus(); // the button it was pressed on is disabled now
    S.announce(S.$("#live"), note + " Nový zostatok " + S.eur(s.balance) + ".");
  }

  function toggleActive() {
    var s = selected();
    if (!s) return;

    s.active = !s.active;

    paintHead();
    paintList();
    paintAside();

    S.$("#toggle", root).focus(); // paintAside() replaced the button under us
    S.announce(S.$("#live"), "Účet žiaka " + s.name +
      (s.active ? " je aktívny." : " je neaktívny."));
  }

  function startCreate() {
    creating = true;
    newName = "";
    newTrieda = "";
    newEmail = "";
    emailEdited = false;
    amount = ""; // nothing stays armed behind a panel that is no longer shown
    note = "";

    paintAside();
    S.$("#n", root).focus();
  }

  function closeCreate() {
    creating = false;
    paintAside();
    S.$("#new", root).focus(); // back to the control that opened the form
  }

  function createStudent() {
    var nm = newName.trim();
    var tr = newTrieda.trim();
    if (!nm || !tr) return;

    var fresh = {
      id: "s" + Date.now(),
      name: nm,
      email: newEmail.trim() || S.schoolEmail(nm),
      trieda: tr,
      balance: 0,
      active: true,
      created: "dnes",
    };

    students.unshift(fresh);
    selId = fresh.id;
    creating = false;
    amount = "";
    note = "Účet pre " + nm + " je vytvorený. Kredit je zatiaľ nulový.";

    paintHead();
    paintList();
    paintAside();

    S.$("#amt", root).focus(); // a new account starts empty; dobiť is next
    S.announce(S.$("#live"), note);
  }

  render();
})(window.SKYRO);
