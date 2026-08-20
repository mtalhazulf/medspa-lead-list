"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  IconClock,
  IconGrid,
  IconInbox,
  IconList,
  IconMark,
  IconOpen,
  IconPerson,
  IconSearch,
  IconUnassigned,
} from "@/components/sidebar-icons";
import { signOut } from "@/lib/actions/auth";
import { buildLeadQueryString } from "@/lib/leads/query";
import type { PipelineNav } from "@/lib/leads/types";
import { LEAD_STATUSES, WARM_STATUSES, type StatusMeta } from "@/lib/pipeline";
import type { LeadStatus } from "@/lib/types/database";

export type SidebarMode = "open" | "rail" | "hidden";

const STAGE_DOT: Record<LeadStatus, string> = {
  new: "bg-slate-400",
  contacted: "bg-sky-500",
  follow_up: "bg-indigo-500",
  interested: "bg-emerald-500",
  meeting_booked: "bg-teal-500",
  proposal_sent: "bg-violet-500",
  won: "bg-green-600",
  lost: "bg-rose-500",
  not_interested: "bg-orange-400",
  unqualified: "bg-stone-400",
  do_not_contact: "bg-zinc-800",
};

function compactCount(n: number): string {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

function sameStatuses(a: string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((s) => set.has(s));
}

function parseList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

interface Props {
  user: { fullName: string; email: string };
  nav: PipelineNav;
  mobileOpen: boolean;
  onRequestOpen: () => void;
  onNavigate: () => void;
}

export function AppSidebar({
  user,
  nav,
  mobileOpen,
  onRequestOpen,
  onNavigate,
}: Props) {
  const pathname = usePathname();
  const params = useSearchParams();
  const countByStatus = new Map(
    nav.statusCounts.map((s) => [s.status, s.count]),
  );

  const statuses = parseList(params.get("status"));
  const due = params.get("due");
  const owner = params.get("owner");
  const onLeads = pathname === "/leads";
  const onLeadDetail = pathname.startsWith("/leads/");

  const allLeadsActive = onLeads && !statuses.length && !due && !owner;
  const warmActive =
    onLeads && sameStatuses(statuses, WARM_STATUSES) && !due && !owner;
  const newCount = countByStatus.get("new") ?? 0;

  return (
    <aside
      className={`app-sidebar flex flex-col ${mobileOpen ? "is-mobile-open" : ""}`}
      aria-label="Lead tracking"
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200/80 px-3">
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-2 text-slate-900"
          title="OC Lead Desk"
        >
          <IconMark className="h-5 w-5 shrink-0" />
          <span className="sidebar-copy truncate text-sm font-semibold tracking-tight">
            OC Lead Desk
          </span>
        </Link>
      </div>

      <SidebarSearch onRequestOpen={onRequestOpen} />

      <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-2">
        <TrackLink
          href="/dashboard"
          active={pathname === "/dashboard"}
          icon={<IconGrid className="h-4 w-4" />}
          label="Board"
          onNavigate={onNavigate}
        />
        <TrackLink
          href="/leads"
          active={allLeadsActive || onLeadDetail}
          icon={<IconList className="h-4 w-4" />}
          label="All leads"
          count={nav.stats.total}
          onNavigate={onNavigate}
        />

        <p className="sidebar-copy px-2 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Work
        </p>
        <TrackLink
          href={`/leads${buildLeadQueryString({ due: "overdue", sort: "follow_up" })}`}
          active={onLeads && due === "overdue"}
          icon={<IconClock className="h-4 w-4" />}
          label="Due now"
          count={nav.stats.follow_ups_due}
          alert={nav.stats.follow_ups_due > 0}
          onNavigate={onNavigate}
        />
        <TrackLink
          href={`/leads${buildLeadQueryString({ due: "week", sort: "follow_up" })}`}
          active={onLeads && due === "week"}
          icon={<IconClock className="h-4 w-4" />}
          label="This week"
          onNavigate={onNavigate}
        />
        <TrackLink
          href={`/leads${buildLeadQueryString({ owner: "me" })}`}
          active={onLeads && owner === "me"}
          icon={<IconPerson className="h-4 w-4" />}
          label="Assigned to me"
          onNavigate={onNavigate}
        />
        <TrackLink
          href={`/leads${buildLeadQueryString({ owner: "unassigned" })}`}
          active={onLeads && owner === "unassigned"}
          icon={<IconUnassigned className="h-4 w-4" />}
          label="Unassigned"
          count={nav.stats.unassigned}
          onNavigate={onNavigate}
        />
        <TrackLink
          href={`/leads${buildLeadQueryString({ status: ["new"], sort: "reviews" })}`}
          active={onLeads && sameStatuses(statuses, ["new"]) && !due}
          icon={<IconInbox className="h-4 w-4" />}
          label="New queue"
          count={newCount}
          onNavigate={onNavigate}
        />
        <TrackLink
          href={`/leads${buildLeadQueryString({ status: [...WARM_STATUSES] })}`}
          active={warmActive}
          icon={<IconOpen className="h-4 w-4" />}
          label="Warm"
          count={nav.stats.interested}
          tone="emerald"
          onNavigate={onNavigate}
        />

        <p className="sidebar-copy px-2 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Pipeline
        </p>
        <ul className="space-y-0.5">
          {LEAD_STATUSES.map((meta) => (
            <li key={meta.value}>
              <StageLink
                meta={meta}
                count={countByStatus.get(meta.value) ?? 0}
                active={
                  onLeads &&
                  sameStatuses(statuses, [meta.value]) &&
                  !due &&
                  !owner
                }
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-slate-200/80 p-2">
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white"
            title={user.email}
          >
            {initials(user.fullName)}
          </span>
          <div className="sidebar-copy min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-slate-800">
              {user.fullName}
            </p>
            <p className="truncate text-[11px] text-slate-400">{user.email}</p>
          </div>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="btn-ghost mt-1 w-full justify-start px-2 text-xs"
          >
            <span className="sidebar-copy">Sign out</span>
            <span className="rail-only" aria-hidden="true">
              Out
            </span>
          </button>
        </form>
      </div>
    </aside>
  );
}

function SidebarSearch({ onRequestOpen }: { onRequestOpen: () => void }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(params.get("q") ?? "");
  }, [params]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onRequestOpen();
        window.setTimeout(() => inputRef.current?.focus(), 0);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onRequestOpen]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const qs = buildLeadQueryString({ q: value.trim(), page: 1 });
    router.push(`/leads${qs}` as Route);
  }

  return (
    <div className="border-b border-slate-200/80 px-2 py-2">
      <button
        type="button"
        className="rail-only btn-ghost relative h-9 w-full text-slate-500"
        onClick={() => {
          onRequestOpen();
          window.setTimeout(() => inputRef.current?.focus(), 50);
        }}
        title="Search leads (⌘K)"
        aria-label="Search leads"
      >
        <IconSearch className="h-4 w-4" />
      </button>
      <form onSubmit={onSubmit} className="sidebar-copy">
        <label className="relative block">
          <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            type="search"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Find a spa…"
            className="input h-9 pl-8 pr-10 text-sm"
            aria-label="Search leads"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-400 sm:inline">
            ⌘K
          </kbd>
        </label>
      </form>
    </div>
  );
}

function TrackLink({
  href,
  active,
  icon,
  label,
  count,
  alert,
  tone,
  onNavigate,
}: {
  href: string;
  active: boolean;
  icon: ReactNode;
  label: string;
  count?: number;
  alert?: boolean;
  tone?: "emerald";
  onNavigate: () => void;
}) {
  const title = count != null ? `${label} · ${compactCount(count)}` : label;
  return (
    <Link
      href={href as Route}
      title={title}
      onClick={onNavigate}
      className={`relative flex h-9 items-center gap-2 rounded-lg px-2 text-sm transition ${
        active
          ? "bg-slate-900 text-white"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className="sidebar-copy min-w-0 flex-1 truncate">{label}</span>
      {count != null && count > 0 && (
        <span
          className={`sidebar-count tabular-nums ${
            active
              ? "text-white/80"
              : alert
                ? "text-amber-700"
                : tone === "emerald"
                  ? "text-emerald-700"
                  : "text-slate-400"
          }`}
        >
          {compactCount(count)}
        </span>
      )}
    </Link>
  );
}

function StageLink({
  meta,
  count,
  active,
  onNavigate,
}: {
  meta: StatusMeta;
  count: number;
  active: boolean;
  onNavigate: () => void;
}) {
  const href = `/leads${buildLeadQueryString({ status: [meta.value] })}`;
  return (
    <Link
      href={href as Route}
      title={`${meta.label} · ${compactCount(count)}`}
      onClick={onNavigate}
      className={`relative flex h-8 items-center gap-2 rounded-lg px-2 text-[13px] transition ${
        active
          ? "bg-slate-900 text-white"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${active ? "bg-white" : STAGE_DOT[meta.value]}`}
      />
      <span className="sidebar-copy min-w-0 flex-1 truncate">{meta.label}</span>
      <span
        className={`sidebar-count tabular-nums ${active ? "text-white/80" : "text-slate-400"}`}
      >
        {compactCount(count)}
      </span>
    </Link>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase();
}
