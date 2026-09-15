/* Správa menu — build the day's list of dishes.

   The screen this replaces had a pencil icon that did nothing: you could add a
   placeholder row and delete rows, but never set a dish's name, description,
   category or allergens. This one edits for real.

   One dish is edited at a time, in place, so the list never turns into a wall
   of inputs. Editing is local until Publikovať: nothing reaches the server
   until the whole day is sent in one PUT, which is also how the read side
   works — a day is a list, not a pile of rows.

   PUBLIKOVAŤ HAS NO ENDPOINT ON THIS BACKEND. Nothing on the server creates or
   edits a Meal, a SchoolDay or a MealOnDay: /menu/today and /menu/week can only
   read what something else wrote. The screen stays, because a canteen that
   cannot publish a menu has no product — in mock mode it works end to end, and
   against a live server the 404 comes back as a plain Slovak sentence rather
   than a raw error. Written up in html/API-GAPS.md (§2).

   CATEGORIES ARE SLOVAK LABELS. The server stores an enum and answers with its
   label already translated — "Mäsité", "Hydina", "Vegetariánske", "Ryba",
   "Polievka a múčnik" — so those five are what the picker offers and what a
   dish carries here. A dish that arrives with anything else keeps it rather
   than being quietly relabelled by the act of opening the editor.

   Capacity is part of a dish here because it belongs to the dish ON THIS DAY,
   not to the dish itself: the same halušky can be capped at 40 on Monday and
   uncapped on Friday. Zero means unlimited. */
var page = function (S, root) {
  "use strict";

  var DATE = (S.__menu && S.__menu.day && S.__menu.day.key) || "";
  var DATE_LABEL = (S.__menu && S.__menu.day && S.__menu.day.label) || DATE;

  /* The working copy. Publikovať sends this; nothing else does. */
  var rows = ((S.__menu && S.__menu.meals) || []).map(function (m) {
    return {
      mealOnDayId: m.mealOnDayId,
      name: m.name || "",
      desc: m.desc || "",
      category: m.category || DEFAULT_CATEGORY,
      allergens: (m.allergens || []).slice(),
      capacity: Number(m.capacity) || 0,
      orderCount: Number(m.orderCount) || 0
    };
  });

  var editing = null;  // index of the row open in the editor, or null
  var draft = null;    // the row being edited, before it is accepted
  var dirty = false;   // something changed since the last publish
  var busy = false;
  var note = null;     // { ok, text }

  /* EU Annex II. Slovak canteens are legally required to print these numbers,
     so they are offered as checkboxes rather than typed as free text. */
  var ALLERGENS = [
    { n: "1", label: "lepok" },      { n: "2", label: "kôrovce" },
    { n: "3", label: "vajcia" },     { n: "4", label: "ryby" },
    { n: "5", label: "arašidy" },    { n: "6", label: "sója" },
    { n: "7", label: "mlieko" },     { n: "8", label: "orechy" },
    { n: "9", label: "zeler" },      { n: "10", label: "horčica" },
    { n: "11", label: "sezam" },     { n: "12", label: "siričitany" },
    { n: "13", label: "vlčí bôb" },  { n: "14", label: "mäkkýše" }
  ];

  /* The labels the server can actually store, in menu order, straight from the
     data layer so there is one list of them in the app. */
  var CATEGORIES = (S.CATEGORY_LABELS || []).slice();
  var DEFAULT_CATEGORY = CATEGORIES[0] || "Mäsité";

  /* The five, plus whatever this dish already has if it is none of them: a
     category we do not recognise is still the kitchen's, and the editor must
     not change it just by being opened. */
  function categoryChoices(current) {
    var out = CATEGORIES.slice();
    if (current && out.indexOf(current) === -1) out.push(current);
    return out;
  }

  function blankRow() {
    return {
      mealOnDayId: null, name: "", desc: "", category: DEFAULT_CATEGORY,
      allergens: [], capacity: 0, orderCount: 0
    };
  }

  function valid(r) { return !!(r && r.name.trim()); }

  /* ------------------------------------------------------------ the list */

  function rowHtml(r, i) {
    var cat = S.category(r.category);
    var tags = r.allergens.map(function (a) {
      return '<span class="tag' + (a === "veg" ? " veg" : "") + '">' +
        S.esc(S.allergenLabel(a)) + "</span>";
    }).join("");

    return '<div class="erow">' +
      '<span class="en">' + (i + 1) + "</span>" +
      '<span class="ei">' +
        '<span class="et">' + S.esc(r.name || "Bez názvu") + "</span>" +
        '<span class="ed">' + S.esc(cat.label) +
          (r.desc ? " · " + S.esc(r.desc) : "") +
          (r.capacity > 0 ? " · limit " + S.esc(r.capacity) : " · bez limitu") +
          (r.orderCount > 0 ? " · objednané " + S.esc(r.orderCount) : "") +
        "</span>" +
        (tags ? '<span class="eg">' + tags + "</span>" : "") +
      "</span>" +
      '<span class="ea">' +
        '<button class="mini" type="button" data-edit="' + i + '"' +
          ' aria-label="Upraviť ' + S.esc(r.name || "jedlo") + '">' + S.icon("edit") + "</button>" +
        '<button class="mini del" type="button" data-del="' + i + '"' +
          ' aria-label="Odstrániť ' + S.esc(r.name || "jedlo") + '">' + S.icon("delete") + "</button>" +
      "</span></div>";
  }

  /* ---------------------------------------------------------- the editor */

  function editorHtml() {
    var d = draft;
    var isNew = editing === rows.length;

    return '<form class="plain" id="editor" style="display:flex;flex-direction:column;gap:16px">' +
      '<div class="ph"><span class="pd">' +
        (isNew ? "Nové jedlo" : "Úprava jedla") + "</span>" +
        '<button class="sq" type="button" id="cancel" aria-label="Zavrieť bez uloženia">' +
          S.icon("close") + "</button></div>" +

      '<div><label class="flabel" for="f-name">Názov jedla</label>' +
        '<input class="finput" id="f-name" value="' + S.esc(d.name) + '"' +
        ' placeholder="Napríklad Bryndzové halušky so slaninou" autocomplete="off"></div>' +

      '<div><label class="flabel" for="f-desc">Popis a príloha</label>' +
        '<input class="finput" id="f-desc" value="' + S.esc(d.desc) + '"' +
        ' placeholder="Zemiakové cesto, ovčia bryndza, opražená slanina" autocomplete="off"></div>' +

      '<div><span class="flabel" id="f-cat-label">Kategória</span>' +
        /* The same wrapping row the allergens use: "Polievka a múčnik" does not
           fit a third of the sidebar, and a grid would either clip it or set
           every button to the width of the longest one. */
        '<div class="alg" role="group" aria-labelledby="f-cat-label">' +
          categoryChoices(d.category).map(function (c) {
            return '<button class="qamt" type="button" data-cat="' + S.esc(c) + '"' +
              ' aria-pressed="' + (d.category === c) + '">' +
              S.esc(S.category(c).label) + "</button>";
          }).join("") +
        "</div></div>" +

      '<div><span class="flabel" id="f-alg-label">Alergény podľa prílohy II</span>' +
        '<div class="alg" role="group" aria-labelledby="f-alg-label">' +
          '<button class="qamt" type="button" data-alg="veg" aria-pressed="' +
            (d.allergens.indexOf("veg") !== -1) + '">Vegetariánske</button>' +
          ALLERGENS.map(function (a) {
            return '<button class="qamt" type="button" data-alg="' + a.n + '"' +
              ' aria-pressed="' + (d.allergens.indexOf(a.n) !== -1) + '">' +
              a.n + " " + S.esc(a.label) + "</button>";
          }).join("") +
        "</div></div>" +

      '<div><label class="flabel" for="f-cap">Limit porcií</label>' +
        '<input class="finput" id="f-cap" inputmode="numeric" value="' +
        S.esc(d.capacity || "") + '" placeholder="0 = bez limitu" autocomplete="off">' +
        '<p class="note" style="padding:8px 0 0">Keď sa limit naplní, jedlo sa ' +
          "žiakom ukáže ako vypredané.</p></div>" +

      '<button class="btn block" type="submit" id="accept"' +
        (valid(d) ? "" : " disabled") + ">" + S.icon("check") +
        (isNew ? "Pridať do menu" : "Uložiť zmeny") + "</button>" +
      "</form>";
  }

  /* ---------------------------------------------------------------- page */

  function sidebarHtml() {
    if (editing !== null) return editorHtml();

    var n = rows.length;
    return '<div class="stack l">' +
      '<div class="datecard">' +
        '<span class="dx"><span class="dxa">' + S.esc(DATE_LABEL) + "</span>" +
        '<span class="dxb">' + (dirty ? "Neuložené zmeny" : "Uložené") + "</span></span>" +
      "</div>" +

      '<button class="btn block" type="button" id="publish"' +
        (busy || !n ? " disabled" : "") + (busy ? ' aria-busy="true"' : "") + ">" +
        S.icon(busy ? "progress_activity" : "publish") +
        (busy ? "Ukladá sa…" : "Publikovať menu") +
        '<span class="qty">' + n + " " + S.plural(n) + "</span></button>" +

      (note
        ? '<p class="note' + (note.ok ? "" : " warn") + '" role="' +
          (note.ok ? "status" : "alert") + '">' + S.esc(note.text) + "</p>"
        : '<p class="note">Žiaci uvidia menu hneď po publikovaní. Objednávanie ' +
          "otvára a zatvára server.</p>") +
      "</div>";
  }

  function render(focusSel) {
    root.innerHTML =
      S.pageHead("Správa menu", DATE_LABEL) +
      '<div class="split main-aside-slim">' +
        '<div class="stack">' +
          (rows.length
            ? rows.map(rowHtml).join("")
            : '<div class="empty">' + S.icon("restaurant") +
              "<b>Na tento deň nie je nič v menu</b>" +
              '<p class="boot-msg">Pridajte prvé jedlo a publikujte deň.</p></div>') +
          '<button class="addrow" type="button" id="add">' + S.icon("add") +
            "Pridať jedlo</button>" +
        "</div>" +
        '<aside class="aside sticky">' + sidebarHtml() + "</aside>" +
      "</div>";

    bind();
    if (focusSel) {
      var el = S.$(focusSel, root);
      if (el) el.focus();
    }
  }

  /* --------------------------------------------------------------- binds */

  function openEditor(i) {
    editing = i;
    draft = i === rows.length ? blankRow() : JSON.parse(JSON.stringify(rows[i]));
    note = null;
    render("#f-name");
  }

  function closeEditor(focusSel) {
    editing = null;
    draft = null;
    render(focusSel || "#add");
  }

  function bind() {
    var add = S.$("#add", root);
    if (add) add.addEventListener("click", function () { openEditor(rows.length); });

    S.$$("[data-edit]", root).forEach(function (b) {
      b.addEventListener("click", function () { openEditor(Number(b.getAttribute("data-edit"))); });
    });

    S.$$("[data-del]", root).forEach(function (b) {
      b.addEventListener("click", function () {
        var i = Number(b.getAttribute("data-del"));
        rows.splice(i, 1);
        dirty = true;
        if (editing !== null) { editing = null; draft = null; }
        /* Focus the row that slid into this one's place, or the add button. */
        render(rows.length ? '[data-del="' + Math.min(i, rows.length - 1) + '"]' : "#add");
      });
    });

    var pub = S.$("#publish", root);
    if (pub) pub.addEventListener("click", publish);

    if (editing === null) return;

    var name = S.$("#f-name", root);
    var desc = S.$("#f-desc", root);
    var cap = S.$("#f-cap", root);

    function sync() {
      draft.name = name.value;
      draft.desc = desc.value;
      /* Digits only; anything else means no limit rather than NaN. */
      draft.capacity = Math.max(0, parseInt(String(cap.value).replace(/\D/g, ""), 10) || 0);
      var ok = S.$("#accept", root);
      if (ok) ok.disabled = !valid(draft);
    }
    name.addEventListener("input", sync);
    desc.addEventListener("input", sync);
    cap.addEventListener("input", sync);

    S.$$("[data-cat]", root).forEach(function (b) {
      b.addEventListener("click", function () {
        sync();
        draft.category = b.getAttribute("data-cat");
        render('[data-cat="' + draft.category + '"]');
      });
    });

    S.$$("[data-alg]", root).forEach(function (b) {
      b.addEventListener("click", function () {
        sync();
        var a = b.getAttribute("data-alg");
        var at = draft.allergens.indexOf(a);
        if (at === -1) draft.allergens.push(a); else draft.allergens.splice(at, 1);
        render('[data-alg="' + a + '"]');
      });
    });

    S.$("#cancel", root).addEventListener("click", function () { closeEditor(); });

    S.$("#editor", root).addEventListener("submit", function (ev) {
      ev.preventDefault();
      sync();
      if (!valid(draft)) return;
      draft.name = draft.name.trim();
      draft.desc = draft.desc.trim();
      if (editing === rows.length) rows.push(draft); else rows[editing] = draft;
      dirty = true;
      closeEditor('[data-edit="' + (editing === null ? 0 : Math.min(editing, rows.length - 1)) + '"]');
    });
  }

  /* ------------------------------------------------------------- publish */

  function publish() {
    if (busy || !rows.length) return;
    busy = true;
    note = null;
    render("#publish");

    /* THIS ROUTE DOES NOT EXIST ON THIS BACKEND — there is no PUT /menu/:date.
       In mock mode the day is re-seated and this page behaves exactly as it
       will the day the route ships. Against a live server the 404 comes back
       through the API layer as a plain Slovak sentence, which lands in the
       note below the button like any other refusal, and nothing here pretends
       the menu was saved. See html/API-GAPS.md (§2). */
    S.api.saveMenu(DATE, rows.map(function (r) {
      return {
        mealOnDayId: r.mealOnDayId,
        name: r.name, desc: r.desc, category: r.category,
        allergens: r.allergens, capacity: r.capacity
      };
    })).then(
      function (resp) {
        busy = false;
        dirty = false;
        /* Take the server's list back, so ids and slots are its own. */
        if (resp && resp.meals) {
          rows = resp.meals.map(function (m) {
            return {
              mealOnDayId: m.mealOnDayId, name: m.name || "", desc: m.desc || "",
              category: m.category || DEFAULT_CATEGORY,
              allergens: (m.allergens || []).slice(),
              capacity: Number(m.capacity) || 0, orderCount: Number(m.orderCount) || 0
            };
          });
        }
        note = { ok: true, text: "Menu je publikované — " + rows.length + " " + S.plural(rows.length) + "." };
        render("#publish");
        S.announce(S.$("#live"), note.text);
      },
      function (err) {
        busy = false;
        note = { ok: false, text: (err && err.message) || "Publikovanie zlyhalo." };
        render("#publish");
      }
    );
  }

  render();
};

page.load = function (S) {
  return S.api.menuToday().then(function (data) { S.__menu = data || {}; });
};

SKYRO.page(page);
