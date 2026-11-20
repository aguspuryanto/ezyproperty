-- EzyProperty MVP schema
create extension if not exists pgcrypto;

create type public.user_role as enum ('agent', 'admin');
create type public.property_status as enum ('draft', 'pending', 'published', 'rejected', 'sold', 'rented', 'archived');
create type public.transaction_type as enum ('sale', 'rent');
create type public.property_type as enum ('house', 'apartment', 'land', 'shop', 'warehouse', 'villa', 'other');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  whatsapp text,
  avatar_url text,
  role public.user_role not null default 'agent',
  bio text,
  agency_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles(id) on delete cascade,
  title varchar(180) not null,
  slug varchar(220) not null unique,
  description text,
  transaction_type public.transaction_type not null,
  property_type public.property_type not null,
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
  status public.property_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(city_name,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(province_name,'')), 'A')
  ) stored
);

create table public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  agent_id uuid not null references public.profiles(id) on delete cascade,
  buyer_name text not null,
  buyer_email text,
  buyer_phone text not null,
  message text,
  status text not null default 'new' check (status in ('new','contacted','qualified','closed','spam')),
  created_at timestamptz not null default now()
);

create table public.property_favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, property_id)
);

create index properties_status_published_idx on public.properties(status, published_at desc);
create index properties_price_idx on public.properties(price);
create index properties_location_idx on public.properties(city_name, province_name);
create index properties_type_transaction_idx on public.properties(property_type, transaction_type);
create index properties_agent_idx on public.properties(agent_id, created_at desc);
create index properties_search_idx on public.properties using gin(search_vector);
create index property_images_property_idx on public.property_images(property_id, sort_order);
create index leads_agent_idx on public.leads(agent_id, created_at desc);

-- Create profile automatically for every auth user. Role is constrained to agent on public signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    'agent'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql
as $$ begin new.updated_at = now(); return new; end; $$;

create trigger profiles_updated_at before update on public.profiles
for each row execute procedure public.set_updated_at();

create trigger properties_updated_at before update on public.properties
for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.property_images enable row level security;
alter table public.leads enable row level security;
alter table public.property_favorites enable row level security;

-- A user can read their own profile only. Public agent fields are exposed
-- by the API through an explicit column allow-list.
create policy "Users can read own profile" on public.profiles
for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

-- Prevent privilege escalation and accidental writes to role/email.
revoke update on public.profiles from authenticated;
grant update (full_name, phone, whatsapp, avatar_url, bio, agency_name)
on public.profiles to authenticated;

create policy "Public can read published properties" on public.properties
for select using (status = 'published' or auth.uid() = agent_id);
create policy "Agents can create own properties" on public.properties
for insert with check (auth.uid() = agent_id);
create policy "Agents can update own properties" on public.properties
for update using (auth.uid() = agent_id) with check (auth.uid() = agent_id);
create policy "Agents can delete own draft properties" on public.properties
for delete using (auth.uid() = agent_id and status in ('draft','rejected'));

create policy "Public can read images of visible properties" on public.property_images
for select using (exists (
  select 1 from public.properties p where p.id = property_id
  and (p.status = 'published' or p.agent_id = auth.uid())
));
create policy "Agents manage images of own properties" on public.property_images
for all using (exists (select 1 from public.properties p where p.id = property_id and p.agent_id = auth.uid()))
with check (exists (select 1 from public.properties p where p.id = property_id and p.agent_id = auth.uid()));

create policy "Agents can read own leads" on public.leads
for select using (auth.uid() = agent_id);
create policy "Agents can update own leads" on public.leads
for update using (auth.uid() = agent_id) with check (auth.uid() = agent_id);

create policy "Users manage own favorites" on public.property_favorites
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Public lead creation should go through the API, not direct anonymous inserts.
