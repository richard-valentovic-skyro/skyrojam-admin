/* Renders the chrome every page shares: the violet rail and the glass topbar.
   Each page carries only its own content; this fills in the rest and marks
   the current nav item from the filename. */
window.SKYRO = window.SKYRO || {};
(function (S) {
  "use strict";

  /* /kredit and /kredit.html are the same page; the nav speaks filenames. */
  function currentFile() {
    var f = window.location.pathname.split("/").pop();
    if (!f) return "index.html";
    return f.indexOf(".") === -1 ? f + ".html" : f;
  }

  function rail(app, here) {
    var items = app.nav.map(function (it) {
      var active = it.href === here;
      return '<a class="rbtn" href="' + S.esc(it.href) + '" title="' + S.esc(it.label) + '"' +
        ' aria-label="' + S.esc(it.label) + '"' + (active ? ' aria-current="page"' : "") + ">" +
        S.icon(it.icon) +
        (it.badge ? '<span class="railbadge">' + S.esc(it.badge) + "</span>" : "") +
        "</a>";
    }).join("");

    return '<nav class="rail" aria-label="' + S.esc(app.navLabel) + '">' +
      '<a href="' + S.esc(app.home) + '" aria-label="Skyro Obedy">' + S.logoSvg("logo") + "</a>" +
      '<div class="railnav">' + items + "</div>" +
      '<div class="railfoot">' +
        '<a class="rbtn" href="prihlasenie.html" title="Odhlásiť sa" aria-label="Odhlásiť sa">' +
          S.icon("logout") + "</a>" +
      "</div></nav>";
  }

  function topbar(app) {
    return '<header class="topbar glass">' +
      '<span class="beta">Beta</span>' +
      '<div class="who"><span class="av">' + S.icon("person") + "</span>" +
      S.esc(app.account) + S.icon("expand_more", "cv") + "</div></header>";
  }

  /* Call once per page. Returns the element page content should render into. */
  function mount() {
    var app = S.APP, here = currentFile();
    var host = document.body;

    var skip = '<a class="skip" href="#obsah">Preskočiť na obsah</a>';
    var content = S.$("#page-content");
    var inner = content ? content.innerHTML : "";

    host.innerHTML = skip +
      '<div class="mesh"></div>' +
      rail(app, here) +
      '<div class="main">' + topbar(app) +
      '<main class="page" id="obsah" tabindex="-1">' + inner + "</main></div>" +
      '<div id="live" role="status" aria-live="polite" class="sr-only"></div>';

    return S.$("#obsah");
  }

  /* Reveal icons only once the ligature font can render them. Any failure
     path — no document.fonts, a timeout, an offline school wifi — reveals
     them anyway rather than leaving the UI iconless. */
  function revealIconsWhenReady() {
    var show = function () { document.documentElement.classList.add("fonts-ready"); };
    window.setTimeout(show, 3000); // never hide icons for longer than this
    if (!document.fonts || !document.fonts.load) { show(); return; }
    document.fonts.load('24px "Material Symbols Outlined"').then(show, show);
  }

  Object.assign(S, { mount: mount, currentFile: currentFile });
  revealIconsWhenReady();
})(window.SKYRO);
