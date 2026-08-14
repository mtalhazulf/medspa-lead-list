import Link from "next/link";

import { NavLink } from "@/components/nav-link";
import { SessionSync } from "@/components/session-sync";
import { signOut } from "@/lib/actions/auth";
import { requireUser } from "@/lib/dal/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-screen">
      <SessionSync />
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-4 sm:px-6">
          <Link href="/dashboard" className="text-sm font-semibold tracking-tight text-slate-900">
            Med Spa Lead Desk
          </Link>

          <nav className="flex items-center gap-1">
            <NavLink href="/dashboard">Dashboard</NavLink>
            <NavLink href="/leads">Leads</NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline" title={user.email}>
              {user.fullName}
            </span>
            <form action={signOut}>
              <button type="submit" className="btn-ghost text-sm">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
