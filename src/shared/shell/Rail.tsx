"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SkyroLogo } from "../components/SkyroLogo";
import { Icon } from "../components/Icon";
import type { AppConfig } from "../types";

/* The rail is the web app's own navigation — it replaces the phone's bottom
   tab bar. Same violet slab, same 52px tiles, same thin-stroke icons.
   Which items it shows comes from the app's config, not from the URL. */
export function Rail({ cfg }: { cfg: AppConfig }) {
  const pathname = usePathname();

  return (
    <nav className="rail" aria-label={cfg.navLabel}>
      <Link href={cfg.home} aria-label="Skyro Obedy">
        <SkyroLogo className="logo" />
      </Link>

      <div className="railnav">
        {cfg.nav.map((it) => {
          const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className="rbtn"
              title={it.label}
              aria-label={it.label}
              aria-current={active ? "page" : undefined}
            >
              <Icon name={it.icon} />
              {it.badge ? <span className="railbadge">{it.badge}</span> : null}
            </Link>
          );
        })}
      </div>

      <div className="railfoot">
        <Link href="/prihlasenie" className="rbtn" title="Odhlásiť sa" aria-label="Odhlásiť sa">
          <Icon name="logout" />
        </Link>
      </div>
    </nav>
  );
}
