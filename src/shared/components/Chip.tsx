import type { Status } from "../lib/data";

export function Chip({ st, children }: { st: Status | "imp"; children: React.ReactNode }) {
  return (
    <span className={`chip ${st}`}>
      <i />
      {children}
    </span>
  );
}
