/* Small DOM helpers and the markup pieces that repeat across pages.
   No framework: these return HTML strings, and pages set innerHTML once. */
window.SKYRO = window.SKYRO || {};
(function (S) {
  "use strict";

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* Everything interpolated into innerHTML goes through this. The data is ours
     today, but it will come from an API tomorrow. */
  function esc(v) {
    return String(v === null || v === undefined ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function icon(name, cls) {
    return '<span class="ms' + (cls ? " " + esc(cls) : "") + '" aria-hidden="true">' + esc(name) + "</span>";
  }

  function chip(state, label) {
    return '<span class="chip ' + esc(state) + '"><i></i>' + esc(label) + "</span>";
  }

  function tag(t) {
    return t === "veg"
      ? '<span class="tag veg">Vegetariánske</span>'
      : '<span class="tag">Alergény ' + esc(t) + "</span>";
  }

  /* The phone's app bar, as a page header. `actions` is raw markup. */
  function pageHead(title, sub, actions) {
    return '<div class="row wide wrap" style="align-items:flex-end;margin-bottom:32px">' +
      "<div><h1 style=\"margin-bottom:4px\">" + esc(title) + "</h1>" +
      (sub ? '<p style="margin:0;font-size:15px;font-weight:600;color:var(--ink-2)">' + esc(sub) + "</p>" : "") +
      "</div>" +
      (actions ? '<div class="row tight push">' + actions + "</div>" : "") +
      "</div>";
  }

  function iconBtn(name, label) {
    return '<button class="iconbtn" type="button" aria-label="' + esc(label) + '">' + icon(name) + "</button>";
  }

  /* Announce a message to screen readers. The live region must already exist
     and be empty, otherwise the insertion itself is not announced. */
  function announce(el, message) {
    if (!el) return;
    el.textContent = "";
    window.setTimeout(function () { el.textContent = message; }, 50);
  }

  Object.assign(S, { $: $, $$: $$, esc: esc, icon: icon, chip: chip, tag: tag,
                     pageHead: pageHead, iconBtn: iconBtn, announce: announce });
})(window.SKYRO);
