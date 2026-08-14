import type { Metadata } from "next";
import Link from "next/link";

import { StatusPill } from "@/components/status-pill";
import { getDashboardData } from "@/lib/dal/leads";
import { formatCurrency, formatDate, formatRelative, formatNumber, isOverdue } from "@/lib/format";
import { activityMeta, LEAD_STATUSES, statusMeta } from "@/lib/pipeline";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { stats, statusCounts, stateCounts, recentActivity, followUps } = await getDashboardData();

  const countByStatus = new Map(statusCounts.map((s) => [s.status, s.count]));
  const totalForBars = Math.max(1, stats.total);
  const contactRate = stats.total > 0 ? Math.round((stats.worked / stats.total) * 100) : 0;
  const winRate = stats.worked > 0 ? Math.round((stats.won / stats.worked) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Pipeline overview</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {formatNumber(stats.total)} med spas in the list · {formatNumber(stats.with_email)} with
            an email on file
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/leads?due=week&sort=follow_up" className="btn-secondary">
            Follow-ups due
          </Link>
          <Link href="/leads?status=new&sort=reviews" className="btn-primary">
            Work the queue
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatCard label="Total leads" value={formatNumber(stats.total)} />
        <StatCard label="Worked" value={formatNumber(stats.worked)} hint={`${contactRate}% of list`} />
        <StatCard
          label="Warm"
          value={formatNumber(stats.interested)}
          hint="interested → proposal"
          tone="emerald"
        />
        <StatCard label="Won" value={formatNumber(stats.won)} hint={`${winRate}% of worked`} tone="green" />
        <StatCard
          label="Open pipeline"
          value={formatCurrency(stats.pipeline_value)}
          hint={`${formatCurrency(stats.won_value)} won`}
        />
        <StatCard
          label="Follow-ups due"
          value={formatNumber(stats.follow_ups_due)}
          hint={`${formatNumber(stats.contacted_last_7d)} touched in 7d`}
          tone={stats.follow_ups_due > 0 ? "amber" : undefined}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">Pipeline by stage</h2>
          <ul className="mt-4 space-y-2">
            {LEAD_STATUSES.map((meta) => {
              const count = countByStatus.get(meta.value) ?? 0;
              const pct = (count / totalForBars) * 100;
              return (
                <li key={meta.value}>
                  <Link
                    href={`/leads?status=${meta.value}`}
                    className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  >
                    <span className="w-32 shrink-0 text-sm text-slate-600 group-hover:text-slate-900">
                      {meta.label}
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <span
                        className="block h-full rounded-full bg-slate-900/80"
                        style={{ width: `${Math.max(pct, count > 0 ? 0.75 : 0)}%` }}
                      />
                    </span>
                    <span className="w-16 shrink-0 text-right text-sm tabular-nums text-slate-700">
                      {formatNumber(count)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Your follow-ups</h2>
            <Link href="/leads?due=week&sort=follow_up" className="text-xs text-slate-500 hover:text-slate-900">
              View all
            </Link>
          </div>

          {followUps.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Nothing scheduled in the next 7 days.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {followUps.map((lead) => (
                <li key={lead.id} className="py-2.5">
                  <Link href={`/leads/${lead.id}`} className="block hover:opacity-80">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-slate-900">
                        {lead.company_name}
                      </span>
                      <span
                        className={`shrink-0 text-xs tabular-nums ${
                          isOverdue(lead.next_follow_up_at) ? "text-rose-600" : "text-slate-500"
                        }`}
                      >
                        {formatDate(lead.next_follow_up_at)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <StatusPill status={lead.status} />
                      <span className="truncate">
                        {[lead.city, lead.state].filter(Boolean).join(", ")}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900">Top states</h2>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2 font-medium">State</th>
                <th className="pb-2 text-right font-medium">Leads</th>
                <th className="pb-2 text-right font-medium">Warm</th>
                <th className="pb-2 text-right font-medium">Won</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stateCounts.map((row) => (
                <tr key={row.state}>
                  <td className="py-2">
                    <Link href={`/leads?state=${row.state}`} className="hover:underline">
                      {row.state}
                    </Link>
                  </td>
                  <td className="py-2 text-right tabular-nums text-slate-700">
                    {formatNumber(row.total)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-emerald-700">
                    {formatNumber(row.interested)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-slate-900">
                    {formatNumber(row.won)}
                  </td>
                </tr>
              ))}
              {stateCounts.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-slate-500">
                    No leads imported yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900">Recent activity</h2>
          {recentActivity.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No activity logged yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {recentActivity.map((item) => (
                <li key={item.id} className="flex gap-3 text-sm">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs">
                    {activityMeta(item.type).icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-700">
                      <span className="font-medium text-slate-900">
                        {item.user?.full_name ?? "System"}
                      </span>{" "}
                      {item.type === "status_change" && item.to_status ? (
                        <>
                          moved a lead to{" "}
                          <span className="font-medium">{statusMeta(item.to_status).label}</span>
                        </>
                      ) : (
                        <>logged {activityMeta(item.type).label.toLowerCase()}</>
                      )}
                    </p>
                    {item.body && <p className="truncate text-slate-500">{item.body}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">
                    {formatRelative(item.occurred_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "emerald" | "green" | "amber";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "green"
        ? "text-green-700"
        : tone === "amber"
          ? "text-amber-700"
          : "text-slate-900";

  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
