import type { Route } from "next";
import Link from "next/link";

import { formatNumber } from "@/lib/format";
import { buildLeadQueryString, type LeadQuery } from "@/lib/leads/query";

/** Server-rendered links: pagination keeps working without JavaScript. */
export function Pagination({
  query,
  pageCount,
  total,
}: {
  query: LeadQuery;
  pageCount: number;
  total: number;
}) {
  if (total === 0) return null;

  const pages = pageWindow(query.page, pageCount);

  return (
    <nav className="flex items-center justify-between gap-3" aria-label="Pagination">
      <p className="text-sm text-slate-500">
        Page {formatNumber(query.page)} of {formatNumber(pageCount)}
      </p>

      <div className="flex items-center gap-1">
        <PageLink query={query} page={query.page - 1} disabled={query.page <= 1}>
          Previous
        </PageLink>

        {pages.map((page, i) =>
          page === null ? (
            <span key={`gap-${i}`} className="px-2 text-slate-400">
              …
            </span>
          ) : (
            <PageLink key={page} query={query} page={page} current={page === query.page}>
              {page}
            </PageLink>
          ),
        )}

        <PageLink query={query} page={query.page + 1} disabled={query.page >= pageCount}>
          Next
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({
  query,
  page,
  children,
  disabled,
  current,
}: {
  query: LeadQuery;
  page: number;
  children: React.ReactNode;
  disabled?: boolean;
  current?: boolean;
}) {
  if (disabled) {
    return (
      <span className="cursor-not-allowed rounded-lg px-3 py-1.5 text-sm text-slate-300">
        {children}
      </span>
    );
  }

  return (
    <Link
      href={`/leads${buildLeadQueryString({ page }, query)}` as Route}
      aria-current={current ? "page" : undefined}
      className={`rounded-lg px-3 py-1.5 text-sm transition ${
        current ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </Link>
  );
}

/** 1 … 4 5 [6] 7 8 … 120 */
function pageWindow(current: number, pageCount: number): (number | null)[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);

  const pages = new Set<number>([1, pageCount, current]);
  for (let offset = 1; offset <= 2; offset++) {
    if (current - offset > 1) pages.add(current - offset);
    if (current + offset < pageCount) pages.add(current + offset);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | null)[] = [];

  sorted.forEach((page, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined && page - previous > 1) result.push(null);
    result.push(page);
  });

  return result;
}
