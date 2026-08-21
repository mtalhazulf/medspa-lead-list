import type {
  ClientTypeRow,
  CustomData,
  CustomFieldRow,
  DashboardStats,
  LeadActivityRow,
  LeadContactRow,
  LeadRow,
  LeadStatus,
  TagRow,
} from "@/lib/types/database";

export interface OwnerRef {
  id: string;
  full_name: string | null;
  email: string | null;
}

export type CatalogCustomField = Pick<
  CustomFieldRow,
  "id" | "name" | "slug" | "field_type" | "show_in_table" | "sort_order"
>;
export type CatalogTag = Pick<TagRow, "id" | "name" | "slug" | "color" | "sort_order">;
export type CatalogClientType = Pick<
  ClientTypeRow,
  "id" | "name" | "slug" | "color" | "description" | "sort_order"
>;

/** Row shape rendered by the leads table — narrower than the full lead. */
export interface LeadListItem {
  id: string;
  company_name: string;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  google_rating: number | null;
  google_reviews: number | null;
  num_locations: number | null;
  primary_category: string | null;
  client_type_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_count: number;
  status: LeadStatus;
  priority: number;
  tags: string[];
  owner_id: string | null;
  next_follow_up_at: string | null;
  last_contacted_at: string | null;
  updated_at: string;
  instagram: string | null;
  booking_url: string | null;
  custom_data: CustomData;
  owner: OwnerRef | null;
  client_type: CatalogClientType | null;
}

export interface LeadDetail extends LeadRow {
  owner: OwnerRef | null;
  client_type: CatalogClientType | null;
  contacts: LeadContact[];
}

export type LeadContact = Pick<
  LeadContactRow,
  | "id"
  | "lead_id"
  | "full_name"
  | "title"
  | "email"
  | "phone"
  | "linkedin"
  | "is_primary"
  | "do_not_contact"
  | "notes"
  | "last_contacted_at"
  | "sort_order"
  | "created_at"
  | "updated_at"
>;

export interface ActivityItem extends LeadActivityRow {
  user: OwnerRef | null;
  lead?: { id: string; company_name: string } | null;
  contact?: { id: string; full_name: string } | null;
}

export interface Teammate {
  id: string;
  name: string;
}

export interface PipelineNav {
  stats: DashboardStats;
  statusCounts: { status: LeadStatus; count: number }[];
}
