/* Route guard.

   ====================================================================
   THIS IS NOT SECURITY. READ THIS BEFORE RELYING ON IT.
   ====================================================================
   Everything here runs in the browser, so anyone who wants in can get in:
   disable JavaScript, edit sessionStorage from the console, or just read
   this file. It stops a student from typing /ziaci.html into the address
   bar and wandering into the admin panel. It stops nothing else.

   Real enforcement has to happen where the user cannot reach it:
     1. The API rejects every request without a valid session, on every
        endpoint. The frontend guard is then only about which screen to
        show, which is all a frontend can ever honestly do.
     2. The admin panel sits behind Cloudflare Access (or equivalent)
        restricted to staff, so the files are never served to a stranger
        in the first place.

   Until (1) exists, treat this app as public. Do not put real student
   data behind it.
   ==================================================================== */
window.SKYRO = window.SKYRO || {};
(function (S) {
  "use strict";

  var KEY = "skyro.session";

  /* Pages reachable without a session. Everything else redirects. */
  var PUBLIC = ["prihlasenie.html"];

  /* Cloudflare Pages serves /kredit as well as /kredit.html, so the address
     bar may carry either. Normalise to the filename the nav and the guard
     both speak, or the login page guards itself and ?next= is thrown away. */
  function normalise(name) {
    if (!name) return "index.html";
    return name.indexOf(".") === -1 ? name + ".html" : name;
  }

  function currentFile() {
    return normalise(window.location.pathname.split("/").pop());
  }

  /* sessionStorage, not localStorage: closing the tab ends the session,
     which is the right default on a shared school computer. */
  function get() {
    try {
      var raw = window.sessionStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function set(user) {
    try {
      window.sessionStorage.setItem(KEY, JSON.stringify(user || {}));
    } catch (e) { /* private mode — the guard simply will not hold */ }
  }

  function clear() {
    try { window.sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    if (S.api && S.api.setToken) S.api.setToken("");
  }

  /* Where the user was heading before being bounced to the login screen,
     so signing in returns them there instead of to the home page. */
  function intended() {
    var m = window.location.search.match(/[?&]next=([^&]+)/);
    if (!m) return "";
    var next = normalise(decodeURIComponent(m[1]));
    /* Only same-folder page names. Anything with a slash, a scheme or a
       "next" of its own is an open-redirect waiting to happen. */
    if (!/^[a-z0-9._-]+\.html$/i.test(next)) return "";
    /* Bouncing back to the login page would loop. */
    return PUBLIC.indexOf(next) === -1 ? next : "";
  }

  function guard() {
    var here = currentFile();
    if (PUBLIC.indexOf(here) !== -1) return true;
    if (get()) return true;

    /* replace(), not href: the user must not be able to press Back and
       land on the page they were just turned away from. */
    window.location.replace("prihlasenie.html?next=" + encodeURIComponent(here));
    return false;
  }

  S.session = {
    get: get,
    set: set,
    clear: clear,
    intended: intended,
    guard: guard,
    currentFile: currentFile
  };

  /* Run immediately, before any page script renders anything, so a guarded
     page never flashes its contents on the way out. */
  S.session.allowed = guard();
})(window.SKYRO);
