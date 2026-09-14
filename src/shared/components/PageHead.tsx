import type { ReactNode } from "react";

/* The phone's app bar, reborn as a page header. */
export function PageHead({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-end gap-5 mb-8 flex-wrap">
      <div>
        <h1 className="!mb-1">{title}</h1>
        {sub ? (
          <p className="!m-0 text-[15px] font-semibold" style={{ color: "var(--ink-2)" }}>
            {sub}
          </p>
        ) : null}
      </div>
      {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
