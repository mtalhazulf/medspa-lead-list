import type { LeadStatus } from "@/lib/types/database";
import { LEAD_STATUSES } from "@/lib/pipeline";

/** URL search params as Next.js hands them to a page. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

export const SORT_FIELDS = {
  updated: { column: "updated_at", label: "Last updated" },
  created: { column: "created_at", label: "Recently added" },
  name: { column: "company_name", label: "Company name" },
  type: { column: "lead_type_name", label: "Client type" },
  contact: { column: "lead_contact_sort", label: "Contact" },
  reviews: { column: "google_reviews", label: "Google reviews" },
  rating: { column: "google_rating", label: "Google rating" },
  locations: { column: "num_locations", label: "Locations" },
  status: { column: "status", label: "Status" },
  owner: { column: "lead_owner_name", label: "Owner" },
  follow_up: { column: "next_follow_up_at", label: "Follow-up date" },
  contacted: { column: "last_contacted_at", label: "Last contacted" },
} as const satisfies Record<string, { column: string; label: string }>;

export type BuiltinSortKey = keyof typeof SORT_FIELDS;
export type SortKey = BuiltinSortKey | `cf:${string}`;

const CUSTOM_SORT = /^cf:([a-z][a-z0-9_]{0,39})$/;

export function customSortSlug(sort: string): string | null {
  return CUSTOM_SORT.exec(sort)?.[1] ?? null;
}

export function isBuiltinSort(sort: string): sort is BuiltinSortKey {
  return Object.prototype.hasOwnProperty.call(SORT_FIELDS, sort);
}

export function parseSortKey(value: string): SortKey {
  if (isBuiltinSort(value)) return value;
  if (customSortSlug(value)) return value as SortKey;
  return "updated";
}

export const PAGE_SIZES = [25, 50, 100, 200] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export const HAS_FLAGS = ["email", "phone", "website", "instagram", "booking"] as const;
export type HasFlag = (typeof HAS_FLAGS)[number];

export const DUE_FILTERS = ["overdue", "today", "week"] as const;
export type DueFilter = (typeof DUE_FILTERS)[number];

export interface LeadQuery {
  q: string;
  status: LeadStatus[];
  state: string[];
  /** "me" | "unassigned" | a profile id | "" for any. */
  owner: string;
  category: string;
  clientType: string;
  tag: string;
  minRating: number | null;
  minReviews: number | null;
  maxReviews: number | null;
  minLocations: number | null;
  has: HasFlag[];
  due: DueFilter | null;
  sort: SortKey;
  dir: "asc" | "desc";
  page: number;
  perPage: PageSize;
}

const VALID_STATUSES = new Set<string>(LEAD_STATUSES.map((s) => s.value));

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function list(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  return raw
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter(Boolean);
}

function num(value: string | string[] | undefined): number | null {
  const raw = first(value);
  if (raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseLeadQuery(params: RawSearchParams): LeadQuery {
  const sort = parseSortKey(first(params.sort));

  const dirParam = first(params.dir);
  const dir = dirParam === "asc" || dirParam === "desc" ? dirParam : defaultDirection(sort);

  const perParam = Number(first(params.per));
  const perPage: PageSize = (PAGE_SIZES as readonly number[]).includes(perParam)
    ? (perParam as PageSize)
    : 50;

  const pageParam = Number(first(params.page));
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

  const dueParam = first(params.due);

  return {
    q: first(params.q).trim().slice(0, 120),
    status: list(params.status).filter((s): s is LeadStatus => VALID_STATUSES.has(s)),
    state: list(params.state).map((s) => s.toUpperCase().slice(0, 2)),
    owner: first(params.owner),
    category: first(params.category).slice(0, 80),
    clientType: first(params.type).slice(0, 40),
    tag: first(params.tag).slice(0, 40),
    minRating: num(params.min_rating),
    minReviews: num(params.min_reviews),
    maxReviews: num(params.max_reviews),
    minLocations: num(params.min_locations),
    has: list(params.has).filter((h): h is HasFlag => (HAS_FLAGS as readonly string[]).includes(h)),
    due: (DUE_FILTERS as readonly string[]).includes(dueParam) ? (dueParam as DueFilter) : null,
    sort,
    dir,
    page,
    perPage,
  };
}

export function defaultDirection(sort: SortKey): "asc" | "desc" {
  if (customSortSlug(sort)) return "asc";
  return sort === "name" || sort === "type" || sort === "contact" || sort === "owner" || sort === "follow_up" || sort === "status"
    ? "asc"
    : "desc";
}

/**
 * Serialize a query back to a query string, dropping defaults so URLs stay
 * short and shareable. Any change other than `page` resets pagination.
 */
export function buildLeadQueryString(query: Partial<LeadQuery>, base?: LeadQuery): string {
  const merged: LeadQuery = { ...(base ?? EMPTY_QUERY), ...query };
  const params = new URLSearchParams();

  if (merged.q) params.set("q", merged.q);
  if (merged.status.length) params.set("status", merged.status.join(","));
  if (merged.state.length) params.set("state", merged.state.join(","));
  if (merged.owner) params.set("owner", merged.owner);
  if (merged.category) params.set("category", merged.category);
  if (merged.clientType) params.set("type", merged.clientType);
  if (merged.tag) params.set("tag", merged.tag);
  if (merged.minRating !== null) params.set("min_rating", String(merged.minRating));
  if (merged.minReviews !== null) params.set("min_reviews", String(merged.minReviews));
  if (merged.maxReviews !== null) params.set("max_reviews", String(merged.maxReviews));
  if (merged.minLocations !== null) params.set("min_locations", String(merged.minLocations));
  if (merged.has.length) params.set("has", merged.has.join(","));
  if (merged.due) params.set("due", merged.due);
  if (merged.sort !== "updated") params.set("sort", merged.sort);
  if (merged.dir !== defaultDirection(merged.sort)) params.set("dir", merged.dir);
  if (merged.perPage !== 50) params.set("per", String(merged.perPage));
  if (merged.page > 1) params.set("page", String(merged.page));

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const EMPTY_QUERY: LeadQuery = {
  q: "",
  status: [],
  state: [],
  owner: "",
  category: "",
  clientType: "",
  tag: "",
  minRating: null,
  minReviews: null,
  maxReviews: null,
  minLocations: null,
  has: [],
  due: null,
  sort: "updated",
  dir: "desc",
  page: 1,
  perPage: 50,
};

export function hasActiveFilters(query: LeadQuery): boolean {
  return Boolean(query.q || panelFilterCount(query) > 0);
}

/** Facets shown in the filter panel — search lives in the always-visible box. */
export function panelFilterCount(query: LeadQuery): number {
  return [
    query.status.length > 0,
    query.state.length > 0,
    Boolean(query.owner),
    Boolean(query.category),
    Boolean(query.clientType),
    Boolean(query.tag),
    query.minRating !== null,
    query.minReviews !== null || query.maxReviews !== null,
    query.minLocations !== null,
    query.has.length > 0,
    Boolean(query.due),
  ].filter(Boolean).length;
}

/**
 * Turn free text into a prefix `tsquery` (`derma:* & spa:*`).
 * Everything that is not a word character is stripped, so user input can never
 * produce a tsquery syntax error.
 */
export function toPrefixTsQuery(input: string): string {
  return input
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((token) => token.length > 0)
    .slice(0, 6)
    .map((token) => `${token}:*`)
    .join(" & ");
}
