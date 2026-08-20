"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  buildLeadQueryString,
  hasActiveFilters,
  HAS_FLAGS,
  PAGE_SIZES,
  SORT_FIELDS,
  type HasFlag,
  type LeadQuery,
} from "@/lib/leads/query";
import type { Teammate } from "@/lib/leads/types";
import { LEAD_STATUSES } from "@/lib/pipeline";
import type { LeadStatus } from "@/lib/types/database";

interface Props {
  query: LeadQuery;
  states: { value: string; count: number }[];
  categories: { value: string; count: number }[];
  teammates: Teammate[];
  clientTypes: { id: string; name: string }[];
  tags: { id: string; name: string }[];
}

const HAS_LABELS: Record<HasFlag, string> = {
  email: "Email",
  phone: "Phone",
  website: "Website",
  instagram: "Instagram",
  booking: "Online booking",
};

export function LeadFilters({ query, states, categories, teammates, clientTypes, tags }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(query.q);
  const [showAdvanced, setShowAdvanced] = useState(
    query.minRating !== null ||
      query.minReviews !== null ||
      query.maxReviews !== null ||
      query.minLocations !== null ||
      query.has.length > 0 ||
      Boolean(query.category),
  );
  const searchRef = useRef(query.q);

  /** Any filter change resets to page 1 — page numbers are meaningless across filters. */
  function apply(patch: Partial<LeadQuery>) {
    const next = buildLeadQueryString({ page: 1, ...patch }, query);
    startTransition(() => router.push(`/leads${next}` as Route));
  }

  // Debounce the search box so a 40k-row count query does not run per keystroke.
  useEffect(() => {
    if (search === searchRef.current) return;
    const timer = setTimeout(() => {
      searchRef.current = search;
      apply({ q: search });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    searchRef.current = query.q;
    setSearch(query.q);
  }, [query.q]);

  function toggleStatus(status: LeadStatus) {
    const next = query.status.includes(status)
      ? query.status.filter((s) => s !== status)
      : [...query.status, status];
    apply({ status: next });
  }

  function toggleHas(flag: HasFlag) {
    const next = query.has.includes(flag)
      ? query.has.filter((f) => f !== flag)
      : [...query.has, flag];
    apply({ has: next });
  }

  return (
    <div className={`card p-3 ${isPending ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, contact, city, category, email, phone…"
          className="input min-w-[14rem] flex-1"
          aria-label="Search leads"
        />

        <select
          className="input w-auto"
          value={`${query.sort}:${query.dir}`}
          onChange={(e) => {
            const [sort, dir] = e.target.value.split(":");
            apply({ sort: sort as LeadQuery["sort"], dir: dir as "asc" | "desc" });
          }}
          aria-label="Sort"
        >
          {Object.entries(SORT_FIELDS).map(([key, meta]) => (
            <optgroup key={key} label={meta.label}>
              <option value={`${key}:desc`}>{meta.label} ↓</option>
              <option value={`${key}:asc`}>{meta.label} ↑</option>
            </optgroup>
          ))}
        </select>

        <button
          type="button"
          className="btn-ghost h-9 text-sm"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
        >
          {showAdvanced ? "Fewer filters" : "More filters"}
        </button>

        {hasActiveFilters(query) && (
          <button
            type="button"
            className="btn-ghost h-9 text-sm text-rose-600 hover:bg-rose-50"
            onClick={() => startTransition(() => router.push("/leads"))}
          >
            Clear all
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          className="input w-auto"
          value={query.state[0] ?? ""}
          onChange={(e) => apply({ state: e.target.value ? [e.target.value] : [] })}
          aria-label="State"
        >
          <option value="">All states</option>
          {states.map((s) => (
            <option key={s.value} value={s.value}>
              {s.value} ({s.count})
            </option>
          ))}
        </select>

        <select
          className="input w-auto"
          value={query.clientType}
          onChange={(e) => apply({ clientType: e.target.value })}
          aria-label="Client type"
        >
          <option value="">All types</option>
          {clientTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <select
          className="input w-auto"
          value={query.tag}
          onChange={(e) => apply({ tag: e.target.value })}
          aria-label="Tag"
        >
          <option value="">Any tag</option>
          {tags.map((t) => (
            <option key={t.id} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>

        <select
          className="input w-auto"
          value={query.owner}
          onChange={(e) => apply({ owner: e.target.value })}
          aria-label="Owner"
        >
          <option value="">Any owner</option>
          <option value="me">Assigned to me</option>
          <option value="unassigned">Unassigned</option>
          {teammates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <select
          className="input w-auto"
          value={query.due ?? ""}
          onChange={(e) =>
            apply({ due: (e.target.value || null) as LeadQuery["due"], sort: "follow_up" })
          }
          aria-label="Follow-up window"
        >
          <option value="">Any follow-up</option>
          <option value="overdue">Overdue</option>
          <option value="today">Due today</option>
          <option value="week">Due within 7 days</option>
        </select>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {LEAD_STATUSES.map((meta) => {
          const active = query.status.includes(meta.value);
          return (
            <button
              key={meta.value}
              type="button"
              onClick={() => toggleStatus(meta.value)}
              aria-pressed={active}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition ${
                active ? meta.className : "bg-white text-slate-500 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      {showAdvanced && (
        <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label mb-1" htmlFor="min_rating">
              Min rating
            </label>
            <select
              id="min_rating"
              className="input"
              value={query.minRating ?? ""}
              onChange={(e) => apply({ minRating: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">Any</option>
              {[3, 3.5, 4, 4.5, 4.8].map((r) => (
                <option key={r} value={r}>
                  {r}+
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label mb-1" htmlFor="min_reviews">
              Min reviews
            </label>
            <input
              id="min_reviews"
              type="number"
              min={0}
              className="input"
              defaultValue={query.minReviews ?? ""}
              onBlur={(e) => apply({ minReviews: e.target.value ? Number(e.target.value) : null })}
            />
          </div>

          <div>
            <label className="label mb-1" htmlFor="min_locations">
              Min locations
            </label>
            <input
              id="min_locations"
              type="number"
              min={1}
              className="input"
              defaultValue={query.minLocations ?? ""}
              onBlur={(e) => apply({ minLocations: e.target.value ? Number(e.target.value) : null })}
            />
          </div>

          <div>
            <label className="label mb-1" htmlFor="category">
              Category
            </label>
            <select
              id="category"
              className="input"
              value={query.category}
              onChange={(e) => apply({ category: e.target.value })}
            >
              <option value="">Any category</option>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.value} ({c.count})
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <span className="label mb-1">Must have</span>
            <div className="flex flex-wrap gap-1.5">
              {HAS_FLAGS.map((flag) => {
                const active = query.has.includes(flag);
                return (
                  <button
                    key={flag}
                    type="button"
                    onClick={() => toggleHas(flag)}
                    aria-pressed={active}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition ${
                      active
                        ? "bg-slate-900 text-white ring-slate-900"
                        : "bg-white text-slate-500 ring-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {HAS_LABELS[flag]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="label mb-1" htmlFor="per">
              Rows per page
            </label>
            <select
              id="per"
              className="input"
              value={query.perPage}
              onChange={(e) => apply({ perPage: Number(e.target.value) as LeadQuery["perPage"] })}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
