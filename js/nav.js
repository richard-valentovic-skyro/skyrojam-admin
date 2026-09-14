/* What this app is: its nav, who is signed in, where the logo points.
   The student app has its own copy of this file with its own config. */
window.SKYRO = window.SKYRO || {};
window.SKYRO.APP = {
  home: "index.html",
  account: "Katarína Vrábľová",
  navLabel: "Navigácia administrátora",
  nav: [
    { href: "index.html",     icon: "monitoring", label: "Prehľad" },
    { href: "menu.html",      icon: "edit_note",  label: "Menu" },
    { href: "oznamy.html",    icon: "campaign",   label: "Oznamy" },
    { href: "ziaci.html",     icon: "group",      label: "Žiaci" },
    { href: "schranka.html",  icon: "inbox",      label: "Schránka", badge: 6 }
  ]
};
