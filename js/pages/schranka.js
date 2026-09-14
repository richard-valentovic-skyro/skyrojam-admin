/* The canteen manager's inbox: every student thread on the left, the open
   conversation on the right.

   THREAD is written from the student's chair, so this page reads it from the
   other one: `from === "them"` is Katarína, and those are the violet
   right-hand bubbles here. The student's own lines, `from === "me"`, become
   the white bubbles on the left. Flipping one constant is the whole
   difference between the two apps.

   Three things the React build got wrong:

   The thread was keyed on the conversation name, so switching to another
   student and back unmounted it and threw away everything just typed — a
   reply written, abandoned by one click, gone. Sent messages are kept here in
   `sent`, one list per conversation, and the fixture stays untouched.

   The selected row was marked with a `.sel` class and nothing else, which is
   invisible to anyone not looking at the screen. The rows are buttons, so
   they carry aria-pressed and the CSS hangs off the class as before.

   And the unread badge was a bare number in a button — "2" with nothing
   saying two of what.

   No clock is read during the first paint: the only `new Date()` is inside
   send(), which cannot run before the page is up. */
(function (S) {
  "use strict";

  /* A working copy: marking the inbox read clears `u` here, the fixture keeps
     its numbers for the next load. */
  var convs = S.CONVS.map(function (c) {
    return { n: c.n, p: c.p, t: c.t, u: c.u };
  });

  var q = "";
  var sel = 0;
  var sent = {}; // conversation index -> messages sent from this chair
  var announceTimer = null;

  var root = S.mount();

  function pad2(v) { return v < 10 ? "0" + v : "" + v; }

  /* Slovak counts in three shapes, and the adjective moves with the noun:
     1 neprečítaná správa, 2–4 neprečítané správy, 5+ neprečítaných správ. */
  function unreadLabel(n) {
    if (n === 1) return n + " neprečítaná správa";
    if (n < 5) return n + " neprečítané správy";
    return n + " neprečítaných správ";
  }

  function unreadThreads() {
    return convs.filter(function (c) { return c.u > 0; }).length;
  }

  /* The filter keeps the original index with each row: `sel` always points
     into `convs`, never into the filtered view, so narrowing the search can
     never silently open a different thread. */
  function matches() {
    var needle = q.trim().toLowerCase();
    return convs.map(function (c, i) { return { c: c, i: i }; })
      .filter(function (row) {
        if (!needle) return true;
        return row.c.n.toLowerCase().indexOf(needle) !== -1 ||
          row.c.p.toLowerCase().indexOf(needle) !== -1;
      });
  }

  function convRow(row) {
    var c = row.c;

    return '<button type="button" class="conv' + (c.u ? " un" : "") +
      (row.i === sel ? " sel" : "") + '" data-i="' + row.i + '"' +
      ' aria-pressed="' + (row.i === sel) + '">' +
      '<span class="av">' + S.esc(S.initials(c.n)) + "</span>" +
      '<span class="ci">' +
        '<span class="cn">' + S.esc(c.n) +
          '<span class="ct">' + S.esc(c.t) + "</span></span>" +
        '<span class="cp">' + S.esc(c.p) + "</span>" +
      "</span>" +
      /* The badge is read as part of the button's name, so the count says
         what it counts without adding anything to the screen. */
      (c.u ? '<span class="ub" aria-label="' + S.esc(unreadLabel(c.u)) + '">' +
        S.esc(c.u) + "</span>" : "") +
      "</button>";
  }

  function listHtml() {
    var rows = matches();
    if (rows.length === 0) {
      return '<div class="empty">' + S.icon("search_off") +
        "Nič sa nenašlo.<br>Skúste iné meno alebo časť správy.</div>";
    }
    return rows.map(convRow).join("");
  }

  function entry(it) {
    if (it.kind === "day") return '<div class="dm">' + S.esc(it.label) + "</div>";

    /* Inverted: Katarína is "them" in the fixture and "me" on this screen. */
    return '<div class="msg ' + (it.from === "them" ? "me" : "them") + '">' +
      S.esc(it.text) +
      '<span class="mt">' + S.esc(it.at) + "</span></div>";
  }

  function threadItems() {
    return S.THREAD.concat(sent[sel] || []);
  }

  function detailHtml() {
    var active = convs[sel];

    return '<div class="ph"><span class="pd">' + S.esc(active.n) + "</span>" +
      '<span class="pd">Žiak</span></div>' +

      '<div style="display:flex;flex-direction:column;min-height:calc(100vh - 240px)">' +
        '<div class="thread grow" id="thread">' + threadItems().map(entry).join("") + "</div>" +

        /* The composer floats over the thread, so it keeps its glass. */
        '<div class="row glass mt-m" style="position:sticky;bottom:0;margin-inline:-8px;' +
          'padding:12px 8px;border-radius:999px">' +
          '<input class="chatinput" id="draft" type="text" autocomplete="off"' +
            ' placeholder="Napíšte správu" aria-label="Napíšte správu">' +
          '<button class="send" type="button" id="send" aria-label="Odoslať">' +
            S.icon("arrow_upward") + "</button>" +
        "</div>" +
      "</div>";
  }

  function render() {
    root.innerHTML =
      S.pageHead("Schránka", unreadThreads() + " neprečítaných vlákien",
        S.iconBtn("mark_email_read", "Označiť všetko prečítané")) +

      /* The phone's inbox and chat, side by side. */
      '<div class="split list-detail">' +
        '<div class="stack">' +
          '<div class="search">' + S.icon("search") +
            '<input id="q" type="text" autocomplete="off"' +
              ' placeholder="Hľadajte meno alebo správu" aria-label="Hľadať v schránke"' +
              ' value="' + S.esc(q) + '">' +
          "</div>" +
          '<div class="stack" id="convlist">' + listHtml() + "</div>" +
        "</div>" +

        '<div class="plain" id="detail">' + detailHtml() + "</div>" +
      "</div>";

    bind();
  }

  /* Typing must not disturb the field it is typed into, so the search only
     rewrites the rows below it. Same for the thread: sending a message leaves
     the inbox alone. */
  function renderList() {
    var host = S.$("#convlist", root);
    if (!host) return;
    host.innerHTML = listHtml();
    bindList();
  }

  function renderDetail() {
    var host = S.$("#detail", root);
    if (!host) return;
    host.innerHTML = detailHtml();
    bindDetail();
  }

  function bindList() {
    S.$$("#convlist .conv", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var i = Number(btn.getAttribute("data-i"));
        if (i === sel) return;
        sel = i;
        renderList();
        renderDetail();

        /* renderList() replaced the clicked button; put the focus back on the
           row that now stands in for it. */
        var again = S.$('#convlist .conv[data-i="' + sel + '"]', root);
        if (again) again.focus();

        S.announce(S.$("#live"), "Otvorené vlákno: " + convs[sel].n + ".");
      });
    });
  }

  function bindDetail() {
    var input = S.$("#draft", root);
    var sendBtn = S.$("#send", root);
    if (!input || !sendBtn) return;

    function send() {
      var text = input.value.trim();
      if (!text) { input.focus(); return; }

      var now = new Date();
      if (!sent[sel]) sent[sel] = [];
      sent[sel].push({
        kind: "msg",
        from: "them", // "them" is Katarína in the fixture, which is us here
        text: text,
        at: now.getHours() + ":" + pad2(now.getMinutes()),
      });

      renderDetail();
      S.$("#draft", root).focus(); // renderDetail() replaced the input under us
      scrollToEnd();
      S.announce(S.$("#live"), "Správa odoslaná.");
    }

    sendBtn.addEventListener("click", send);

    input.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      e.preventDefault(); // no form here, but stop any implicit submit
      send();
    });
  }

  function bind() {
    var search = S.$("#q", root);
    if (search) {
      search.addEventListener("input", function () {
        q = search.value;
        renderList();

        /* The result count is announced once the typing settles — a message
           per keystroke would talk over the letters being typed. */
        window.clearTimeout(announceTimer);
        announceTimer = window.setTimeout(function () {
          var n = matches().length;
          S.announce(S.$("#live"), n === 0
            ? "Nenašlo sa žiadne vlákno."
            : n + " " + (n === 1 ? "nájdené vlákno" : n < 5 ? "nájdené vlákna" : "nájdených vlákien") + ".");
        }, 500);
      });
    }

    /* Marking the inbox read clears the badges on the rows and the count in
       the header. The rail carries the same counter, so it goes too —
       leaving a "6" beside an inbox with nothing unread would contradict the
       page it points at. */
    var readBtn = S.$(".iconbtn", root);
    if (readBtn) {
      readBtn.addEventListener("click", function () {
        if (unreadThreads() === 0) {
          S.announce(S.$("#live"), "Schránka nemá neprečítané vlákna.");
          return;
        }
        convs.forEach(function (c) { c.u = 0; });

        var badge = S.$('.rail a[href="schranka.html"] .railbadge');
        if (badge) badge.remove();

        render();
        S.$(".iconbtn", root).focus(); // render() replaced the button under the cursor
        S.announce(S.$("#live"), "Všetky vlákna sú označené ako prečítané.");
      });
    }

    bindList();
    bindDetail();
  }

  /* The composer sticks to the bottom edge and covers whatever is under it, so
     the newest bubble is only really visible at the very end of the document. */
  function scrollToEnd() {
    window.scrollTo(0, document.documentElement.scrollHeight);
  }

  render();
})(window.SKYRO);
