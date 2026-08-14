import type { NextRequest } from "next/server";

import { getSessionUser } from "@/lib/dal/auth";
import { listLeads } from "@/lib/dal/leads";
import { parseLeadQuery, type RawSearchParams } from "@/lib/leads/query";
import type { LeadListItem } from "@/lib/leads/types";

/** Hard cap so one click can never pull the whole 40k list into a Worker response. */
const MAX_ROWS = 20_000;
const PAGE_SIZE = 200;

const COLUMNS: { header: string; value: (lead: LeadListItem) => string | number | null }[] = [
  { header: "Company Name", value: (l) => l.company_name },
  { header: "City", value: (l) => l.city },
  { header: "State", value: (l) => l.state },
  { header: "Postal Code", value: (l) => l.postal_code },
  { header: "Phone", value: (l) => l.phone },
  { header: "Email", value: (l) => l.email },
  { header: "Website", value: (l) => l.website },
  { header: "Instagram", value: (l) => l.instagram },
  { header: "Booking URL", value: (l) => l.booking_url },
  { header: "Category", value: (l) => l.primary_category },
  { header: "Google Rating", value: (l) => l.google_rating },
  { header: "Google Reviews", value: (l) => l.google_reviews },
  { header: "Locations", value: (l) => l.num_locations },
  { header: "Status", value: (l) => l.status },
  { header: "Priority", value: (l) => l.priority },
  { header: "Owner", value: (l) => l.owner?.full_name ?? l.owner?.email ?? "" },
  { header: "Next Follow Up", value: (l) => l.next_follow_up_at },
  { header: "Last Contacted", value: (l) => l.last_contacted_at },
  { header: "Tags", value: (l) => l.tags.join("; ") },
  { header: "Updated At", value: (l) => l.updated_at },
];

function csvCell(value: string | number | null): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  // Guard against spreadsheet formula injection on export.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw: RawSearchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const baseQuery = { ...parseLeadQuery(raw), page: 1, perPage: PAGE_SIZE as 200 };

  const encoder = new TextEncoder();
  let page = 1;
  let emitted = 0;
  let done = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`${COLUMNS.map((c) => c.header).join(",")}\n`));
    },
    async pull(controller) {
      if (done) return;

      try {
        const result = await listLeads({ ...baseQuery, page });
        const chunk = result.rows
          .map((lead) => COLUMNS.map((column) => csvCell(column.value(lead))).join(","))
          .join("\n");

        if (chunk) controller.enqueue(encoder.encode(`${chunk}\n`));

        emitted += result.rows.length;
        page += 1;
        done = page > result.pageCount || result.rows.length === 0 || emitted >= MAX_ROWS;
        if (done) controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
