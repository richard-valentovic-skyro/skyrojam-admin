/* The single door between this app and a server.

   NOTHING ELSE IN THE APP MAY FETCH. Page scripts read data from window.SKYRO
   (filled by boot.js) and write through S.api.*. That is the whole contract.

   Until CONFIG.API_BASE is set this runs in MOCK MODE: every call resolves
   against the fixtures in data.js, so the app works with no server at all.
   Point CONFIG.API_BASE at a real API and the same calls go over the wire —
   no page script changes.

   Every method returns a Promise. Writes resolve with the server's view of
   what changed, so the caller re-renders from the response rather than
   guessing what the server did.

   See API.md for the wire format of every endpoint. */
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

  /* --------------------------------------------------------------- error */

  /* One error shape for the whole app, so the UI never has to guess.
     .status 0 means the request never reached the server. */
  function ApiError(status, code, message) {
    this.name = "ApiError";
    this.status = status;
    this.code = code || "unknown";
    this.message = message || "Nastala chyba. Skúste to znova.";
  }
  ApiError.prototype = Object.create(Error.prototype);

  /* Slovak, because this text reaches students. */
  function messageFor(status) {
    if (status === 0)   return "Nepodarilo sa spojiť so serverom. Skontrolujte pripojenie.";
    if (status === 401) return "Prihlásenie vypršalo. Prihláste sa znova.";
    if (status === 403) return "Na túto akciu nemáte oprávnenie.";
    if (status === 404) return "Požadovaný údaj sa nenašiel.";
    if (status === 409) return "Údaje sa medzitým zmenili. Obnovte stránku.";
    if (status === 422) return "Zadané údaje nie sú platné.";
    if (status === 429) return "Priveľa pokusov. Skúste to o chvíľu.";
    if (status >= 500)  return "Server má problém. Skúste to o chvíľu.";
    return "Nastala chyba. Skúste to znova.";
  }

  /* -------------------------------------------------------------- request */

  var TIMEOUT_MS = 15000;

  function request(method, path, body) {
    var url = BASE + path;
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = ctrl && window.setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);

    var opts = {
      method: method,
      headers: { Accept: "application/json" },
      credentials: "include",
      signal: ctrl ? ctrl.signal : undefined
    };
    if (token()) opts.headers.Authorization = "Bearer " + token();
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }

    return window.fetch(url, opts).then(
      function (res) {
        if (timer) window.clearTimeout(timer);
        if (res.status === 204) return null;
        return res.text().then(function (text) {
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (e) { /* not JSON */ }
          if (!res.ok) {
            throw new ApiError(
              res.status,
              data && data.code,
              (data && data.message) || messageFor(res.status)
            );
          }
          return data;
        });
      },
      function () {
        if (timer) window.clearTimeout(timer);
        throw new ApiError(0, "network", messageFor(0));
      }
    );
  }

  /* ----------------------------------------------------------- mock mode */

  function mock(value) {
    return new Promise(function (resolve) {
      window.setTimeout(function () { resolve(value); }, 0);
    });
  }

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  /* Idempotency keys let a retried write be de-duplicated by the server
     instead of charging a student twice. No Date.now/random needed: a
     counter plus the page load is unique enough for one session. */
  var seq = 0;
  function idempotencyKey(prefix) {
    seq += 1;
    return prefix + "-" + seq + "-" + (S.BOOT_ID || "0");
  }

  /* ---------------------------------------------------------------- reads */

  /* One call fills everything a page could need. Cheap server-side, and it
     means a page never has to orchestrate four requests. */
  function bootstrap() {
    if (MOCK) {
      return mock({
        me: clone(S.STUDENTS.filter(function (s) { return s.id === S.CURRENT_STUDENT_ID; })[0] || null),
        staff: clone(S.STAFF),
        price: S.LUNCH_PRICE,
        meals: clone(S.MEALS),
        week: clone(S.WEEK),
        orders: clone(S.ORDERS),
        posts: clone(S.POSTS),
        conversations: clone(S.CONVS),
        thread: clone(S.THREAD),
        students: clone(S.STUDENTS),
        ledger: clone(S.LEDGER)
      });
    }
    return request("GET", "/bootstrap");
  }

  /* ---------------------------------------------------------------- writes
     Each one resolves with the server's view of what changed. In mock mode
     they mutate the in-memory fixtures so the UI behaves correctly offline. */

  function placeOrder(date, mealId) {
    if (MOCK) {
      var me = S.STUDENTS.filter(function (s) { return s.id === S.CURRENT_STUDENT_ID; })[0];
      /* One lunch per (student, date): a repeat is an UPDATE, never a second
         debit. The server must enforce the same invariant. */
      var already = S.LEDGER.some(function (l) { return l.orderDate === date; });
      if (!already) {
        me.balance = Number((me.balance - S.LUNCH_PRICE).toFixed(2));
        S.LEDGER.unshift({
          id: idempotencyKey("l"), studentId: me.id, orderDate: date,
          amount: -S.LUNCH_PRICE, label: "Obed " + (mealId + 1), at: "teraz"
        });
      }
      return mock({ balance: me.balance, mealId: mealId, date: date, charged: !already });
    }
    return request("POST", "/orders", {
      date: date, mealId: mealId, idempotencyKey: idempotencyKey("order")
    });
  }

  function cancelOrder(date) {
    if (MOCK) return mock({ date: date, cancelled: true });
    return request("DELETE", "/orders/" + encodeURIComponent(date));
  }

  function creditStudent(studentId, amount) {
    if (MOCK) {
      var s = S.STUDENTS.filter(function (x) { return x.id === studentId; })[0];
      if (!s) return Promise.reject(new ApiError(404, "not_found", messageFor(404)));
      s.balance = Number((s.balance + amount).toFixed(2));
      var entry = {
        id: idempotencyKey("l"), studentId: studentId, amount: amount,
        label: "Dobitie kreditu", at: "teraz", by: "Katarína Vrábľová"
      };
      S.LEDGER.unshift(entry);
      return mock({ student: clone(s), entry: clone(entry) });
    }
    return request("POST", "/admin/students/" + encodeURIComponent(studentId) + "/credit", {
      amount: amount, idempotencyKey: idempotencyKey("credit")
    });
  }

  function createStudent(data) {
    if (MOCK) {
      var s = {
        id: idempotencyKey("s"), name: data.name, email: data.email,
        trieda: data.trieda, balance: 0, active: true, created: "dnes"
      };
      S.STUDENTS.unshift(s);
      return mock({ student: clone(s) });
    }
    return request("POST", "/admin/students", data);
  }

  function setStudentActive(studentId, active) {
    if (MOCK) {
      var s = S.STUDENTS.filter(function (x) { return x.id === studentId; })[0];
      if (s) s.active = active;
      return mock({ student: clone(s) });
    }
    return request("PATCH", "/admin/students/" + encodeURIComponent(studentId), { active: active });
  }

  function publishMenu(date, meals) {
    if (MOCK) return mock({ date: date, meals: clone(meals), published: true });
    return request("PUT", "/admin/menu/" + encodeURIComponent(date), { meals: meals });
  }

  function postAnnouncement(data) {
    if (MOCK) {
      var post = { t: data.title, b: data.body, imp: !!data.important, m: "teraz, Katarína Vrábľová" };
      S.POSTS.unshift(post);
      return mock({ post: clone(post) });
    }
    return request("POST", "/admin/announcements", data);
  }

  function sendMessage(conversationId, text) {
    if (MOCK) {
      return mock({ message: { kind: "msg", from: "me", text: text, at: "teraz" } });
    }
    return request("POST", "/conversations/" + encodeURIComponent(conversationId) + "/messages", {
      text: text, idempotencyKey: idempotencyKey("msg")
    });
  }

  /* ----------------------------------------------------------------- auth */

  function requestLoginLink(email) {
    if (MOCK) return mock({ requested: true });
    return request("POST", "/auth/request-link", { email: email });
  }

  /* Exchanges the token from the emailed link for a session. */
  function verifyLoginToken(t) {
    if (MOCK) return mock({ token: "mock", user: null });
    return request("POST", "/auth/verify", { token: t }).then(function (r) {
      if (r && r.token) setToken(r.token);
      return r;
    });
  }

  function signOut() {
    setToken("");
    if (MOCK) return mock(null);
    return request("POST", "/auth/sign-out");
  }

  S.api = {
    mock: MOCK,
    base: BASE,
    ApiError: ApiError,
    token: token,
    setToken: setToken,
    request: request,

    bootstrap: bootstrap,

    placeOrder: placeOrder,
    cancelOrder: cancelOrder,
    creditStudent: creditStudent,
    createStudent: createStudent,
    setStudentActive: setStudentActive,
    publishMenu: publishMenu,
    postAnnouncement: postAnnouncement,
    sendMessage: sendMessage,

    requestLoginLink: requestLoginLink,
    verifyLoginToken: verifyLoginToken,
    signOut: signOut
  };
})(window.SKYRO);
