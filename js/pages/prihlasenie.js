/* Login for the canteen office: one field, one button, no card. The same
   Apple sign-in restraint as the student app — a centred column on a white
   ground, light-weight display type, the submit button riding inside the
   field itself — with the headline and the fine print saying who this door is
   for.

   This is the one page with no chrome, so it never calls S.mount(): there is
   no rail to escape from and no topbar account to show before you are signed
   in. It renders straight into #page-content instead.

   Two things the React build got wrong and are fixed here: the page had no
   <h1> at all (the title was an <h2>), so the document outline started at
   level two; and the visible "Školský e-mail" text is a <span class="fk">,
   not a <label for>, which leaves the input nameless — the aria-label carries
   the name. */
(function (S) {
  "use strict";

  var email = "katarina.vrablova@skyro.ai";
  var remember = true;

  var root = S.$("#page-content");

  /* The backdrop is static chrome: a fixed white sheet with two big radial
     gradients. It is written once so that toggling "Zapamätať si ma" repaints
     the column only, never two full-viewport gradients. */
  root.innerHTML =
    '<div class="alogin"></div>' +
    '<div class="awrap"><div class="acol" id="acol"></div></div>';

  var col = S.$("#acol");

  function render() {
    col.innerHTML =
      S.logoSvg("amark") +
      '<h1 class="atitle">Prihlásenie<br>do administrácie</h1>' +

      '<form class="afield" id="signin">' +
        '<span class="fl">' +
          '<span class="fk">Školský e-mail</span>' +
          '<input type="email" id="email" required autocomplete="email"' +
            ' aria-label="Školský e-mail" value="' + S.esc(email) + '">' +
        "</span>" +
        '<button class="ago" type="submit" aria-label="Pokračovať">' +
          S.icon("arrow_forward") + "</button>" +
      "</form>" +

      '<button class="acheck" type="button" id="remember" aria-pressed="' + remember + '">' +
        '<span class="bx">' + S.icon("check") + "</span>" +
        "Zapamätať si ma</button>" +

      '<div class="ahr"></div>' +
      '<button class="alink" type="button">Nedarí sa vám prihlásiť?</button>' +
      '<p class="afine">Heslo nepotrebujete. Pošleme jednorazový odkaz na adresu' +
        " v doméne skyro.ai. Prístup má len personál jedálne.</p>";

    bind();
  }

  function bind() {
    /* Keep the typed address in state, so a re-render does not throw it away. */
    var input = S.$("#email");
    if (input) {
      input.addEventListener("input", function () { email = input.value; });
    }

    var form = S.$("#signin");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault(); // the browser has already run type/required validation
        email = S.$("#email").value;
        window.location.href = "index.html";
      });
    }

    var check = S.$("#remember");
    if (check) {
      check.addEventListener("click", function () {
        remember = !remember;
        render();
        S.$("#remember").focus(); // the re-render replaced the button under the cursor
      });
    }
  }

  render();
})(window.SKYRO);
