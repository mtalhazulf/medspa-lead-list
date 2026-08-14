import type { LeadActivityRow, LeadRow, LeadStatus } from "@/lib/types/database";

export interface OwnerRef {
  id: string;
  full_name: string | null;
  email: string | null;
}

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
  status: LeadStatus;
  priority: number;
  tags: string[];
  owner_id: string | null;
  next_follow_up_at: string | null;
  last_contacted_at: string | null;
  updated_at: string;
  instagram: string | null;
  booking_url: string | null;
  owner: OwnerRef | null;
}

export interface LeadDetail extends LeadRow {
  owner: OwnerRef | null;
}

export interface ActivityItem extends LeadActivityRow {
  user: OwnerRef | null;
}

export interface Teammate {
  id: string;
  name: string;
}
