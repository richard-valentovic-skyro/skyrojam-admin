/* The shape each app fills in to describe its own side of the product.
   student/src/lib/nav.ts and admin/src/lib/nav.ts each export one of these. */

export type NavItem = { href: string; icon: string; label: string; badge?: number };

export type AppConfig = {
  /** Where the logo links to. */
  home: string;
  /** Who is signed in, shown in the topbar. */
  account: string;
  /** aria-label for the rail. */
  navLabel: string;
  nav: NavItem[];
};
