import { AppShell } from "@/shared/shell/AppShell";
import { ADMIN } from "@/lib/nav";

export default function AdminLayout({ children }: LayoutProps<"/">) {
  return <AppShell cfg={ADMIN}>{children}</AppShell>;
}
