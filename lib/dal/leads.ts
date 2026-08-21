import "server-only";

import { cache } from "react";

import { requireUser } from "@/lib/dal/auth";
import { createClient } from "@/lib/supabase/server";
import { SORT_FIELDS, customSortSlug, isBuiltinSort, toPrefixTsQuery, type LeadQuery } from "@/lib/leads/query";
import type { ActivityItem, CatalogCustomField, LeadContact, LeadDetail, LeadListItem, PipelineNav } from "@/lib/leads/types";
import type { ActivityType, DashboardStats } from "@/lib/types/database";

export type { ActivityItem, LeadDetail, LeadListItem, PipelineNav };

/** Columns the leads table needs — deliberately narrower than the full row. */
const LIST_COLUMNS = `
  id, company_name, city, state, postal_code, phone, email, website,
  google_rating, google_reviews, num_locations, primary_category,
  client_type_id, contact_name, contact_email, contact_phone, contact_count,
  status, priority, tags, owner_id, next_follow_up_at, last_contacted_at,
  updated_at, instagram, booking_url, custom_data,
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
  if (query.clientType) builder = builder.eq("client_type_id", query.clientType);
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

  const fields = await listCustomFields();
  const from = (query.page - 1) * query.perPage;
  const ascending = query.dir === "asc";
  const customSlug = customSortSlug(query.sort);

  if (customSlug) {
    const field = fields.find((f) => f.slug === customSlug);
    const expr =
      field?.field_type === "number" || field?.field_type === "boolean"
        ? `custom_data->${customSlug}`
        : `custom_data->>${customSlug}`;
    builder = builder.order(expr, { ascending, nullsFirst: false });
  } else if (isBuiltinSort(query.sort)) {
    builder = builder.order(SORT_FIELDS[query.sort].column, { ascending, nullsFirst: false });
  } else {
    builder = builder.order("updated_at", { ascending: false, nullsFirst: false });
  }

  const { data, error, count } = await builder
    .order("id", { ascending: true })
    .range(from, from + query.perPage - 1);

  if (error) throw new Error(`Failed to load leads: ${error.message}`);

  const types = await listClientTypes();
  const typeById = new Map(types.map((t) => [t.id, t]));
  const total = count ?? 0;
  return {
    rows: ((data ?? []) as unknown as LeadListItem[]).map((row) => ({
      ...row,
      custom_data: row.custom_data ?? {},
      contact_count: row.contact_count ?? 0,
      client_type: row.client_type_id ? (typeById.get(row.client_type_id) ?? null) : null,
    })),
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
  if (!data) return null;

  const [types, contacts] = await Promise.all([listClientTypes(), listLeadContacts(id)]);
  const lead = data as unknown as LeadDetail;
  return {
    ...lead,
    custom_data: lead.custom_data ?? {},
    contact_count: lead.contact_count ?? contacts.length,
    client_type: lead.client_type_id
      ? (types.find((t) => t.id === lead.client_type_id) ?? null)
      : null,
    contacts,
  };
});

export async function listLeadContacts(leadId: string): Promise<LeadContact[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_contacts")
    .select(
      "id, lead_id, full_name, title, email, phone, linkedin, is_primary, do_not_contact, notes, last_contacted_at, sort_order, created_at, updated_at",
    )
    .eq("lead_id", leadId)
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    if (/lead_contacts|schema cache/i.test(error.message)) return [];
    throw new Error(`Failed to load contacts: ${error.message}`);
  }
  return (data ?? []) as LeadContact[];
}

export async function listLeadActivities(leadId: string, limit = 200): Promise<ActivityItem[]> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lead_activities")
    .select(
      "*, user:profiles!lead_activities_user_id_fkey (id, full_name, email), contact:lead_contacts!lead_activities_contact_id_fkey (id, full_name)",
    )
    .eq("lead_id", leadId)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (/contact|lead_contacts|schema cache/i.test(error.message)) {
      const retry = await supabase
        .from("lead_activities")
        .select("*, user:profiles!lead_activities_user_id_fkey (id, full_name, email)")
        .eq("lead_id", leadId)
        .order("occurred_at", { ascending: false })
        .limit(limit);
      if (retry.error) throw new Error(`Failed to load activity: ${retry.error.message}`);
      return (retry.data ?? []) as unknown as ActivityItem[];
    }
    throw new Error(`Failed to load activity: ${error.message}`);
  }
  return (data ?? []) as unknown as ActivityItem[];
}

export async function listTeamActivity(options: {
  page?: number;
  perPage?: number;
  type?: string;
}): Promise<{ rows: ActivityItem[]; total: number; page: number; pageCount: number }> {
  await requireUser();
  const supabase = await createClient();
  const page = Math.max(1, options.page ?? 1);
  const perPage = options.perPage ?? 40;
  const from = (page - 1) * perPage;

  let builder = supabase
    .from("lead_activities")
    .select(
      "*, user:profiles!lead_activities_user_id_fkey (id, full_name, email), lead:leads!lead_activities_lead_id_fkey (id, company_name), contact:lead_contacts!lead_activities_contact_id_fkey (id, full_name)",
      { count: "exact" },
    );

  if (options.type) builder = builder.eq("type", options.type as ActivityType);

  const { data, error, count } = await builder
    .order("occurred_at", { ascending: false })
    .range(from, from + perPage - 1);

  if (error) throw new Error(`Failed to load history: ${error.message}`);
  const total = count ?? 0;
  return {
    rows: (data ?? []) as unknown as ActivityItem[],
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
  };
}

const EMPTY_STATS: DashboardStats = {
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

/** Counts the sidebar needs on every authenticated page. Cached per request. */
export const getPipelineNav = cache(async (): Promise<PipelineNav> => {
  await requireUser();
  const supabase = await createClient();

  const [statsRes, statusRes] = await Promise.all([
    supabase.rpc("lead_dashboard_stats"),
    supabase.rpc("lead_status_counts"),
  ]);

  return {
    stats: (statsRes.data as DashboardStats | null) ?? EMPTY_STATS,
    statusCounts: (statusRes.data ?? []).map((row) => ({
      status: row.status,
      count: Number(row.count),
    })),
  };
});

export interface DashboardData extends PipelineNav {
  stateCounts: { state: string; total: number; interested: number; won: number }[];
  recentActivity: ActivityItem[];
  followUps: LeadListItem[];
}

export async function getDashboardData(): Promise<DashboardData> {
  const user = await requireUser();
  const supabase = await createClient();

  // Independent reads — run them concurrently, not as a waterfall.
  // getPipelineNav is request-cached, so the layout and this page share one round trip.
  const [nav, stateRes, activityRes, followUpRes] = await Promise.all([
    getPipelineNav(),
    supabase.rpc("lead_state_counts", { limit_count: 10 }),
    supabase
      .from("lead_activities")
      .select(
        "*, user:profiles!lead_activities_user_id_fkey (id, full_name, email), contact:lead_contacts!lead_activities_contact_id_fkey (id, full_name)",
      )
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

  return {
    ...nav,
    stateCounts: stateRes.data ?? [],
    recentActivity: (activityRes.data ?? []) as unknown as ActivityItem[],
    followUps: (followUpRes.data ?? []) as unknown as LeadListItem[],
  };
}

/** Filter dropdown options. Cached per request; both are small aggregates. */
export const getFilterOptions = cache(async () => {
  await requireUser();
  const supabase = await createClient();

  const [statesRes, categoriesRes, typesRes, tagsRes] = await Promise.all([
    supabase.rpc("lead_state_counts", { limit_count: 60 }),
    supabase.rpc("lead_primary_categories", { limit_count: 30 }),
    supabase.from("client_types").select("id, name, slug, color, description, sort_order").order("sort_order").order("name"),
    supabase.from("tags").select("id, name, slug, color, sort_order").order("sort_order").order("name"),
  ]);

  return {
    states: (statesRes.data ?? [])
      .map((s) => ({ value: s.state, count: s.total }))
      .sort((a, b) => a.value.localeCompare(b.value)),
    categories: (categoriesRes.data ?? []).map((c) => ({ value: c.category, count: c.total })),
    clientTypes: typesRes.data ?? [],
    tags: tagsRes.data ?? [],
  };
});

export const listClientTypes = cache(async () => {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_types")
    .select("id, name, slug, color, description, sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(`Failed to load client types: ${error.message}`);
  return data ?? [];
});

export const listCustomFields = cache(async (): Promise<CatalogCustomField[]> => {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custom_fields")
    .select("id, name, slug, field_type, show_in_table, sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    if (/custom_fields|schema cache/i.test(error.message)) return [];
    throw new Error(`Failed to load custom fields: ${error.message}`);
  }
  return data ?? [];
});

export const listTags = cache(async () => {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tags")
    .select("id, name, slug, color, sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(`Failed to load tags: ${error.message}`);
  return data ?? [];
});
