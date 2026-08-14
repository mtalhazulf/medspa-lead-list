import type { Metadata } from "next";

import { LeadFilters } from "@/components/leads/lead-filters";
import { LeadsTable } from "@/components/leads/leads-table";
import { Pagination } from "@/components/leads/pagination";
import { listTeammates } from "@/lib/dal/auth";
import { getFilterOptions, listLeads } from "@/lib/dal/leads";
import { formatNumber } from "@/lib/format";
import { parseLeadQuery, type RawSearchParams } from "@/lib/leads/query";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const query = parseLeadQuery(await searchParams);

  const [result, options, teammates] = await Promise.all([
    listLeads(query),
    getFilterOptions(),
    listTeammates(),
  ]);

  const from = result.total === 0 ? 0 : (result.page - 1) * result.perPage + 1;
  const to = Math.min(result.page * result.perPage, result.total);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Leads</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {result.total === 0
              ? "No leads match these filters"
              : `Showing ${formatNumber(from)}–${formatNumber(to)} of ${formatNumber(result.total)}`}
          </p>
        </div>
      </div>

      <LeadFilters
        query={query}
        states={options.states}
        categories={options.categories}
        teammates={teammates}
      />

      <LeadsTable rows={result.rows} query={query} teammates={teammates} total={result.total} />

      <Pagination query={query} pageCount={result.pageCount} total={result.total} />
    </div>
  );
}
