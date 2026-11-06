-- BarrioShop core schema (U1).
-- Target: Supabase PostgreSQL with PostGIS; the `auth` schema is provided by Supabase.
-- Traceability: HU02 (stores), HU03 (products), HU09 (status flow), HU10 (geography),
-- HU11 (reports), formulation §8 (roles in a dedicated table), §18 (order metrics).

create extension if not exists postgis;

create type public.store_status as enum ('pending', 'published', 'hidden', 'retired');
create type public.product_status as enum ('available', 'sold_out');
create type public.profile_role as enum ('cliente', 'comerciante', 'administrador');
create type public.report_target as enum ('store', 'product');
create type public.report_status as enum ('open', 'resolved', 'rejected');

-- Roles live in a dedicated table, NEVER in auth metadata: metadata can be
-- modified by the user itself, so it is not a safe authorization source (§8).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.profile_role not null default 'cliente',
  full_name text not null default '',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  -- Tienda, Panadería, Miscelánea, Fruver, Droguería... (HU02 CA1)
  store_type text not null check (char_length(store_type) between 2 and 40),
  description text,
  photo_url text,
  address text not null,
  barrio text not null,
  upz text,
  -- "Frente al parque de Castilla": reference to known places (§5, T5)
  reference_place text,
  -- wa.me digits with country code, e.g. 573001112233 (HU02 CA1, HU06 CA4)
  whatsapp text not null check (whatsapp ~ '^[0-9]{8,15}$'),
  opening_hours text not null,
  -- Point marked by the merchant on the map (HU02 CA2); distances computed in BD (§9)
  location geography (Point, 4326) not null,
  -- HU09: new stores start "pending" (En revisión) and are invisible until published
  status public.store_status not null default 'pending',
  -- §7: what the merchant must fix when rejected
  rejection_note text,
  -- HU07 (paid off-platform; activation is admin-only, enforced in 000002/000003)
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  description text,
  -- Whole pesos, no decimals in practice (HU03 CA1; formatted by lib/currency.ts)
  price integer not null check (price > 0),
  -- Required field per formulation §6 (drives the category filter, HU04)
  category text not null check (char_length(category) between 2 and 40),
  photo_url text,
  -- HU03 CA4: sold_out stays visible but cannot be added to an order
  status public.product_status not null default 'available',
  -- HU03 CA5: "Última actualización de precio" notice source
  price_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Centroid per Kennedy barrio: fallback reference when the client does not
-- share browser location (HU10 CA3, formulation §9).
create table public.barrio_reference_points (
  barrio text primary key,
  location geography (Point, 4326) not null
);

-- HU11: clients and merchants report stores/products; admin reviews.
create table public.store_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target public.report_target not null,
  store_id uuid references public.stores (id) on delete cascade,
  product_id uuid references public.products (id) on delete cascade,
  reason text not null check (char_length(reason) between 5 and 1000),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  constraint report_target_exclusive check (
    (target = 'store' and store_id is not null and product_id is null)
    or (target = 'product' and product_id is not null and store_id is null)
  )
);

-- Orders are placed outside the platform (WhatsApp). The event is logged only
-- for the "Ventas en línea" success metric (formulation §18) and the owner's
-- dashboard. payload: {items:[{product_id,name,quantity,price}], total,
-- customer:{name,address,payment_method}} (HU06 CA2-CA3).
create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  requester_id uuid references public.profiles (id) on delete set null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- HU09 CA1: verification supports (RUT, Cámara de Comercio, utility bill,
-- facade photo) live in their OWN table, readable only by the owner and
-- admins. They are deliberately NOT columns on stores, because published
-- store rows are world-readable and would leak private document paths.
create table public.store_verifications (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  doc_type text not null check (doc_type in
    ('rut', 'camara_comercio', 'recibo_servicio', 'fachada')),
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);

create index stores_owner_idx on public.stores (owner_id);
create index stores_status_idx on public.stores (status);
create index stores_barrio_idx on public.stores (barrio);
create index stores_location_idx on public.stores using gist (location);
create index products_store_idx on public.products (store_id);
create index products_category_idx on public.products (category);
create index store_reports_status_idx on public.store_reports (status);
create index order_events_store_time_idx on public.order_events (store_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger stores_touch_updated_at
  before update on public.stores
  for each row execute function public.set_updated_at();

create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Every new auth user gets a profile with the default role 'cliente'.
-- Admin accounts are created by the team (HU09 CA4): they manually set
-- role='administrador' on the profiles row (SQL editor / service role).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
