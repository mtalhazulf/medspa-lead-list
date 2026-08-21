import type { Metadata, Route } from "next";
import Link from "next/link";

import { LeadFilters } from "@/components/leads/lead-filters";
import { LeadsTable } from "@/components/leads/leads-table";
import { Pagination } from "@/components/leads/pagination";
import { listTeammates } from "@/lib/dal/auth";
import { getFilterOptions, listCustomFields, listLeads } from "@/lib/dal/leads";
import { formatNumber } from "@/lib/format";
import { hasActiveFilters, parseLeadQuery, type RawSearchParams } from "@/lib/leads/query";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const query = parseLeadQuery(await searchParams);

  const [result, options, teammates, customFields] = await Promise.all([
    listLeads(query),
    getFilterOptions(),
    listTeammates(),
    listCustomFields(),
  ]);

  const from = result.total === 0 ? 0 : (result.page - 1) * result.perPage + 1;
  const to = Math.min(result.page * result.perPage, result.total);
  const filteredEmpty = result.total === 0 && hasActiveFilters(query);
  const emptyDesk = result.total === 0 && !hasActiveFilters(query);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Leads</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {emptyDesk
              ? "The list is empty until you import a spreadsheet."
              : filteredEmpty
                ? "No leads match these filters"
                : `Showing ${formatNumber(from)}–${formatNumber(to)} of ${formatNumber(result.total)}`}
          </p>
        </div>
        {!emptyDesk && <div id="leads-page-actions" className="flex items-center gap-2" />}
      </div>

      {emptyDesk ? (
        <section className="card max-w-xl p-6">
          <p className="text-sm font-medium text-slate-900">No leads in the list yet</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Import the client CSV or Excel file from Settings, then this table fills in.
          </p>
          <Link href={"/settings?tab=import" as Route} className="btn-primary mt-5">
            Import the list
          </Link>
        </section>
      ) : (
        <>
          <LeadFilters
            query={query}
            states={options.states}
            categories={options.categories}
            teammates={teammates}
            clientTypes={options.clientTypes}
            tags={options.tags}
          />

          <LeadsTable
            rows={result.rows}
            query={query}
            teammates={teammates}
            tags={options.tags}
            clientTypes={options.clientTypes}
            customFields={customFields}
            total={result.total}
          />

          <Pagination query={query} pageCount={result.pageCount} total={result.total} />
        </>
      )}
    </div>
  );
}
