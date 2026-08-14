/**
 * Hand-maintained mirror of `supabase/migrations`.
 *
 * Regenerate instead of editing once the project is linked:
 *   npx supabase gen types typescript --linked > lib/types/database.ts
 */

export type LeadStatus =
  | "new"
  | "contacted"
  | "follow_up"
  | "interested"
  | "meeting_booked"
  | "proposal_sent"
  | "won"
  | "lost"
  | "not_interested"
  | "unqualified"
  | "do_not_contact";

export type ActivityType =
  | "note"
  | "call"
  | "email"
  | "sms"
  | "dm"
  | "meeting"
  | "status_change"
  | "assignment"
  | "import";

export type LeadRow = {
  id: string;
  company_name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  phone: string | null;
  google_url: string | null;
  google_cid: string | null;
  google_rating: number | null;
  google_reviews: number | null;
  num_locations: number | null;
  website: string | null;
  primary_category: string | null;
  categories: string[];
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  booking_url: string | null;
  status: LeadStatus;
  priority: number;
  owner_id: string | null;
  notes: string | null;
  tags: string[];
  deal_value: number | null;
  next_follow_up_at: string | null;
  last_contacted_at: string | null;
  status_changed_at: string;
  source: string;
  dedupe_key: string;
  created_at: string;
  updated_at: string;
};

export type LeadInsert = Omit<
  LeadRow,
  "id" | "dedupe_key" | "created_at" | "updated_at" | "status_changed_at"
> & {
  id?: string;
  status?: LeadStatus;
  priority?: number;
  categories?: string[];
  tags?: string[];
  source?: string;
};

export type LeadUpdate = Partial<Omit<LeadRow, "id" | "dedupe_key">>;

export type LeadActivityRow = {
  id: string;
  lead_id: string;
  user_id: string | null;
  type: ActivityType;
  body: string | null;
  from_status: LeadStatus | null;
  to_status: LeadStatus | null;
  occurred_at: string;
  created_at: string;
};

export type LeadActivityInsert = Omit<LeadActivityRow, "id" | "created_at" | "occurred_at"> & {
  id?: string;
  occurred_at?: string;
};

export type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
};

export type DashboardStats = {
  total: number;
  worked: number;
  interested: number;
  won: number;
  pipeline_value: number;
  won_value: number;
  contacted_last_7d: number;
  follow_ups_due: number;
  unassigned: number;
  with_email: number;
  activities_last_7d: number;
};

export type Database = {
  public: {
    Tables: {
      leads: {
        Row: LeadRow;
        Insert: LeadInsert;
        Update: LeadUpdate;
        Relationships: [];
      };
      lead_activities: {
        Row: LeadActivityRow;
        Insert: LeadActivityInsert;
        Update: Partial<LeadActivityRow>;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & { id: string };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      lead_status_counts: {
        Args: Record<string, never>;
        Returns: { status: LeadStatus; count: number }[];
      };
      lead_dashboard_stats: {
        Args: Record<string, never>;
        Returns: DashboardStats;
      };
      lead_primary_categories: {
        Args: { limit_count?: number };
        Returns: { category: string; total: number }[];
      };
      lead_state_counts: {
        Args: { limit_count?: number };
        Returns: { state: string; total: number; interested: number; won: number }[];
      };
    };
    Enums: {
      lead_status: LeadStatus;
      activity_type: ActivityType;
    };
    CompositeTypes: Record<never, never>;
  };
};
