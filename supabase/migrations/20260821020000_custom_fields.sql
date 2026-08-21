-- Custom client fields (configured in Settings) plus computed sort helpers
-- so every leads-table column can order in Postgres, not just in the browser.

create table custom_fields (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  field_type text not null default 'text',
  show_in_table boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint custom_fields_slug_key unique (slug),
  constraint custom_fields_name_len check (char_length(trim(name)) between 1 and 60),
  constraint custom_fields_slug_ok check (slug ~ '^[a-z][a-z0-9_]{0,39}$'),
  constraint custom_fields_type_ok check (field_type in ('text', 'number', 'date', 'url', 'boolean'))
);

create unique index custom_fields_name_lower_idx on custom_fields (lower(trim(name)));

alter table leads
  add column if not exists custom_data jsonb not null default '{}'::jsonb;

create index if not exists leads_custom_data_gin on leads using gin (custom_data);

alter table custom_fields enable row level security;

create policy "custom fields readable by team" on custom_fields
  for select to authenticated using (true);
create policy "custom fields writable by team" on custom_fields
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on custom_fields to authenticated;

-- Computed columns PostgREST can order by (function(leads) → column).
create or replace function lead_type_name(l leads)
returns text
language sql
stable
as $$
  select name from client_types where id = l.client_type_id
$$;

create or replace function lead_owner_name(l leads)
returns text
language sql
stable
as $$
  select coalesce(nullif(full_name, ''), email) from profiles where id = l.owner_id
$$;

create or replace function lead_contact_sort(l leads)
returns text
language sql
stable
as $$
  select coalesce(nullif(l.contact_name, ''), nullif(l.phone, ''), nullif(l.email, ''))
$$;

grant execute on function lead_type_name(leads) to authenticated;
grant execute on function lead_owner_name(leads) to authenticated;
grant execute on function lead_contact_sort(leads) to authenticated;

notify pgrst, 'reload schema';
