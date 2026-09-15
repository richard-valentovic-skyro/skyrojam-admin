/* What this app is: its nav and who is signed in.
   The student app has its own copy with its own config. */
window.SKYRO = window.SKYRO || {};
window.SKYRO.APP = {
  home: "index.html",
  account: "",
  navLabel: "Navigácia administrátora",
  nav: [
    { href: "index.html",  icon: "monitoring", label: "Prehľad" },
    { href: "menu.html",   icon: "edit_note",  label: "Menu" },
    { href: "ziaci.html",  icon: "group",      label: "Žiaci" },
    { href: "oznamy.html", icon: "campaign",   label: "Oznamy" }
  ]
};
