import type { Metadata, Route } from "next";
import Link from "next/link";

import { ActivityTimeline } from "@/components/leads/activity-timeline";
import { listTeamActivity } from "@/lib/dal/leads";
import { formatNumber } from "@/lib/format";
import { ACTIVITY_TYPES } from "@/lib/pipeline";

export const metadata: Metadata = { title: "History" };

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; type?: string | string[] }>;
}) {
  const raw = await searchParams;
  const page = Math.max(1, Number(Array.isArray(raw.page) ? raw.page[0] : raw.page) || 1);
  const type = (Array.isArray(raw.type) ? raw.type[0] : raw.type) ?? "";
  const validType = ACTIVITY_TYPES.some((t) => t.value === type) ? type : "";

  const result = await listTeamActivity({ page, type: validType || undefined });

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Client history</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Who did what, on which client, and when.
          {result.total > 0 ? ` ${formatNumber(result.total)} events.` : ""}
        </p>
      </div>

      <nav className="flex flex-wrap gap-1.5" aria-label="Activity type">
        <FilterChip href="/history" active={!validType}>
          All
        </FilterChip>
        {ACTIVITY_TYPES.map((meta) => (
          <FilterChip
            key={meta.value}
            href={`/history?type=${meta.value}` as Route}
            active={validType === meta.value}
          >
            {meta.label}
          </FilterChip>
        ))}
      </nav>

      <section className="card p-5">
        <ActivityTimeline items={result.rows} showClient />
      </section>

      {result.pageCount > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="History pages">
          <span className="text-slate-500">
            Page {result.page} of {result.pageCount}
          </span>
          <div className="flex gap-2">
            {result.page > 1 && (
              <Link
                href={historyHref(result.page - 1, validType)}
                className="rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100"
              >
                Previous
              </Link>
            )}
            {result.page < result.pageCount && (
              <Link
                href={historyHref(result.page + 1, validType)}
                className="rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100"
              >
                Next
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}

function historyHref(page: number, type: string): Route {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return (qs ? `/history?${qs}` : "/history") as Route;
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: Route | "/history";
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href as Route}
      className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
        active ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-500 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {children}
    </Link>
  );
}
