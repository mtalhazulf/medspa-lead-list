-- Configurable client types + managed tags, plus contact fields so any
-- kind of account can be tracked — not just a scraped Google listing.

-- ---------------------------------------------------------------------------
-- Catalogs
-- ---------------------------------------------------------------------------

create table client_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  color text not null default 'slate',
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_types_slug_key unique (slug),
  constraint client_types_name_len check (char_length(trim(name)) between 1 and 60),
  constraint client_types_color_ok check (color ~ '^[a-z]+$')
);

create unique index client_types_name_lower_idx on client_types (lower(trim(name)));

create table tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  color text not null default 'slate',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tags_slug_key unique (slug),
  constraint tags_name_len check (char_length(trim(name)) between 1 and 40),
  constraint tags_color_ok check (color ~ '^[a-z]+$')
);

create unique index tags_name_lower_idx on tags (lower(trim(name)));

create table lead_tags (
  lead_id uuid not null references leads (id) on delete cascade,
  tag_id uuid not null references tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (lead_id, tag_id)
);

create index lead_tags_tag_idx on lead_tags (tag_id);

-- ---------------------------------------------------------------------------
-- Lead columns for any client, not just a scraped business listing
-- ---------------------------------------------------------------------------

alter table leads
  add column client_type_id uuid references client_types (id) on delete set null,
  add column contact_name text,
  add column contact_title text,
  add column contact_email text,
  add column contact_phone text,
  add column lead_source text;

create index leads_client_type_idx on leads (client_type_id) where client_type_id is not null;
create index leads_contact_name_trgm_idx on leads using gin (contact_name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Keep leads.tags (text[]) in sync so list filters stay a single GIN lookup
-- ---------------------------------------------------------------------------

create or replace function lead_tags_sync_names()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
begin
  lid := coalesce(new.lead_id, old.lead_id);
  update leads
  set tags = coalesce((
    select array_agg(t.name order by t.sort_order, t.name)
    from lead_tags lt
    join tags t on t.id = lt.tag_id
    where lt.lead_id = lid
  ), '{}')
  where id = lid;
  return null;
end;
$$;

create trigger lead_tags_sync_names_trg
after insert or update or delete on lead_tags
for each row execute function lead_tags_sync_names();

create or replace function tags_sync_lead_names()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.name is distinct from old.name then
    update leads
    set tags = array_replace(tags, old.name, new.name)
    where tags @> array[old.name]::text[];
  end if;
  return new;
end;
$$;

create trigger tags_sync_lead_names_trg
after update of name on tags
for each row execute function tags_sync_lead_names();

create or replace function catalog_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger client_types_touch_updated_at_trg
before update on client_types
for each row execute function catalog_touch_updated_at();

create trigger tags_touch_updated_at_trg
before update on tags
for each row execute function catalog_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Search vector: identity + contact person + tags
-- ---------------------------------------------------------------------------

create or replace function leads_refresh_search_tsv()
returns trigger
language plpgsql
as $$
begin
  new.search_tsv :=
    setweight(to_tsvector('simple', coalesce(new.company_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.contact_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.city, '') || ' ' || coalesce(new.state, '') || ' ' || coalesce(new.postal_code, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(new.categories, ' '), '') || ' ' || coalesce(array_to_string(new.tags, ' '), '')), 'C') ||
    setweight(to_tsvector('simple',
      coalesce(new.email, '') || ' ' ||
      coalesce(new.contact_email, '') || ' ' ||
      coalesce(new.website, '') || ' ' ||
      coalesce(new.phone, '') || ' ' ||
      coalesce(new.contact_phone, '') || ' ' ||
      coalesce(new.address_line1, '') || ' ' ||
      coalesce(new.lead_source, '')), 'D');
  return new;
end;
$$;

drop trigger if exists leads_search_tsv_trg on leads;
create trigger leads_search_tsv_trg
before insert or update of
  company_name, city, state, postal_code, categories, tags, email, website, phone,
  address_line1, contact_name, contact_email, contact_phone, lead_source
on leads
for each row execute function leads_refresh_search_tsv();

-- ---------------------------------------------------------------------------
-- Bulk tag helpers (one round trip for up to 2k selected leads)
-- ---------------------------------------------------------------------------

create or replace function bulk_add_lead_tags(p_lead_ids uuid[], p_tag_id uuid)
returns integer
language sql
security invoker
set search_path = public
as $$
  with inserted as (
    insert into lead_tags (lead_id, tag_id)
    select distinct unnest(p_lead_ids), p_tag_id
    on conflict do nothing
    returning 1
  )
  select count(*)::integer from inserted;
$$;

create or replace function bulk_remove_lead_tags(p_lead_ids uuid[], p_tag_id uuid)
returns integer
language sql
security invoker
set search_path = public
as $$
  with deleted as (
    delete from lead_tags
    where tag_id = p_tag_id
      and lead_id = any(p_lead_ids)
    returning 1
  )
  select count(*)::integer from deleted;
$$;

create or replace function replace_lead_tags(p_lead_id uuid, p_tag_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from lead_tags where lead_id = p_lead_id;
  if p_tag_ids is not null and array_length(p_tag_ids, 1) is not null then
    insert into lead_tags (lead_id, tag_id)
    select p_lead_id, x
    from unnest(p_tag_ids) as x
    on conflict do nothing;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Seed catalogs (editable later from Settings)
-- ---------------------------------------------------------------------------

insert into client_types (name, slug, color, sort_order, description) values
  ('Med spa', 'med-spa', 'emerald', 10, 'Medical spas and aesthetic clinics'),
  ('Dermatology', 'dermatology', 'sky', 20, 'Dermatology practices'),
  ('Plastic surgery', 'plastic-surgery', 'violet', 30, 'Plastic and cosmetic surgery'),
  ('Wellness', 'wellness', 'teal', 40, 'IV, wellness and longevity clinics'),
  ('Dental aesthetics', 'dental-aesthetics', 'indigo', 50, 'Cosmetic dentistry'),
  ('Hair restoration', 'hair-restoration', 'amber', 60, 'Hair and scalp clinics'),
  ('Medical weight loss', 'medical-weight-loss', 'orange', 70, 'Weight-loss and GLP-1 programs'),
  ('Beauty / salon', 'beauty-salon', 'rose', 80, 'Salons and beauty studios'),
  ('Other', 'other', 'slate', 90, 'Anything else you sell to');

insert into tags (name, slug, color, sort_order) values
  ('Hot', 'hot', 'rose', 10),
  ('Chain', 'chain', 'violet', 20),
  ('Independent', 'independent', 'sky', 30),
  ('Multi-location', 'multi-location', 'indigo', 40),
  ('Decision maker found', 'decision-maker-found', 'emerald', 50),
  ('Has booking', 'has-booking', 'teal', 60),
  ('No website', 'no-website', 'amber', 70),
  ('Referral', 'referral', 'orange', 80);

-- Lift any free-text tags already on leads into the catalog, then the join table.
insert into tags (name, slug, color, sort_order)
select
  trim(t),
  trim(both '-' from regexp_replace(lower(trim(t)), '[^a-z0-9]+', '-', 'g')),
  'slate',
  100
from leads, unnest(tags) as t
where trim(t) <> ''
  and trim(both '-' from regexp_replace(lower(trim(t)), '[^a-z0-9]+', '-', 'g')) <> ''
on conflict (slug) do nothing;

insert into lead_tags (lead_id, tag_id)
select distinct l.id, tg.id
from leads l
cross join unnest(l.tags) as raw
join tags tg
  on tg.slug = trim(both '-' from regexp_replace(lower(trim(raw)), '[^a-z0-9]+', '-', 'g'))
on conflict do nothing;

-- Rebuild the denormalized names from the join (canonical catalog spelling).
update leads l
set tags = coalesce((
  select array_agg(t.name order by t.sort_order, t.name)
  from lead_tags lt
  join tags t on t.id = lt.tag_id
  where lt.lead_id = l.id
), '{}');

-- Best-effort type from the scraped primary category.
update leads
set client_type_id = (
  select id from client_types
  where slug = case
    when primary_category ~* 'derm' then 'dermatology'
    when primary_category ~* 'plastic|cosmetic surg' then 'plastic-surgery'
    when primary_category ~* 'wellness|iv lounge|longevity' then 'wellness'
    when primary_category ~* 'dent' then 'dental-aesthetics'
    when primary_category ~* 'hair' then 'hair-restoration'
    when primary_category ~* 'weight' then 'medical-weight-loss'
    when primary_category ~* 'salon|beauty' then 'beauty-salon'
    when primary_category ~* 'spa|aesthetic|medspa|med spa|botox' then 'med-spa'
    else 'other'
  end
)
where client_type_id is null and primary_category is not null and primary_category <> '';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table client_types enable row level security;
alter table tags enable row level security;
alter table lead_tags enable row level security;

create policy "client_types readable by team" on client_types
  for select to authenticated using (true);
create policy "client_types writable by team" on client_types
  for all to authenticated using (true) with check (true);

create policy "tags readable by team" on tags
  for select to authenticated using (true);
create policy "tags writable by team" on tags
  for all to authenticated using (true) with check (true);

create policy "lead_tags readable by team" on lead_tags
  for select to authenticated using (true);
create policy "lead_tags writable by team" on lead_tags
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on client_types to authenticated;
grant select, insert, update, delete on tags to authenticated;
grant select, insert, update, delete on lead_tags to authenticated;

grant execute on function bulk_add_lead_tags(uuid[], uuid) to authenticated;
grant execute on function bulk_remove_lead_tags(uuid[], uuid) to authenticated;
grant execute on function replace_lead_tags(uuid, uuid[]) to authenticated;
