import type { ReactNode } from "react";
import { Rail } from "./Rail";
import { TopBar } from "./TopBar";
import type { AppConfig } from "../types";

/* Shared chrome for both apps. Each app passes its own config. */
export function AppShell({ cfg, children }: { cfg: AppConfig; children: ReactNode }) {
  return (
    <>
      <div className="mesh" />
      <Rail cfg={cfg} />
      <div className="main">
        <TopBar cfg={cfg} />
        <div className="page">{children}</div>
      </div>
    </>
  );
}
