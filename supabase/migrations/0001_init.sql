-- EzyProperty schema, isolated in schema "ezy".
--
-- This Supabase project is shared with another application that owns the
-- "public" schema. Everything EzyProperty needs lives in "ezy"; this script
-- never creates, alters or drops objects in "public" or "auth".
-- Agent profiles are created by the app on first login (no trigger on auth.users).
--
-- Idempotent: safe to run more than once.
-- Prerequisite: add "ezy" to Project Settings > Data API > Exposed schemas.

create schema if not exists ezy;

-- Types --------------------------------------------------------------------
do $$ begin
  create type ezy.user_role as enum ('agent', 'admin');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type ezy.property_status as enum ('draft', 'pending', 'published', 'rejected', 'sold', 'rented', 'archived');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type ezy.transaction_type as enum ('sale', 'rent');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type ezy.property_type as enum ('house', 'apartment', 'land', 'shop', 'warehouse', 'villa', 'other');
exception when duplicate_object then null;
end $$;

-- Tables -------------------------------------------------------------------
create table if not exists ezy.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  whatsapp text,
  avatar_url text,
  role ezy.user_role not null default 'agent',
  bio text,
  agency_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ezy.properties (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references ezy.profiles(id) on delete cascade,
  title varchar(180) not null,
  slug varchar(220) not null unique,
  description text,
  transaction_type ezy.transaction_type not null,
  property_type ezy.property_type not null,
  price numeric(18,2) not null check (price > 0),
  land_area numeric(12,2) check (land_area is null or land_area > 0),
  building_area numeric(12,2) check (building_area is null or building_area > 0),
  bedrooms integer not null default 0 check (bedrooms >= 0),
  bathrooms integer not null default 0 check (bathrooms >= 0),
  floors integer not null default 1,
  electricity integer,
  certificate text,
  province_name text not null,
  city_name text not null,
  district_name text,
  village_name text,
  address text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  cover_image_url text,
  status ezy.property_status not null default 'draft',
  published_at timestamptz,
  source text,     -- e.g. 'brighton' for imported listings
  source_id text,  -- listing id in the source system
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(city_name,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(province_name,'')), 'A')
  ) stored
);

create table if not exists ezy.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references ezy.properties(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists ezy.leads (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references ezy.properties(id) on delete cascade,
  agent_id uuid not null references ezy.profiles(id) on delete cascade,
  buyer_name text not null,
  buyer_email text,
  buyer_phone text not null,
  message text,
  status text not null default 'new' check (status in ('new','contacted','qualified','closed','spam')),
  created_at timestamptz not null default now()
);

create table if not exists ezy.property_favorites (
  user_id uuid not null references ezy.profiles(id) on delete cascade,
  property_id uuid not null references ezy.properties(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, property_id)
);

-- Indexes ------------------------------------------------------------------
create index if not exists properties_status_published_idx on ezy.properties(status, published_at desc);
create index if not exists properties_price_idx on ezy.properties(price);
create index if not exists properties_location_idx on ezy.properties(city_name, province_name);
create index if not exists properties_type_transaction_idx on ezy.properties(property_type, transaction_type);
create index if not exists properties_agent_idx on ezy.properties(agent_id, created_at desc);
create index if not exists properties_search_idx on ezy.properties using gin(search_vector);
create unique index if not exists properties_source_uidx on ezy.properties(source, source_id);
create index if not exists property_images_property_idx on ezy.property_images(property_id, sort_order);
create index if not exists leads_agent_idx on ezy.leads(agent_id, created_at desc);

-- updated_at ---------------------------------------------------------------
create or replace function ezy.set_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists profiles_updated_at on ezy.profiles;
create trigger profiles_updated_at before update on ezy.profiles
for each row execute procedure ezy.set_updated_at();

drop trigger if exists properties_updated_at on ezy.properties;
create trigger properties_updated_at before update on ezy.properties
for each row execute procedure ezy.set_updated_at();

-- Privileges ---------------------------------------------------------------
-- RLS below decides which rows; these grants decide which operations/columns.
grant usage on schema ezy to anon, authenticated, service_role;
grant all on all tables in schema ezy to service_role;
grant all on all routines in schema ezy to service_role;

grant select on ezy.properties, ezy.property_images to anon, authenticated;
grant insert, update, delete on ezy.properties, ezy.property_images to authenticated;

-- Profiles: users can create their own row (role stays at its 'agent' default)
-- and edit only non-privileged columns.
revoke all on ezy.profiles from anon, authenticated;
grant select on ezy.profiles to authenticated;
grant insert (id, full_name, email) on ezy.profiles to authenticated;
grant update (full_name, phone, whatsapp, avatar_url, bio, agency_name) on ezy.profiles to authenticated;

grant select, update on ezy.leads to authenticated;
grant select, insert, delete on ezy.property_favorites to authenticated;

-- Row level security -------------------------------------------------------
alter table ezy.profiles enable row level security;
alter table ezy.properties enable row level security;
alter table ezy.property_images enable row level security;
alter table ezy.leads enable row level security;
alter table ezy.property_favorites enable row level security;

drop policy if exists "Users can read own profile" on ezy.profiles;
create policy "Users can read own profile" on ezy.profiles
for select using (auth.uid() = id);
drop policy if exists "Users can create own profile" on ezy.profiles;
create policy "Users can create own profile" on ezy.profiles
for insert with check (auth.uid() = id);
drop policy if exists "Users can update own profile" on ezy.profiles;
create policy "Users can update own profile" on ezy.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Public can read published properties" on ezy.properties;
create policy "Public can read published properties" on ezy.properties
for select using (status = 'published' or auth.uid() = agent_id);
drop policy if exists "Agents can create own properties" on ezy.properties;
create policy "Agents can create own properties" on ezy.properties
for insert with check (auth.uid() = agent_id);
drop policy if exists "Agents can update own properties" on ezy.properties;
create policy "Agents can update own properties" on ezy.properties
for update using (auth.uid() = agent_id) with check (auth.uid() = agent_id);
drop policy if exists "Agents can delete own draft properties" on ezy.properties;
create policy "Agents can delete own draft properties" on ezy.properties
for delete using (auth.uid() = agent_id and status in ('draft','rejected'));

drop policy if exists "Public can read images of visible properties" on ezy.property_images;
create policy "Public can read images of visible properties" on ezy.property_images
for select using (exists (
  select 1 from ezy.properties p where p.id = property_id
  and (p.status = 'published' or p.agent_id = auth.uid())
));
drop policy if exists "Agents manage images of own properties" on ezy.property_images;
create policy "Agents manage images of own properties" on ezy.property_images
for all using (exists (select 1 from ezy.properties p where p.id = property_id and p.agent_id = auth.uid()))
with check (exists (select 1 from ezy.properties p where p.id = property_id and p.agent_id = auth.uid()));

drop policy if exists "Agents can read own leads" on ezy.leads;
create policy "Agents can read own leads" on ezy.leads
for select using (auth.uid() = agent_id);
drop policy if exists "Agents can update own leads" on ezy.leads;
create policy "Agents can update own leads" on ezy.leads
for update using (auth.uid() = agent_id) with check (auth.uid() = agent_id);

drop policy if exists "Users manage own favorites" on ezy.property_favorites;
create policy "Users manage own favorites" on ezy.property_favorites
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Public lead creation should go through the API, not direct anonymous inserts.

-- Make the Data API pick up the new schema objects immediately.
notify pgrst, 'reload schema';
