"use client";

import { Suspense, useCallback, useEffect, useState } from "react";

import { AppSidebar, type SidebarMode } from "@/components/app-sidebar";
import { SessionSync } from "@/components/session-sync";
import { IconChevron, IconMenu } from "@/components/sidebar-icons";
import type { PipelineNav } from "@/lib/leads/types";

const STORAGE_KEY = "lead-desk.sidebar";

function isMode(value: string | null | undefined): value is SidebarMode {
  return value === "open" || value === "rail" || value === "hidden";
}

function writeMode(mode: SidebarMode) {
  document.documentElement.dataset.sidebar = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* private mode */
  }
}

export function AppShell({
  user,
  nav,
  children,
}: {
  user: { fullName: string; email: string };
  nav: PipelineNav;
  children: React.ReactNode;
}) {
  const [mode, setMode] = useState<SidebarMode>("open");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const stored = document.documentElement.dataset.sidebar;
    if (isMode(stored)) setMode(stored);
  }, []);

  const apply = useCallback((next: SidebarMode) => {
    setMode(next);
    writeMode(next);
  }, []);

  const expand = useCallback(() => {
    apply("open");
    setMobileOpen(true);
  }, [apply]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;

      if (event.key === "Escape") {
        setMobileOpen(false);
        return;
      }

      if (typing) return;

      if (event.key === "[" || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b")) {
        event.preventDefault();
        apply(mode === "hidden" ? "open" : "hidden");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [apply, mode]);

  const collapseLabel = mode === "rail" ? "Expand sidebar" : "Collapse to icons";

  return (
    <div className="app-frame min-h-screen">
      <SessionSync />

      <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-slate-200 bg-white/90 px-3 backdrop-blur lg:hidden">
        <button
          type="button"
          className="btn-ghost h-9 w-9 p-0"
          onClick={() => setMobileOpen(true)}
          aria-label="Open lead tracking"
        >
          <IconMenu className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold tracking-tight text-slate-900">OC Lead Desk</span>
        {nav.stats.follow_ups_due > 0 && (
          <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-amber-800">
            {nav.stats.follow_ups_due} due
          </span>
        )}
      </header>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden"
          aria-label="Close lead tracking"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="app-sidebar-slot" aria-hidden="true" />

      <Suspense fallback={null}>
        <AppSidebar
          user={user}
          nav={nav}
          mobileOpen={mobileOpen}
          onRequestOpen={expand}
          onNavigate={() => setMobileOpen(false)}
        />
      </Suspense>

      <button
        type="button"
        className="sidebar-collapse"
        onClick={(event) => {
          if (event.shiftKey) apply("hidden");
          else apply(mode === "rail" ? "open" : "rail");
        }}
        aria-label={collapseLabel}
        title={`${collapseLabel} · Shift-click or [ hides completely`}
      >
        <IconChevron dir={mode === "rail" ? "right" : "left"} className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        className="sidebar-reopen"
        onClick={() => apply("open")}
        aria-label="Show lead tracking"
        title="Show lead tracking ([)"
      >
        <IconChevron dir="right" className="h-4 w-4" />
        {nav.stats.follow_ups_due > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
            {nav.stats.follow_ups_due > 99 ? "99+" : nav.stats.follow_ups_due}
          </span>
        )}
      </button>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
