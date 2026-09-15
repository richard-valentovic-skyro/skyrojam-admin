/* The single door between this app and the server.

   NOTHING ELSE IN THE APP MAY FETCH. Pages call S.api.* and render what comes
   back. Every method returns a Promise and resolves with the server's own view
   of what happened — never with what we hoped would happen.

   Written against the real backend (Bun + Elysia + Prisma), endpoint by
   endpoint. Money is integer cents throughout. Ordering is by mealOnDayId.
   The server owns the ordering window — for day D it runs (D−1) 08:00 to
   (D−1) 14:00 — and answers with day.open and an ISO day.deadline, so there is
   no deadline logic in this file or anywhere else on the client.

   With CONFIG.API_BASE empty this runs in MOCK MODE against the fixtures in
   data.js, so the app works with no server at all. The fixtures are the same
   shapes, field for field, which is what makes the two interchangeable. */
window.SKYRO = window.SKYRO || {};
(function (S) {
  "use strict";

  var CONFIG = S.CONFIG || {};
  var BASE = (CONFIG.API_BASE || "").replace(/\/+$/, "");
  var MOCK = !BASE;

  /* ---------------------------------------------------------------- auth */

  var TOKEN_KEY = "skyro.token";

  function token() {
    try { return window.localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; }
  }

  function setToken(v) {
    try {
      if (v) window.localStorage.setItem(TOKEN_KEY, v);
      else window.localStorage.removeItem(TOKEN_KEY);
    } catch (e) { /* private mode — the session just will not persist */ }
  }

  /* -------------------------------------------------------------- errors */

  /* The server answers { error: CODE, message: "Slovak" }. Both are kept:
     .code so the UI can react to SOLD_OUT or INSUFFICIENT_FUNDS specifically,
     .message so it always has something honest to show. */
  function ApiError(status, code, message) {
    this.name = "ApiError";
    this.status = status;
    this.code = code || "UNKNOWN";
    this.message = message || fallbackMessage(code, status);
  }
  ApiError.prototype = Object.create(Error.prototype);

  /* Used when the server sends a code with no message, or nothing at all.
     Every code the backend can emit is here — errors.ts plus the ApiErrors
     thrown by the route modules. Slovak, because this text reaches students. */
  function fallbackMessage(code, status) {
    switch (code) {
      /* auth */
      case "BAD_CREDENTIALS":     return "Nesprávne prihlasovacie údaje.";
      case "INACTIVE":            return "Účet je deaktivovaný. Ozvite sa vedúcej jedálne.";
      case "UNAUTHORIZED":        return "Prihlásenie vypršalo. Prihláste sa znova.";
      case "FORBIDDEN":           return "Na túto akciu nemáte oprávnenie.";

      /* the thing asked for is not there */
      case "NOT_FOUND":           return "Požadovaný údaj sa nenašiel.";

      /* the order cannot change any more */
      case "DEADLINE":            return "Objednávky na tento deň sú už uzavreté.";
      case "SOLD_OUT":            return "Toto jedlo je už vypredané.";
      case "SERVED":              return "Obed bol vydaný, nemožno ho zmeniť.";
      case "CANCELLED":           return "Objednávka je zrušená.";
      case "INSUFFICIENT_FUNDS":  return "Na účte nie je dosť kreditu.";

      /* the request itself was wrong */
      case "BAD_REQUEST":         return "Požiadavku sa nepodarilo spracovať.";
      case "VALIDATION":          return "Zadané údaje nie sú platné.";
      case "PARSE":               return "Zlá požiadavka.";

      /* the server fell over */
      case "INTERNAL":            return "Server má problém. Skúste to o chvíľu.";

      /* raised in this file, never by the server */
      case "NOT_IMPLEMENTED":     return "Server túto funkciu zatiaľ nepodporuje.";
      case "BAD_RESPONSE":        return "Server odpovedal neplatnými údajmi. Skúste to znova.";
      case "NETWORK":             return "Nepodarilo sa spojiť so serverom. Skontrolujte pripojenie.";
      default: break;
    }
    if (status === 0) return "Nepodarilo sa spojiť so serverom. Skontrolujte pripojenie.";
    if (status === 429) return "Priveľa pokusov. Skúste to o chvíľu.";
    if (status >= 500) return "Server má problém. Skúste to o chvíľu.";
    return "Nastala chyba. Skúste to znova.";
  }

  /* ------------------------------------------------------------- request */

  var TIMEOUT_MS = 15000;

  function request(method, path, body) {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = ctrl && window.setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);

    var opts = {
      method: method,
      headers: { Accept: "application/json" },
      signal: ctrl ? ctrl.signal : undefined
    };
    if (token()) opts.headers.Authorization = "Bearer " + token();
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }

    /* The timer must outlive the headers. Clearing it when fetch() resolves
       only proves a status line arrived; a body that then stalls would hang
       forever, leaving every page on its spinner and an order stuck on
       "Ukladá sa…". It is cleared once, after the body is in hand. */
    function done() { if (timer) { window.clearTimeout(timer); timer = null; } }

    return window.fetch(BASE + path, opts).then(
      function (res) {
        var type = res.headers.get("content-type") || "";

        /* GET /orders?format=csv answers text/csv with a content-disposition.
           It is a download, not a document: hand the caller the raw text. An
           error, though, still comes back as JSON, so only a 2xx is CSV. */
        if (res.ok && type.indexOf("text/csv") !== -1) {
          return res.text().then(function (t) { done(); return t; }, function () {
            done();
            throw new ApiError(0, "NETWORK", fallbackMessage("NETWORK", 0));
          });
        }
        if (res.status === 204) { done(); return null; }

        return res.text().then(
          function (text) {
            done();
            var data = null;
            try { data = text ? JSON.parse(text) : null; } catch (e) { /* not JSON */ }

            if (!res.ok) {
              /* An expired token is not this call's problem to report — send the
                 user back to sign in rather than showing a stale screen. A
                 rejected login is not an expired session, so it is left alone. */
              if (res.status === 401 && path !== "/auth/login") signOutLocal();
              throw new ApiError(res.status, data && data.error, data && data.message);
            }

            /* A 200 whose body is not JSON is a broken server, not an empty
               answer. Resolving null here would render a calm empty page and
               hide the fault. */
            if (text && data === null) {
              throw new ApiError(res.status, "BAD_RESPONSE",
                fallbackMessage("BAD_RESPONSE", res.status));
            }
            return data;
          },
          function () {
            /* The body was cut off or timed out mid-stream. */
            done();
            throw new ApiError(0, "NETWORK", fallbackMessage("NETWORK", 0));
          }
        );
      },
      function () {
        done();
        throw new ApiError(0, "NETWORK", fallbackMessage("NETWORK", 0));
      }
    );
  }

  function signOutLocal() {
    setToken("");
    if (S.session && S.session.clear) S.session.clear();
  }

  /* A route this backend does not have yet. The call is still made — the day
     someone implements it, this starts working with no edit here — but a 404
     (or a 405/501 from a proxy) is turned into a sentence a canteen manager can
     act on, never a bare "Nenašlo sa". See html/API-GAPS.md. */
  function whenMissing(promise, message) {
    return promise.then(null, function (err) {
      var s = err && err.status;
      if (s === 404 || s === 405 || s === 501) {
        throw new ApiError(s, "NOT_IMPLEMENTED", message);
      }
      throw err;
    });
  }

  /* ----------------------------------------------------------- mock mode */

  function mock(value) {
    return new Promise(function (resolve) {
      window.setTimeout(function () { resolve(clone(value)); }, 0);
    });
  }

  function fail(code, status, message) {
    return Promise.reject(new ApiError(status || 400, code, message));
  }

  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }

  /* ---------------------------------------------------------------- auth */

  /* POST /auth/login -> { token, account: { id, name, username, role, classCode } }
     The account carries the trieda and NO balance; the balance arrives with
     /me and with /menu/today. */
  function login(username, password) {
    if (MOCK) {
      var u = String(username).trim().toLowerCase();
      var manager = S.MANAGERS.filter(function (m) { return m.username === u; })[0];
      if (manager) {
        return mock({
          token: "mock-manager",
          account: {
            id: manager.id, name: manager.name, username: manager.username,
            role: "MANAGER", classCode: null
          }
        });
      }

      var student = S.STUDENTS.filter(function (s) { return s.username === u; })[0];
      if (!student) return fail("BAD_CREDENTIALS", 401);
      if (!student.active) return fail("INACTIVE", 403);
      return mock({
        token: "mock-student",
        account: {
          id: student.id, name: student.name, username: student.username,
          role: "STUDENT", classCode: student.classCode || null
        }
      });
    }
    return request("POST", "/auth/login", { username: username, password: password })
      .then(function (res) {
        if (res && res.token) setToken(res.token);
        return res;
      });
  }

  function signOut() {
    signOutLocal();
    return Promise.resolve(null);
  }

  /* -------------------------------------------------------------- student */

  /* GET /me -> { id, name, username, role, classCode, active, balanceCents } */
  function me() {
    if (MOCK) return mock(S.ME);
    return request("GET", "/me");
  }

  /* GET /menu/today -> { day, balanceCents, meals, myOrder }
     The balance comes with it, so the home screen needs no second call. */
  function menuToday(date) {
    if (MOCK) return mock(S.TODAY_MENU);
    return request("GET", "/menu/today" + (date ? "?date=" + encodeURIComponent(date) : ""));
  }

  /* GET /menu/week -> { monday, days: [{ …day, weekday, dateNumber, shortLabel,
     meals, myOrder }] } */
  function menuWeek(monday) {
    if (MOCK) return mock(S.WEEK_MENU);
    return request("GET", "/menu/week" + (monday ? "?monday=" + encodeURIComponent(monday) : ""));
  }

  /* GET /orders (student) -> { count, orders } — every order but the cancelled
     ones, newest day first, each with its own chip. */
  function myOrders() {
    if (MOCK) return mock({ count: S.MY_ORDERS.length, orders: S.MY_ORDERS });
    return request("GET", "/orders");
  }

  /* GET /announcements -> { announcements } */
  function announcements() {
    if (MOCK) return mock({ announcements: S.ANNOUNCEMENTS });
    return request("GET", "/announcements");
  }

  /* Ordering. The server is the only thing that knows whether a day is open,
     whether a meal is sold out and whether the balance covers it. All three
     answer { id, status } — the order's own id and its new status. */
  function placeOrder(mealOnDayId) {
    if (MOCK) return mockOrder(mealOnDayId, "create");
    return request("POST", "/orders", { mealOnDayId: mealOnDayId });
  }

  function changeOrder(orderId, mealOnDayId) {
    if (MOCK) return mockOrder(mealOnDayId, "change");
    return request("PATCH", "/orders/" + encodeURIComponent(orderId), { mealOnDayId: mealOnDayId });
  }

  function cancelOrder(orderId) {
    if (MOCK) {
      var day = S.TODAY_MENU;
      if (!day.myOrder) return fail("NOT_FOUND", 404);
      if (!day.day.open) return fail("DEADLINE", 409);

      var seat = mealIn(day, day.myOrder.mealOnDayId);
      if (seat) { seat.orderCount = Math.max(0, seat.orderCount - 1); seat.orderedByMe = false; }

      S.ME.balanceCents += S.LUNCH_PRICE_CENTS;
      day.balanceCents = S.ME.balanceCents;
      day.myOrder = null;

      /* The server hides a cancelled order from the student's own list. */
      S.MY_ORDERS = S.MY_ORDERS.filter(function (o) { return o.id !== orderId; });
      syncWeek();
      return mock({ id: orderId, status: "CANCELLED" });
    }
    return request("DELETE", "/orders/" + encodeURIComponent(orderId));
  }

  function mealIn(day, mealOnDayId) {
    return day.meals.filter(function (m) { return m.mealOnDayId === mealOnDayId; })[0];
  }

  /* The week view holds its own copy of the day, the way the server sends two
     separate responses. Keep them telling the same story after a write. */
  function syncWeek() {
    var day = S.TODAY_MENU;
    var wd = (S.WEEK_MENU.days || []).filter(function (d) { return d.key === day.day.key; })[0];
    if (!wd) return;
    wd.meals.forEach(function (m) {
      var here = mealIn(day, m.mealOnDayId);
      if (here) m.orderCount = here.orderCount;
    });
    wd.myOrder = day.myOrder ? clone(day.myOrder) : null;
  }

  /* Mock ordering, enforcing the same rules the server will: the day has to be
     open, capacity, balance, and one order per day (a change is a swap, never a
     second debit). The reply is the server's: { id, status }. */
  function mockOrder(mealOnDayId, kind) {
    var day = S.TODAY_MENU;
    var meal = mealIn(day, mealOnDayId);
    if (!meal) return fail("NOT_FOUND", 404);
    if (!day.day.isServing) return fail("DEADLINE", 409, "V tento deň sa nevarí");
    if (!day.day.open) return fail("DEADLINE", 409);
    if (meal.capacity > 0 && meal.orderCount >= meal.capacity) return fail("SOLD_OUT", 409);

    var charging = kind === "create";
    if (charging && S.ME.balanceCents < S.LUNCH_PRICE_CENTS) return fail("INSUFFICIENT_FUNDS", 402);

    /* A change releases the old seat and takes the new one; no money moves. */
    if (day.myOrder) {
      var old = mealIn(day, day.myOrder.mealOnDayId);
      if (old) { old.orderCount = Math.max(0, old.orderCount - 1); old.orderedByMe = false; }
    }
    if (charging) {
      S.ME.balanceCents -= S.LUNCH_PRICE_CENTS;
      day.balanceCents = S.ME.balanceCents;
    }

    meal.orderCount += 1;
    meal.orderedByMe = true;

    /* myOrder as /menu/today sends it: no order id — the id lives on the order
       itself, which is what /orders lists. */
    day.myOrder = {
      mealOnDayId: meal.mealOnDayId,
      slot: meal.slot,
      meal: {
        id: meal.id, name: meal.name, desc: meal.desc, category: meal.category,
        tint: meal.tint, allergens: (meal.allergens || []).slice(), icon: meal.icon
      },
      status: "ORDERED"
    };

    /* …and the order itself, so /orders answers with it the way it would after
       a real write. */
    var row = S.MY_ORDERS.filter(function (o) { return o.id === "ord_mock"; })[0];
    if (!row) { row = { id: "ord_mock" }; S.MY_ORDERS.unshift(row); }
    row.mealOnDayId = meal.mealOnDayId;
    row.date = day.day.key;
    row.slot = meal.slot;
    row.meal = { id: meal.id, name: meal.name, category: meal.category };
    row.status = "ORDERED";
    row.chip = { st: "ok", l: "Objednané" };

    syncWeek();
    return mock({ id: "ord_mock", status: "ORDERED" });
  }

  /* -------------------------------------------------------------- manager */

  /* GET /students -> { count, students: [{ id, name, username, classCode,
     active, balanceCents }] } */
  function students(q) {
    if (MOCK) {
      var list = S.STUDENTS;
      if (q) {
        var n = String(q).toLowerCase();
        list = list.filter(function (s) {
          return s.name.toLowerCase().indexOf(n) !== -1 || s.username.toLowerCase().indexOf(n) !== -1;
        });
      }
      return mock({ count: list.length, students: list });
    }
    return request("GET", "/students" + (q ? "?q=" + encodeURIComponent(q) : ""));
  }

  /* PATCH /students/:id -> { id, active, balanceCents } */
  function setStudentActive(id, active) {
    if (MOCK) {
      var s = S.STUDENTS.filter(function (x) { return x.id === id; })[0];
      if (!s) return fail("NOT_FOUND", 404, "Študent sa nenašiel");
      s.active = !!active;
      return mock({ id: s.id, active: s.active, balanceCents: s.balanceCents });
    }
    return request("PATCH", "/students/" + encodeURIComponent(id), { active: active });
  }

  /* POST /students/:id/topup -> { id, balanceCents } */
  function topUp(id, amountCents) {
    if (MOCK) {
      var s = S.STUDENTS.filter(function (x) { return x.id === id; })[0];
      if (!s) return fail("NOT_FOUND", 404, "Študent sa nenašiel");
      if (!(amountCents > 0)) return fail("VALIDATION", 400);
      s.balanceCents += amountCents;
      if (s.id === S.ME.id) {
        S.ME.balanceCents = s.balanceCents;
        S.TODAY_MENU.balanceCents = s.balanceCents;
      }
      return mock({ id: s.id, balanceCents: s.balanceCents });
    }
    return request("POST", "/students/" + encodeURIComponent(id) + "/topup", { amountCents: amountCents });
  }

  /* GET /orders (manager) -> { date, count, orders: [{ id, student, classCode,
     slot, meal, status, chip }] } — student and meal are plain strings.

     With format:"csv" the same route answers text/csv (content-disposition:
     attachment), so this resolves with a STRING instead. Callers must accept
     both; the export screen renders whichever it gets. */
  function kitchenOrders(opts) {
    opts = opts || {};
    if (MOCK) {
      var date = opts.date || S.KITCHEN_DATE;
      var list = S.KITCHEN_ORDERS;
      if (opts.status) {
        list = list.filter(function (o) { return o.status === opts.status; });
      }
      if (opts.format === "csv") return mock(mockCsv(list));
      return mock({ date: date, count: list.length, orders: list });
    }
    var q = [];
    if (opts.date) q.push("date=" + encodeURIComponent(opts.date));
    if (opts.status) q.push("status=" + encodeURIComponent(opts.status));
    if (opts.format) q.push("format=" + encodeURIComponent(opts.format));
    return request("GET", "/orders" + (q.length ? "?" + q.join("&") : ""));
  }

  /* Byte for byte the server's CSV: semicolons, the dish quoted, the chip's
     own Slovak word for the state. */
  function mockCsv(list) {
    return ["Meno;Trieda;Obed;Jedlo;Stav"].concat(list.map(function (o) {
      /* The row's own chip, or the same table the server maps from. NOT
         S.chip(): data.js exports a chip reader of that name, but ui.js loads
         after it and overwrites S.chip with the chip MARKUP helper, so
         S.chip(order) is a string of HTML with no .l on it — which is what
         left the Stav column of this CSV empty. */
      var chip = (o.chip && o.chip.l) ? o.chip
        : ((S.STATUS_CHIP || {})[o.status] || { l: o.status });
      return [
        o.student,
        o.classCode || "",
        o.slot,
        '"' + String(o.meal).replace(/"/g, '""') + '"',
        chip.l
      ].join(";");
    })).join("\n");
  }

  /* POST /orders/:id/serve -> { id, status } */
  function serveOrder(id) {
    if (MOCK) {
      var o = S.KITCHEN_ORDERS.filter(function (x) { return x.id === id; })[0];
      if (!o) return fail("NOT_FOUND", 404, "Objednávka sa nenašla");
      if (o.status === "CANCELLED" || o.status === "AUTO_CANCELLED") {
        return fail("CANCELLED", 409);
      }
      o.status = "SERVED";
      o.chip = { st: "ok", l: "Vydané" };
      return mock({ id: o.id, status: o.status });
    }
    return request("POST", "/orders/" + encodeURIComponent(id) + "/serve");
  }

  /* POST /announcements -> 201 { id } — the id and nothing else, so the screen
     has to re-read the list to show the new post. */
  function postAnnouncement(data) {
    if (MOCK) {
      var at = new Date();
      var hh = String(at.getUTCHours()); while (hh.length < 2) hh = "0" + hh;
      var mm = String(at.getUTCMinutes()); while (mm.length < 2) mm = "0" + mm;
      var a = {
        id: "a_mock_" + S.ANNOUNCEMENTS.length,
        title: data.title,
        body: data.body,
        important: !!data.important,
        author: (S.MANAGERS[0] && S.MANAGERS[0].name) || "Vedúca jedálne",
        createdAt: at.toISOString(),
        meta: "dnes " + hh + ":" + mm
      };
      S.ANNOUNCEMENTS.unshift(a);
      return mock({ id: a.id });
    }
    return request("POST", "/announcements", {
      title: data.title,
      body: data.body,
      important: !!data.important
    });
  }

  /* ---------- menu management ----------
     THE BACKEND HAS NO WRITE SIDE FOR THE MENU. There is no endpoint that
     creates or edits a Meal, a SchoolDay or a MealOnDay: /menu/today and
     /menu/week can only read what something else wrote. Written up in
     html/API-GAPS.md (§2).

     The screen stays, because a canteen that cannot publish a menu has no
     product. In mock mode it works end to end. Against a real server the PUT
     is attempted and its 404 is turned into a plain Slovak sentence, so the
     manager learns the truth instead of reading "Nenašlo sa". */

  var MENU_NOT_IMPLEMENTED =
    "Server zatiaľ nepodporuje publikovanie menu, takže zmeny sa neuložili. " +
    "Menu sa dnes zadáva priamo v systéme školy.";

  function menuForDate(date) {
    if (MOCK) return mock(S.TODAY_MENU);
    return request("GET", "/menu/today?date=" + encodeURIComponent(date));
  }

  function saveMenu(date, meals) {
    if (MOCK) {
      /* Re-seat the day the way the server would: slots renumbered from 1,
         orderCount preserved where a row survived, zero on anything new. */
      var prev = {};
      S.TODAY_MENU.meals.forEach(function (m) { prev[m.mealOnDayId] = m; });

      S.TODAY_MENU.meals = meals.map(function (m, i) {
        var was = m.mealOnDayId && prev[m.mealOnDayId];
        return {
          mealOnDayId: m.mealOnDayId || "mod_" + date + "_new" + (i + 1),
          slot: i + 1,
          id: (was && was.id) || "meal_new_" + (i + 1),
          name: m.name,
          desc: m.desc,
          /* The server stores an enum and answers with its Slovak label, so
             what goes back out is a label whatever the editor held. */
          category: S.category(m.category).label,
          tint: (was && was.tint) || "",
          allergens: (m.allergens || []).slice(),
          icon: (was && was.icon) || "",
          capacity: Number(m.capacity) || 0,
          orderCount: was ? was.orderCount : 0,
          orderedByMe: was ? !!was.orderedByMe : false
        };
      });
      syncWeek();
      return mock({ date: date, meals: S.TODAY_MENU.meals, published: true });
    }
    /* No such route on this backend — see html/API-GAPS.md (§2). */
    return whenMissing(
      request("PUT", "/menu/" + encodeURIComponent(date), { meals: meals }),
      MENU_NOT_IMPLEMENTED
    );
  }

  /* ---------- account creation ----------
     THE BACKEND HAS NO POST /students. The manager routes can list, activate
     and top up, but nothing opens a lunch account. Written up in
     html/API-GAPS.md (§1).

     Same deal as the menu: the form stays and works in mock mode, and against
     a real server the 404 becomes a sentence that says who can do it instead.
     Open question for the backend: who sets the first password — passwordHash
     is nullable, so a fresh account may have none. */

  var STUDENT_NOT_IMPLEMENTED =
    "Server zatiaľ nepodporuje zakladanie účtov, takže žiak nebol vytvorený. " +
    "Nové kontá zakladá správca školského systému.";

  function createStudent(data) {
    if (MOCK) {
      var u = String(data.username || "").trim().toLowerCase();
      if (!data.name || !u) return fail("VALIDATION", 400);
      if (S.STUDENTS.some(function (s) { return s.username === u; })) {
        return Promise.reject(new ApiError(409, "VALIDATION",
          "Používateľské meno " + u + " je už obsadené."));
      }
      var fresh = {
        id: "acc_" + u.replace(/[^a-z0-9]/g, ""),
        name: String(data.name).trim(),
        username: u,
        classCode: data.classCode ? String(data.classCode).trim() : null,
        active: true,
        balanceCents: 0
      };
      S.STUDENTS.unshift(fresh);
      return mock(fresh);
    }
    /* No such route on this backend — see html/API-GAPS.md (§1). */
    return whenMissing(
      request("POST", "/students", {
        name: data.name,
        username: data.username,
        classCode: data.classCode || null
      }),
      STUDENT_NOT_IMPLEMENTED
    );
  }

  S.api = {
    mock: MOCK,
    base: BASE,
    ApiError: ApiError,
    fallbackMessage: fallbackMessage,
    token: token,
    setToken: setToken,
    request: request,

    login: login,
    signOut: signOut,

    me: me,
    menuToday: menuToday,
    menuWeek: menuWeek,
    myOrders: myOrders,
    announcements: announcements,
    placeOrder: placeOrder,
    changeOrder: changeOrder,
    cancelOrder: cancelOrder,

    students: students,
    createStudent: createStudent,
    setStudentActive: setStudentActive,
    topUp: topUp,
    kitchenOrders: kitchenOrders,
    serveOrder: serveOrder,
    postAnnouncement: postAnnouncement,

    menuForDate: menuForDate,
    saveMenu: saveMenu
  };
})(window.SKYRO);
