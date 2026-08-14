import "server-only";

import { cache } from "react";

import { requireUser } from "@/lib/dal/auth";
import { createClient } from "@/lib/supabase/server";
import { SORT_FIELDS, toPrefixTsQuery, type LeadQuery } from "@/lib/leads/query";
import type { ActivityItem, LeadDetail, LeadListItem } from "@/lib/leads/types";
import type { DashboardStats, LeadStatus } from "@/lib/types/database";

export type { ActivityItem, LeadDetail, LeadListItem };

/** Columns the leads table needs — deliberately narrower than the full row. */
const LIST_COLUMNS = `
  id, company_name, city, state, postal_code, phone, email, website,
  google_rating, google_reviews, num_locations, primary_category,
  status, priority, tags, owner_id, next_follow_up_at, last_contacted_at,
  updated_at, instagram, booking_url,
  owner:profiles!leads_owner_id_fkey (id, full_name, email)
` as const;

export interface LeadListResult {
  rows: LeadListItem[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
}

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function listLeads(query: LeadQuery): Promise<LeadListResult> {
  const user = await requireUser();
  const supabase = await createClient();

  let builder = supabase.from("leads").select(LIST_COLUMNS, { count: "exact" });

  if (query.q) {
    const tsQuery = toPrefixTsQuery(query.q);
    if (tsQuery) {
      builder = builder.textSearch("search_tsv", tsQuery, { config: "simple" });
    } else {
      // Query was punctuation only (e.g. "+1-509"): fall back to a name match.
      builder = builder.ilike("company_name", `%${query.q}%`);
    }
  }

  if (query.status.length) builder = builder.in("status", query.status);
  if (query.state.length) builder = builder.in("state", query.state);
  if (query.category) builder = builder.eq("primary_category", query.category);
  if (query.tag) builder = builder.contains("tags", [query.tag]);

  if (query.owner === "me") builder = builder.eq("owner_id", user.id);
  else if (query.owner === "unassigned") builder = builder.is("owner_id", null);
  else if (query.owner) builder = builder.eq("owner_id", query.owner);

  if (query.minRating !== null) builder = builder.gte("google_rating", query.minRating);
  if (query.minReviews !== null) builder = builder.gte("google_reviews", query.minReviews);
  if (query.maxReviews !== null) builder = builder.lte("google_reviews", query.maxReviews);
  if (query.minLocations !== null) builder = builder.gte("num_locations", query.minLocations);

  for (const flag of query.has) {
    const column = flag === "booking" ? "booking_url" : flag;
    builder = builder.not(column, "is", null).neq(column, "");
  }

  if (query.due === "overdue") {
    builder = builder.lt("next_follow_up_at", isoDaysFromNow(0));
  } else if (query.due === "today") {
    builder = builder.eq("next_follow_up_at", isoDaysFromNow(0));
  } else if (query.due === "week") {
    builder = builder.lte("next_follow_up_at", isoDaysFromNow(7)).not("next_follow_up_at", "is", null);
  }

  const sortColumn = SORT_FIELDS[query.sort].column;
  const from = (query.page - 1) * query.perPage;

  const { data, error, count } = await builder
    .order(sortColumn, { ascending: query.dir === "asc", nullsFirst: false })
    // Deterministic tie-break so pagination never repeats or skips a row.
    .order("id", { ascending: true })
    .range(from, from + query.perPage - 1);

  if (error) throw new Error(`Failed to load leads: ${error.message}`);

  const total = count ?? 0;
  return {
    rows: (data ?? []) as unknown as LeadListItem[],
    total,
    page: query.page,
    perPage: query.perPage,
    pageCount: Math.max(1, Math.ceil(total / query.perPage)),
  };
}

/** Every lead id matching the current filters — used by "select all matching". */
export async function listLeadIdsForQuery(query: LeadQuery, limit = 5000): Promise<string[]> {
  const page = { ...query, page: 1, perPage: Math.min(limit, 200) as LeadQuery["perPage"] };
  const ids: string[] = [];

  // Walk pages rather than pulling 40k ids in a single response.
  for (let p = 1; ids.length < limit; p++) {
    const result = await listLeads({ ...page, page: p });
    ids.push(...result.rows.map((r) => r.id));
    if (p >= result.pageCount || result.rows.length === 0) break;
  }

  return ids.slice(0, limit);
}

export const getLead = cache(async (id: string): Promise<LeadDetail | null> => {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("leads")
    .select("*, owner:profiles!leads_owner_id_fkey (id, full_name, email)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load lead: ${error.message}`);
  return (data as unknown as LeadDetail | null) ?? null;
});

export async function listLeadActivities(leadId: string, limit = 100): Promise<ActivityItem[]> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lead_activities")
    .select("*, user:profiles!lead_activities_user_id_fkey (id, full_name, email)")
    .eq("lead_id", leadId)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load activity: ${error.message}`);
  return (data ?? []) as unknown as ActivityItem[];
}

export interface DashboardData {
  stats: DashboardStats;
  statusCounts: { status: LeadStatus; count: number }[];
  stateCounts: { state: string; total: number; interested: number; won: number }[];
  recentActivity: ActivityItem[];
  followUps: LeadListItem[];
}

export async function getDashboardData(): Promise<DashboardData> {
  const user = await requireUser();
  const supabase = await createClient();

  // Independent reads — run them concurrently, not as a waterfall.
  const [statsRes, statusRes, stateRes, activityRes, followUpRes] = await Promise.all([
    supabase.rpc("lead_dashboard_stats"),
    supabase.rpc("lead_status_counts"),
    supabase.rpc("lead_state_counts", { limit_count: 10 }),
    supabase
      .from("lead_activities")
      .select("*, user:profiles!lead_activities_user_id_fkey (id, full_name, email)")
      .order("occurred_at", { ascending: false })
      .limit(12),
    supabase
      .from("leads")
      .select(LIST_COLUMNS)
      .not("next_follow_up_at", "is", null)
      .lte("next_follow_up_at", isoDaysFromNow(7))
      .not("status", "in", "(won,lost,not_interested,do_not_contact)")
      .or(`owner_id.eq.${user.id},owner_id.is.null`)
      .order("next_follow_up_at", { ascending: true })
      .limit(10),
  ]);

  const emptyStats: DashboardStats = {
    total: 0,
    worked: 0,
    interested: 0,
    won: 0,
    pipeline_value: 0,
    won_value: 0,
    contacted_last_7d: 0,
    follow_ups_due: 0,
    unassigned: 0,
    with_email: 0,
    activities_last_7d: 0,
  };

  return {
    stats: (statsRes.data as DashboardStats | null) ?? emptyStats,
    statusCounts: statusRes.data ?? [],
    stateCounts: stateRes.data ?? [],
    recentActivity: (activityRes.data ?? []) as unknown as ActivityItem[],
    followUps: (followUpRes.data ?? []) as unknown as LeadListItem[],
  };
}

/** Filter dropdown options. Cached per request; both are small aggregates. */
export const getFilterOptions = cache(async () => {
  await requireUser();
  const supabase = await createClient();

  const [statesRes, categoriesRes] = await Promise.all([
    supabase.rpc("lead_state_counts", { limit_count: 60 }),
    supabase.rpc("lead_primary_categories", { limit_count: 30 }),
  ]);

  return {
    states: (statesRes.data ?? [])
      .map((s) => ({ value: s.state, count: s.total }))
      .sort((a, b) => a.value.localeCompare(b.value)),
    categories: (categoriesRes.data ?? []).map((c) => ({ value: c.category, count: c.total })),
  };
});
