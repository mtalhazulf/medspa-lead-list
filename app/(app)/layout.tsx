import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/dal/auth";
import { getPipelineNav } from "@/lib/dal/leads";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, nav] = await Promise.all([requireUser(), getPipelineNav()]);

  return (
    <AppShell user={user} nav={nav}>
      {children}
    </AppShell>
  );
}
