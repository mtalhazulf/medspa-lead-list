-- Med spa lead list + sales pipeline
-- Designed for ~40k lead rows with server-side search, filtering and pagination.

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type lead_status as enum (
  'new',
  'contacted',
  'follow_up',
  'interested',
  'meeting_booked',
  'proposal_sent',
  'won',
  'lost',
  'not_interested',
  'unqualified',
  'do_not_contact'
);

create type activity_type as enum (
  'note',
  'call',
  'email',
  'sms',
  'dm',
  'meeting',
  'status_change',
  'assignment',
  'import'
);

-- ---------------------------------------------------------------------------
-- Profiles (a readable name for whoever owns a lead)
-- ---------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();

-- Backfill anyone who signed up before this migration ran.
insert into profiles (id, email, full_name)
select id, email, coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Leads
-- ---------------------------------------------------------------------------

create table leads (
  id uuid primary key default gen_random_uuid(),

  -- Scraped business data (mirrors the source spreadsheet columns)
  company_name text not null,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  phone text,
  google_url text,
  google_cid text,
  google_rating numeric(2, 1),
  google_reviews integer,
  num_locations integer,
  website text,
  primary_category text,
  categories text[] not null default '{}',
  email text,
  latitude double precision,
  longitude double precision,
  instagram text,
  facebook text,
  tiktok text,
  booking_url text,

  -- Sales pipeline
  status lead_status not null default 'new',
  priority smallint not null default 0 check (priority between 0 and 3),
  -- References `profiles` (not auth.users) so PostgREST can embed the owner.
  owner_id uuid references profiles (id) on delete set null,
  notes text,
  tags text[] not null default '{}',
  deal_value numeric(12, 2),
  next_follow_up_at date,
  last_contacted_at timestamptz,
  status_changed_at timestamptz not null default now(),

  -- Bookkeeping
  source text not null default 'import',
  search_tsv tsvector,
  -- Stable identity for re-imports: the same business must never be inserted twice.
  dedupe_key text generated always as (
    lower(trim(company_name)) || '|' ||
    lower(coalesce(trim(address_line1), '')) || '|' ||
    lower(coalesce(trim(postal_code), ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index leads_dedupe_key_idx on leads (dedupe_key);
create unique index leads_google_cid_idx on leads (google_cid) where google_cid is not null;

-- Search: full-text over the business identity fields, trigram for fuzzy name lookups.
create index leads_search_tsv_idx on leads using gin (search_tsv);
create index leads_company_name_trgm_idx on leads using gin (company_name gin_trgm_ops);
create index leads_city_trgm_idx on leads using gin (city gin_trgm_ops);

-- Filter + sort paths used by the leads table UI.
create index leads_status_idx on leads (status);
create index leads_state_idx on leads (state);
create index leads_owner_idx on leads (owner_id) where owner_id is not null;
create index leads_follow_up_idx on leads (next_follow_up_at) where next_follow_up_at is not null;
create index leads_updated_at_idx on leads (updated_at desc);
create index leads_created_at_idx on leads (created_at desc);
create index leads_company_name_idx on leads (company_name);
create index leads_google_reviews_idx on leads (google_reviews desc nulls last);
create index leads_google_rating_idx on leads (google_rating desc nulls last);
create index leads_tags_idx on leads using gin (tags);
create index leads_categories_idx on leads using gin (categories);

-- ---------------------------------------------------------------------------
-- Activities (the audit trail / sales log)
-- ---------------------------------------------------------------------------

create table lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  user_id uuid references profiles (id) on delete set null,
  type activity_type not null default 'note',
  body text,
  from_status lead_status,
  to_status lead_status,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index lead_activities_lead_idx on lead_activities (lead_id, occurred_at desc);
create index lead_activities_user_idx on lead_activities (user_id, occurred_at desc);
create index lead_activities_recent_idx on lead_activities (occurred_at desc);

-- ---------------------------------------------------------------------------
-- Triggers: search vector, timestamps, automatic status-change audit
-- ---------------------------------------------------------------------------

create or replace function leads_refresh_search_tsv()
returns trigger
language plpgsql
as $$
begin
  new.search_tsv :=
    setweight(to_tsvector('simple', coalesce(new.company_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.city, '') || ' ' || coalesce(new.state, '') || ' ' || coalesce(new.postal_code, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(new.categories, ' '), '')), 'C') ||
    setweight(to_tsvector('simple',
      coalesce(new.email, '') || ' ' ||
      coalesce(new.website, '') || ' ' ||
      coalesce(new.phone, '') || ' ' ||
      coalesce(new.address_line1, '')), 'D');
  return new;
end;
$$;

create trigger leads_search_tsv_trg
before insert or update of company_name, city, state, postal_code, categories, email, website, phone, address_line1
on leads
for each row execute function leads_refresh_search_tsv();

create or replace function leads_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;

create trigger leads_touch_updated_at_trg
before update on leads
for each row execute function leads_touch_updated_at();

-- Every status change is logged, no matter which client made it.
create or replace function leads_log_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into lead_activities (lead_id, user_id, type, from_status, to_status, body)
    values (new.id, auth.uid(), 'status_change', old.status, new.status, null);
  end if;

  if new.owner_id is distinct from old.owner_id and new.owner_id is not null then
    insert into lead_activities (lead_id, user_id, type, body)
    values (new.id, auth.uid(), 'assignment', 'Lead assigned');
  end if;

  return new;
end;
$$;

create trigger leads_log_status_change_trg
after update on leads
for each row execute function leads_log_status_change();

-- Logging an outreach touch keeps `last_contacted_at` honest without extra writes.
create or replace function lead_activities_touch_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type in ('call', 'email', 'sms', 'dm', 'meeting') then
    update leads
    set last_contacted_at = greatest(coalesce(last_contacted_at, new.occurred_at), new.occurred_at)
    where id = new.lead_id;
  end if;
  return new;
end;
$$;

create trigger lead_activities_touch_lead_trg
after insert on lead_activities
for each row execute function lead_activities_touch_lead();

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Model: one shared team pipeline. Any signed-in teammate can read every lead
-- and work it; leads are created/deleted in bulk by the import script, which
-- uses the service role key and bypasses RLS.
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;
alter table leads enable row level security;
alter table lead_activities enable row level security;

create policy "profiles readable by team" on profiles
  for select to authenticated using (true);

create policy "profile self update" on profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "leads readable by team" on leads
  for select to authenticated using (true);

create policy "leads writable by team" on leads
  for update to authenticated using (true) with check (true);

create policy "leads insertable by team" on leads
  for insert to authenticated with check (true);

create policy "activities readable by team" on lead_activities
  for select to authenticated using (true);

create policy "activities insertable by author" on lead_activities
  for insert to authenticated with check (user_id = auth.uid() or user_id is null);

create policy "activities editable by author" on lead_activities
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "activities deletable by author" on lead_activities
  for delete to authenticated using (user_id = auth.uid());

-- Explicit table privileges. Supabase grants these by default, but spelling
-- them out keeps the deny (no DELETE on leads for teammates) intentional.
grant usage on schema public to anon, authenticated;
grant select, insert, update on leads to authenticated;
grant select, update on profiles to authenticated;
grant select, insert, update, delete on lead_activities to authenticated;

-- ---------------------------------------------------------------------------
-- Reporting helpers (one round trip instead of a dozen count queries)
-- ---------------------------------------------------------------------------

create or replace function lead_status_counts()
returns table (status lead_status, count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select l.status, count(*)::bigint
  from leads l
  group by l.status;
$$;

create or replace function lead_dashboard_stats()
returns json
language sql
stable
security invoker
set search_path = public
as $$
  select json_build_object(
    'total', (select count(*) from leads),
    'worked', (select count(*) from leads where status <> 'new'),
    'interested', (select count(*) from leads where status in ('interested', 'meeting_booked', 'proposal_sent')),
    'won', (select count(*) from leads where status = 'won'),
    'pipeline_value', (select coalesce(sum(deal_value), 0) from leads where status in ('interested', 'meeting_booked', 'proposal_sent')),
    'won_value', (select coalesce(sum(deal_value), 0) from leads where status = 'won'),
    'contacted_last_7d', (select count(*) from leads where last_contacted_at >= now() - interval '7 days'),
    'follow_ups_due', (select count(*) from leads where next_follow_up_at <= current_date and status not in ('won', 'lost', 'not_interested', 'do_not_contact')),
    'unassigned', (select count(*) from leads where owner_id is null and status <> 'new'),
    'with_email', (select count(*) from leads where email is not null and email <> ''),
    'activities_last_7d', (select count(*) from lead_activities where occurred_at >= now() - interval '7 days')
  );
$$;

-- Distinct primary categories, for the filter dropdown.
create or replace function lead_primary_categories(limit_count integer default 40)
returns table (category text, total bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select l.primary_category, count(*)::bigint
  from leads l
  where l.primary_category is not null and l.primary_category <> ''
  group by 1
  order by 2 desc
  limit limit_count;
$$;

-- Top states by lead volume, for the dashboard breakdown.
create or replace function lead_state_counts(limit_count integer default 12)
returns table (state text, total bigint, interested bigint, won bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(l.state, '—') as state,
    count(*)::bigint as total,
    count(*) filter (where l.status in ('interested', 'meeting_booked', 'proposal_sent'))::bigint as interested,
    count(*) filter (where l.status = 'won')::bigint as won
  from leads l
  group by 1
  order by 2 desc
  limit limit_count;
$$;

grant execute on function lead_status_counts() to authenticated;
grant execute on function lead_dashboard_stats() to authenticated;
grant execute on function lead_state_counts(integer) to authenticated;
grant execute on function lead_primary_categories(integer) to authenticated;
