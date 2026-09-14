import { Icon } from "../components/Icon";
import type { AppConfig } from "../types";

/* Floats over the scrolling body, so it earns glass. */
export function TopBar({ cfg }: { cfg: AppConfig }) {
  return (
    <header className="topbar glass">
      <span className="beta">Beta</span>
      <div className="who">
        <span className="av">
          <Icon name="person" />
        </span>
        {cfg.account}
        <Icon name="expand_more" className="cv" />
      </div>
    </header>
  );
}
