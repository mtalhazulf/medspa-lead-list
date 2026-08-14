"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";

import { bulkUpdateLeads, getMatchingLeadIds, setLeadStatus } from "@/lib/actions/leads";
import {
  formatDate,
  formatNumber,
  formatRelative,
  instagramHandle,
  instagramHref,
  isOverdue,
  prettyDomain,
  telHref,
  toHref,
} from "@/lib/format";
import { buildLeadQueryString, type LeadQuery } from "@/lib/leads/query";
import type { LeadListItem, Teammate } from "@/lib/leads/types";
import { LEAD_STATUSES, PRIORITY_LABELS, statusMeta } from "@/lib/pipeline";
import type { LeadStatus } from "@/lib/types/database";

interface Props {
  rows: LeadListItem[];
  query: LeadQuery;
  teammates: Teammate[];
  total: number;
}

export function LeadsTable({ rows, query, total }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [optimisticRows, applyOptimistic] = useOptimistic(
    rows,
    (state: LeadListItem[], patch: { id: string; status: LeadStatus }) =>
      state.map((row) => (row.id === patch.id ? { ...row, status: patch.status } : row)),
  );

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggleAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function changeStatus(id: string, status: LeadStatus) {
    startTransition(async () => {
      applyOptimistic({ id, status });
      const result = await setLeadStatus(id, status);
      setMessage({ ok: result.ok, text: result.message });
      if (result.ok) router.refresh();
    });
  }

  function selectAllMatching() {
    startTransition(async () => {
      const ids = await getMatchingLeadIds(Object.fromEntries(searchParams.entries()));
      setSelected(new Set(ids));
      setMessage({
        ok: true,
        text:
          ids.length < total
            ? `Selected the first ${formatNumber(ids.length)} matching leads (cap reached)`
            : `Selected ${formatNumber(ids.length)} matching leads`,
      });
    });
  }

  function runBulk(patch: Parameters<typeof bulkUpdateLeads>[1]) {
    const ids = [...selected];
    if (ids.length === 0) return;
    startTransition(async () => {
      const result = await bulkUpdateLeads(ids, patch);
      setMessage({ ok: result.ok, text: result.message });
      if (result.ok) {
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  const exportHref = `/api/leads/export${buildLeadQueryString({}, query)}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {selected.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">
            <span className="font-medium">{formatNumber(selected.size)} selected</span>

            <select
              className="rounded-md border-0 bg-slate-800 px-2 py-1 text-sm text-white"
              value=""
              onChange={(e) => e.target.value && runBulk({ status: e.target.value as LeadStatus })}
              aria-label="Set status for selected leads"
              disabled={isPending}
            >
              <option value="">Set status…</option>
              {LEAD_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="rounded-md bg-slate-800 px-2 py-1 hover:bg-slate-700"
              onClick={() => runBulk({ owner: "me" })}
              disabled={isPending}
            >
              Assign to me
            </button>

            <button
              type="button"
              className="rounded-md bg-slate-800 px-2 py-1 hover:bg-slate-700"
              onClick={() => runBulk({ nextFollowUpAt: new Date().toISOString().slice(0, 10) })}
              disabled={isPending}
            >
              Follow up today
            </button>

            {selected.size < total && (
              <button
                type="button"
                className="rounded-md px-2 py-1 underline underline-offset-2 hover:bg-slate-800"
                onClick={selectAllMatching}
                disabled={isPending}
              >
                Select all {formatNumber(total)} matching
              </button>
            )}

            <button
              type="button"
              className="rounded-md px-2 py-1 text-slate-300 hover:bg-slate-800"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Select rows to update several leads at once.</p>
        )}

        <a href={exportHref} className="btn-secondary ml-auto text-sm">
          Export CSV
        </a>
      </div>

      {message && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            message.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"
          }`}
          role="status"
        >
          {message.text}
        </p>
      )}

      <div className={`card overflow-x-auto ${isPending ? "opacity-70" : ""}`}>
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/80 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleAllOnPage}
                  aria-label="Select all rows on this page"
                  className="h-4 w-4 rounded border-slate-300"
                />
              </th>
              <th className="px-3 py-2.5 font-medium">Company</th>
              <th className="px-3 py-2.5 font-medium">Contact</th>
              <th className="px-3 py-2.5 text-right font-medium">Google</th>
              <th className="px-3 py-2.5 text-right font-medium">Loc.</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Owner</th>
              <th className="px-3 py-2.5 font-medium">Follow-up</th>
              <th className="px-3 py-2.5 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {optimisticRows.map((lead) => {
              const website = toHref(lead.website);
              const insta = instagramHref(lead.instagram);
              const tel = telHref(lead.phone);
              const meta = statusMeta(lead.status);

              return (
                <tr key={lead.id} className={selected.has(lead.id) ? "bg-slate-50" : undefined}>
                  <td className="px-3 py-2.5 align-top">
                    <input
                      type="checkbox"
                      checked={selected.has(lead.id)}
                      onChange={() => toggleOne(lead.id)}
                      aria-label={`Select ${lead.company_name}`}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </td>

                  <td className="max-w-xs px-3 py-2.5 align-top">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {lead.company_name}
                    </Link>
                    <div className="mt-0.5 truncate text-xs text-slate-500">
                      {[lead.city, lead.state].filter(Boolean).join(", ") || "—"}
                      {lead.primary_category ? ` · ${lead.primary_category}` : ""}
                    </div>
                    {lead.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {lead.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>

                  <td className="px-3 py-2.5 align-top text-xs">
                    <div className="flex flex-col gap-0.5">
                      {tel ? (
                        <a href={tel} className="text-slate-700 hover:underline">
                          {lead.phone}
                        </a>
                      ) : (
                        <span className="text-slate-400">no phone</span>
                      )}
                      {lead.email ? (
                        <a
                          href={`mailto:${lead.email}`}
                          className="truncate text-slate-700 hover:underline"
                        >
                          {lead.email}
                        </a>
                      ) : (
                        <span className="text-slate-400">no email</span>
                      )}
                      <div className="flex gap-2 text-slate-500">
                        {website && (
                          <a
                            href={website}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="hover:underline"
                          >
                            {prettyDomain(lead.website)}
                          </a>
                        )}
                        {insta && (
                          <a
                            href={insta}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="hover:underline"
                          >
                            {instagramHandle(lead.instagram)}
                          </a>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="whitespace-nowrap px-3 py-2.5 align-top text-right tabular-nums">
                    {lead.google_rating !== null ? (
                      <>
                        <span className="font-medium text-slate-900">{lead.google_rating}</span>
                        <span className="text-amber-500">★</span>
                        <div className="text-xs text-slate-500">
                          {formatNumber(lead.google_reviews)} reviews
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  <td className="px-3 py-2.5 align-top text-right tabular-nums text-slate-700">
                    {lead.num_locations ?? "—"}
                  </td>

                  <td className="px-3 py-2.5 align-top">
                    <select
                      value={lead.status}
                      onChange={(e) => changeStatus(lead.id, e.target.value as LeadStatus)}
                      className={`rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${meta.className}`}
                      aria-label={`Status for ${lead.company_name}`}
                    >
                      {LEAD_STATUSES.map((s) => (
                        <option key={s.value} value={s.value} className="bg-white text-slate-900">
                          {s.label}
                        </option>
                      ))}
                    </select>
                    {lead.priority > 0 && (
                      <div className="mt-1 text-[11px] text-slate-500">
                        {PRIORITY_LABELS[lead.priority]} priority
                      </div>
                    )}
                  </td>

                  <td className="px-3 py-2.5 align-top text-xs text-slate-600">
                    {lead.owner?.full_name ?? lead.owner?.email ?? (
                      <span className="text-slate-400">unassigned</span>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-3 py-2.5 align-top text-xs">
                    {lead.next_follow_up_at ? (
                      <span className={isOverdue(lead.next_follow_up_at) ? "text-rose-600" : "text-slate-600"}>
                        {formatDate(lead.next_follow_up_at)}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                    <div className="text-[11px] text-slate-400">
                      {lead.last_contacted_at
                        ? `touched ${formatRelative(lead.last_contacted_at)}`
                        : "never contacted"}
                    </div>
                  </td>

                  <td className="whitespace-nowrap px-3 py-2.5 align-top text-xs text-slate-500">
                    {formatRelative(lead.updated_at)}
                  </td>
                </tr>
              );
            })}

            {optimisticRows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-sm text-slate-500">
                  No leads match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
