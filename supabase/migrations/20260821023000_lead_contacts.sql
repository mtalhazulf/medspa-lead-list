-- People at a company. The lead row stays the organization; outreach can
-- target several contacts so one "no" from the front desk is not the end.

create table lead_contacts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  full_name text not null,
  title text,
  email text,
  phone text,
  linkedin text,
  is_primary boolean not null default false,
  do_not_contact boolean not null default false,
  notes text,
  last_contacted_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_contacts_name_len check (char_length(trim(full_name)) between 1 and 120),
  constraint lead_contacts_title_len check (title is null or char_length(title) <= 80),
  constraint lead_contacts_email_len check (email is null or char_length(email) <= 160),
  constraint lead_contacts_phone_len check (phone is null or char_length(phone) <= 40),
  constraint lead_contacts_linkedin_len check (linkedin is null or char_length(linkedin) <= 300)
);

create index lead_contacts_lead_idx on lead_contacts (lead_id, sort_order, created_at);
create unique index lead_contacts_one_primary_idx on lead_contacts (lead_id) where is_primary;
create unique index lead_contacts_email_idx
  on lead_contacts (lead_id, lower(email))
  where email is not null and email <> '';

alter table leads
  add column if not exists contact_count integer not null default 0;

alter table lead_activities
  add column if not exists contact_id uuid references lead_contacts (id) on delete set null;

create index lead_activities_contact_idx on lead_activities (contact_id) where contact_id is not null;

-- ---------------------------------------------------------------------------
-- Keep leads.contact_* + contact_count in sync with the primary person
-- ---------------------------------------------------------------------------

create or replace function lead_contacts_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.full_name := trim(new.full_name);
  new.title := nullif(trim(new.title), '');
  new.email := nullif(lower(trim(new.email)), '');
  new.phone := nullif(trim(new.phone), '');
  new.linkedin := nullif(trim(new.linkedin), '');
  new.notes := nullif(trim(new.notes), '');
  return new;
end;
$$;

create trigger lead_contacts_touch_updated_at_trg
before insert or update on lead_contacts
for each row execute function lead_contacts_touch_updated_at();

create or replace function lead_contacts_ensure_primary()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and not exists (
    select 1 from lead_contacts where lead_id = new.lead_id
  ) then
    new.is_primary := true;
  elsif new.is_primary then
    update lead_contacts
    set is_primary = false
    where lead_id = new.lead_id
      and is_primary
      and id is distinct from new.id;
  end if;
  return new;
end;
$$;

create trigger lead_contacts_ensure_primary_trg
before insert or update of is_primary on lead_contacts
for each row execute function lead_contacts_ensure_primary();

create or replace function leads_rebuild_search_tsv(p_lead leads)
returns tsvector
language sql
stable
as $$
  select
    setweight(to_tsvector('simple', coalesce(p_lead.company_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(p_lead.city, '') || ' ' || coalesce(p_lead.state, '') || ' ' || coalesce(p_lead.postal_code, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(p_lead.categories, ' '), '')), 'C') ||
    setweight(to_tsvector('simple',
      coalesce(p_lead.email, '') || ' ' ||
      coalesce(p_lead.website, '') || ' ' ||
      coalesce(p_lead.phone, '') || ' ' ||
      coalesce(p_lead.address_line1, '') || ' ' ||
      coalesce(p_lead.contact_name, '') || ' ' ||
      coalesce(p_lead.contact_email, '') || ' ' ||
      coalesce((
        select string_agg(coalesce(c.full_name, '') || ' ' || coalesce(c.email, '') || ' ' || coalesce(c.phone, ''), ' ')
        from lead_contacts c
        where c.lead_id = p_lead.id
      ), '')
    ), 'D');
$$;

create or replace function leads_refresh_search_tsv()
returns trigger
language plpgsql
as $$
begin
  new.search_tsv := leads_rebuild_search_tsv(new);
  return new;
end;
$$;

create or replace function lead_contacts_sync_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
  primary_row lead_contacts%rowtype;
begin
  lid := coalesce(new.lead_id, old.lead_id);

  if tg_op = 'DELETE' and old.is_primary then
    update lead_contacts
    set is_primary = true
    where id = (
      select id from lead_contacts
      where lead_id = lid
      order by sort_order, created_at
      limit 1
    );
  end if;

  select * into primary_row
  from lead_contacts
  where lead_id = lid and is_primary
  limit 1;

  update leads l
  set
    contact_name = primary_row.full_name,
    contact_title = primary_row.title,
    contact_email = primary_row.email,
    contact_phone = primary_row.phone,
    contact_count = (select count(*)::integer from lead_contacts where lead_id = lid),
    search_tsv = leads_rebuild_search_tsv(l)
  where l.id = lid;

  return null;
end;
$$;

create trigger lead_contacts_sync_lead_trg
after insert or update or delete on lead_contacts
for each row execute function lead_contacts_sync_lead();

-- Outreach against a person also stamps that person as touched.
create or replace function lead_activities_touch_contact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.contact_id is not null and new.type in ('call', 'email', 'sms', 'dm', 'meeting') then
    update lead_contacts
    set last_contacted_at = greatest(coalesce(last_contacted_at, new.occurred_at), new.occurred_at)
    where id = new.contact_id;
  end if;
  return new;
end;
$$;

create trigger lead_activities_touch_contact_trg
after insert on lead_activities
for each row execute function lead_activities_touch_contact();

-- ---------------------------------------------------------------------------
-- Import helper: attach a person to a company without wiping extra contacts
-- ---------------------------------------------------------------------------

create or replace function import_lead_people(p_people jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  lid uuid;
  pname text;
  ptitle text;
  pemail text;
  pphone text;
  cid uuid;
  n integer := 0;
begin
  if p_people is null or jsonb_typeof(p_people) <> 'array' then
    return 0;
  end if;

  for item in select value from jsonb_array_elements(p_people)
  loop
    lid := nullif(item ->> 'lead_id', '')::uuid;
    pemail := nullif(lower(trim(item ->> 'email')), '');
    pphone := nullif(trim(item ->> 'phone'), '');
    ptitle := nullif(trim(item ->> 'title'), '');
    pname := coalesce(
      nullif(trim(item ->> 'full_name'), ''),
      pemail,
      pphone
    );
    if lid is null or pname is null then
      continue;
    end if;

    cid := null;
    if pemail is not null then
      select id into cid
      from lead_contacts
      where lead_id = lid and lower(email) = pemail
      limit 1;
    end if;
    if cid is null then
      select id into cid
      from lead_contacts
      where lead_id = lid
        and lower(full_name) = lower(pname)
        and email is null
      limit 1;
    end if;

    if cid is null then
      insert into lead_contacts (lead_id, full_name, title, email, phone)
      values (lid, pname, ptitle, pemail, pphone);
    else
      update lead_contacts
      set
        full_name = pname,
        title = coalesce(ptitle, title),
        email = coalesce(pemail, email),
        phone = coalesce(pphone, phone)
      where id = cid;
    end if;
    n := n + 1;
  end loop;

  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill one contact per lead that already had a person on the row
-- ---------------------------------------------------------------------------

insert into lead_contacts (lead_id, full_name, title, email, phone, is_primary)
select
  id,
  coalesce(nullif(trim(contact_name), ''), nullif(trim(contact_email), ''), nullif(trim(contact_phone), '')),
  nullif(trim(contact_title), ''),
  nullif(lower(trim(contact_email)), ''),
  nullif(trim(contact_phone), ''),
  true
from leads
where coalesce(nullif(trim(contact_name), ''), nullif(trim(contact_email), ''), nullif(trim(contact_phone), '')) is not null;

alter table lead_contacts enable row level security;

create policy "contacts readable by team" on lead_contacts
  for select to authenticated using (true);
create policy "contacts writable by team" on lead_contacts
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on lead_contacts to authenticated;
grant execute on function import_lead_people(jsonb) to authenticated;
grant execute on function leads_rebuild_search_tsv(leads) to authenticated;

drop trigger if exists leads_search_tsv_trg on leads;
create trigger leads_search_tsv_trg
before insert or update of company_name, city, state, postal_code, categories, email, website, phone, address_line1, contact_name, contact_email
on leads
for each row execute function leads_refresh_search_tsv();

notify pgrst, 'reload schema';
