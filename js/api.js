/* The single door between this app and the server.

   NOTHING ELSE IN THE APP MAY FETCH. Pages call S.api.* and render what comes
   back. Every method returns a Promise and resolves with the server's own view
   of what happened — never with what we hoped would happen.

   Matches the backend spec: Bun + Elysia + Prisma. Money is integer cents
   throughout. Ordering is by mealOnDayId. The server decides whether a day is
   open; there is no deadline logic in this file or anywhere else on the client.

   With CONFIG.API_BASE empty this runs in MOCK MODE against the fixtures in
   data.js, so the app works with no server at all. */
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
     Slovak, because this text reaches students. */
  function fallbackMessage(code, status) {
    switch (code) {
      case "UNAUTHORIZED":        return "Prihlásenie vypršalo. Prihláste sa znova.";
      case "FORBIDDEN":           return "Na túto akciu nemáte oprávnenie.";
      case "NOT_FOUND":           return "Požadovaný údaj sa nenašiel.";
      case "DEADLINE":            return "Objednávky na tento deň sú už uzavreté.";
      case "SOLD_OUT":            return "Toto jedlo je už vypredané.";
      case "INSUFFICIENT_FUNDS":  return "Na účte nie je dosť kreditu.";
      case "VALIDATION":          return "Zadané údaje nie sú platné.";
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

    return window.fetch(BASE + path, opts).then(
      function (res) {
        if (timer) window.clearTimeout(timer);

        var type = res.headers.get("content-type") || "";
        if (type.indexOf("text/csv") !== -1) return res.text();
        if (res.status === 204) return null;

        return res.text().then(function (text) {
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (e) { /* not JSON */ }
          if (!res.ok) {
            /* An expired token is not this call's problem to report — send the
               user back to sign in rather than showing a stale screen. */
            if (res.status === 401) signOutLocal();
            throw new ApiError(res.status, data && data.error, data && data.message);
          }
          return data;
        });
      },
      function () {
        if (timer) window.clearTimeout(timer);
        throw new ApiError(0, "NETWORK", fallbackMessage("NETWORK", 0));
      }
    );
  }

  function signOutLocal() {
    setToken("");
    if (S.session && S.session.clear) S.session.clear();
  }

  /* ----------------------------------------------------------- mock mode */

  function mock(value) {
    return new Promise(function (resolve) {
      window.setTimeout(function () { resolve(clone(value)); }, 0);
    });
  }

  function fail(code, status) {
    return Promise.reject(new ApiError(status || 400, code));
  }

  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }

  /* ---------------------------------------------------------------- auth */

  function login(username, password) {
    if (MOCK) {
      var u = String(username).trim().toLowerCase();
      var manager = S.MANAGERS.filter(function (m) { return m.username === u; })[0];
      if (manager) return mock({ token: "mock-manager", account: manager });

      var student = S.STUDENTS.filter(function (s) { return s.username === u; })[0];
      if (!student) return fail("UNAUTHORIZED", 401);
      if (!student.active) return fail("FORBIDDEN", 403);
      return mock({
        token: "mock-student",
        account: { id: student.id, name: student.name, username: student.username, role: "STUDENT" }
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

  function me() {
    if (MOCK) return mock(S.ME);
    return request("GET", "/me");
  }

  function menuToday(date) {
    if (MOCK) return mock(S.TODAY_MENU);
    return request("GET", "/menu/today" + (date ? "?date=" + encodeURIComponent(date) : ""));
  }

  function menuWeek(monday) {
    if (MOCK) return mock(S.WEEK_MENU);
    return request("GET", "/menu/week" + (monday ? "?monday=" + encodeURIComponent(monday) : ""));
  }

  function myOrders() {
    if (MOCK) return mock({ orders: S.MY_ORDERS });
    return request("GET", "/orders");
  }

  function announcements() {
    if (MOCK) return mock({ announcements: S.ANNOUNCEMENTS });
    return request("GET", "/announcements");
  }

  /* Ordering. The server is the only thing that knows whether a day is open,
     whether a meal is sold out and whether the balance covers it. */
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
      S.ME.balanceCents += S.LUNCH_PRICE_CENTS;
      S.TODAY_MENU.myOrder = null;
      S.TODAY_MENU.meals.forEach(function (m) { m.orderedByMe = false; });
      return mock({ id: orderId, status: "CANCELLED" });
    }
    return request("DELETE", "/orders/" + encodeURIComponent(orderId));
  }

  /* Mock ordering, enforcing the same rules the server will: capacity,
     balance, and one order per day (a change is a swap, never a second debit). */
  function mockOrder(mealOnDayId, kind) {
    var day = S.TODAY_MENU;
    var meal = day.meals.filter(function (m) { return m.mealOnDayId === mealOnDayId; })[0];
    if (!meal) return fail("NOT_FOUND", 404);
    if (!day.day.open) return fail("DEADLINE", 409);
    if (meal.capacity > 0 && meal.orderCount >= meal.capacity) return fail("SOLD_OUT", 409);

    var charging = kind === "create";
    if (charging && S.ME.balanceCents < S.LUNCH_PRICE_CENTS) return fail("INSUFFICIENT_FUNDS", 402);

    /* A change releases the old seat and takes the new one; no money moves. */
    if (day.myOrder) {
      var old = day.meals.filter(function (m) { return m.mealOnDayId === day.myOrder.mealOnDayId; })[0];
      if (old) { old.orderCount = Math.max(0, old.orderCount - 1); old.orderedByMe = false; }
    }
    if (charging) S.ME.balanceCents -= S.LUNCH_PRICE_CENTS;

    meal.orderCount += 1;
    meal.orderedByMe = true;
    day.myOrder = {
      id: "ord_mock",
      mealOnDayId: meal.mealOnDayId,
      slot: meal.slot,
      status: "ORDERED",
      meal: { name: meal.name, category: meal.category, icon: meal.icon }
    };
    return mock({ id: "ord_mock", status: "ORDERED" });
  }

  /* -------------------------------------------------------------- manager */

  function students(q) {
    if (MOCK) {
      var list = S.STUDENTS;
      if (q) {
        var n = String(q).toLowerCase();
        list = list.filter(function (s) {
          return s.name.toLowerCase().indexOf(n) !== -1 || s.username.toLowerCase().indexOf(n) !== -1;
        });
      }
      return mock({ students: list });
    }
    return request("GET", "/students" + (q ? "?q=" + encodeURIComponent(q) : ""));
  }

  function setStudentActive(id, active) {
    if (MOCK) {
      var s = S.STUDENTS.filter(function (x) { return x.id === id; })[0];
      if (!s) return fail("NOT_FOUND", 404);
      s.active = active;
      return mock({ id: id, active: active });
    }
    return request("PATCH", "/students/" + encodeURIComponent(id), { active: active });
  }

  function topUp(id, amountCents) {
    if (MOCK) {
      var s = S.STUDENTS.filter(function (x) { return x.id === id; })[0];
      if (!s) return fail("NOT_FOUND", 404);
      if (!(amountCents > 0)) return fail("VALIDATION", 400);
      s.balanceCents += amountCents;
      if (s.id === S.ME.id) S.ME.balanceCents = s.balanceCents;
      return mock({ id: id, balanceCents: s.balanceCents });
    }
    return request("POST", "/students/" + encodeURIComponent(id) + "/topup", { amountCents: amountCents });
  }

  function kitchenOrders(opts) {
    opts = opts || {};
    if (MOCK) {
      return mock({ date: opts.date || S.TODAY_MENU.day.key, count: S.KITCHEN_ORDERS.length, orders: S.KITCHEN_ORDERS });
    }
    var q = [];
    if (opts.date) q.push("date=" + encodeURIComponent(opts.date));
    if (opts.status) q.push("status=" + encodeURIComponent(opts.status));
    if (opts.format) q.push("format=" + encodeURIComponent(opts.format));
    return request("GET", "/orders" + (q.length ? "?" + q.join("&") : ""));
  }

  function serveOrder(id) {
    if (MOCK) {
      var o = S.KITCHEN_ORDERS.filter(function (x) { return x.id === id; })[0];
      if (!o) return fail("NOT_FOUND", 404);
      o.status = "SERVED";
      return mock({ id: id, status: "SERVED" });
    }
    return request("POST", "/orders/" + encodeURIComponent(id) + "/serve");
  }

  function postAnnouncement(data) {
    if (MOCK) {
      var a = {
        id: "a_mock", title: data.title, body: data.body,
        important: !!data.important, author: "Katarína Vrábľová", createdAt: "teraz"
      };
      S.ANNOUNCEMENTS.unshift(a);
      return mock({ id: a.id });
    }
    return request("POST", "/announcements", data);
  }

  S.api = {
    mock: MOCK,
    base: BASE,
    ApiError: ApiError,
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
    setStudentActive: setStudentActive,
    topUp: topUp,
    kitchenOrders: kitchenOrders,
    serveOrder: serveOrder,
    postAnnouncement: postAnnouncement
  };
})(window.SKYRO);
