import type { AppConfig } from "@/shared/types";

export const ADMIN: AppConfig = {
  home: "/",
  account: "Katarína Vrábľová",
  navLabel: "Navigácia administrátora",
  nav: [
    { href: "/", icon: "monitoring", label: "Prehľad" },
    { href: "/menu", icon: "edit_note", label: "Menu" },
    { href: "/oznamy", icon: "campaign", label: "Oznamy" },
    { href: "/ziaci", icon: "group", label: "Žiaci" },
    { href: "/schranka", icon: "inbox", label: "Schránka", badge: 6 },
  ],
};
