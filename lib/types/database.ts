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
  client_type_id: string | null;
  contact_name: string | null;
  contact_title: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_count: number;
  lead_source: string | null;
  custom_data: CustomData;
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
  | "id"
  | "dedupe_key"
  | "created_at"
  | "updated_at"
  | "status_changed_at"
  | "status"
  | "priority"
  | "owner_id"
  | "notes"
  | "tags"
  | "deal_value"
  | "next_follow_up_at"
  | "last_contacted_at"
  | "client_type_id"
  | "custom_data"
  | "contact_count"
  | "contact_name"
  | "contact_title"
  | "contact_email"
  | "contact_phone"
> & {
  id?: string;
  status?: LeadStatus;
  priority?: number;
  owner_id?: string | null;
  notes?: string | null;
  tags?: string[];
  deal_value?: number | null;
  next_follow_up_at?: string | null;
  last_contacted_at?: string | null;
  client_type_id?: string | null;
  categories?: string[];
  source?: string;
  custom_data?: CustomData;
  contact_name?: string | null;
  contact_title?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
};

export type LeadUpdate = Partial<Omit<LeadRow, "id" | "dedupe_key">>;

export type LeadActivityRow = {
  id: string;
  lead_id: string;
  contact_id: string | null;
  user_id: string | null;
  type: ActivityType;
  body: string | null;
  from_status: LeadStatus | null;
  to_status: LeadStatus | null;
  occurred_at: string;
  created_at: string;
};

export type LeadActivityInsert = Omit<LeadActivityRow, "id" | "created_at" | "occurred_at" | "contact_id"> & {
  id?: string;
  occurred_at?: string;
  contact_id?: string | null;
};

export type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
};

export type ClientTypeRow = {
  id: string;
  name: string;
  slug: string;
  color: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type TagRow = {
  id: string;
  name: string;
  slug: string;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CustomFieldType = "text" | "number" | "date" | "url" | "boolean";

export type CustomFieldRow = {
  id: string;
  name: string;
  slug: string;
  field_type: CustomFieldType;
  show_in_table: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CustomData = Record<string, string | number | boolean | null>;

export type LeadContactRow = {
  id: string;
  lead_id: string;
  full_name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  is_primary: boolean;
  do_not_contact: boolean;
  notes: string | null;
  last_contacted_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type LeadContactInsert = Omit<
  LeadContactRow,
  "id" | "created_at" | "updated_at" | "last_contacted_at" | "sort_order"
> & {
  id?: string;
  last_contacted_at?: string | null;
  sort_order?: number;
};

export type LeadTagRow = {
  lead_id: string;
  tag_id: string;
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
      lead_contacts: {
        Row: LeadContactRow;
        Insert: LeadContactInsert;
        Update: Partial<LeadContactRow>;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & { id: string };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      client_types: {
        Row: ClientTypeRow;
        Insert: Partial<ClientTypeRow> & { name: string; slug: string };
        Update: Partial<ClientTypeRow>;
        Relationships: [];
      };
      tags: {
        Row: TagRow;
        Insert: Partial<TagRow> & { name: string; slug: string };
        Update: Partial<TagRow>;
        Relationships: [];
      };
      lead_tags: {
        Row: LeadTagRow;
        Insert: Pick<LeadTagRow, "lead_id" | "tag_id"> & { created_at?: string };
        Update: Partial<LeadTagRow>;
        Relationships: [];
      };
      custom_fields: {
        Row: CustomFieldRow;
        Insert: Partial<CustomFieldRow> & { name: string; slug: string };
        Update: Partial<CustomFieldRow>;
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
      bulk_add_lead_tags: {
        Args: { p_lead_ids: string[]; p_tag_id: string };
        Returns: number;
      };
      bulk_remove_lead_tags: {
        Args: { p_lead_ids: string[]; p_tag_id: string };
        Returns: number;
      };
      replace_lead_tags: {
        Args: { p_lead_id: string; p_tag_ids: string[] };
        Returns: undefined;
      };
      import_lead_people: {
        Args: { p_people: { lead_id: string; full_name?: string | null; title?: string | null; email?: string | null; phone?: string | null }[] };
        Returns: number;
      };
    };
    Enums: {
      lead_status: LeadStatus;
      activity_type: ActivityType;
    };
    CompositeTypes: Record<never, never>;
  };
};
