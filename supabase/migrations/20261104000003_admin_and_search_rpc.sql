-- RPCs: the single choke point for privileged operations (§8 admin matrix)
-- and for PostGIS proximity search (§9). SECURITY DEFINER functions are used
-- only where the caller legitimately needs to cross RLS (admin review,
-- featured activation, retirement, report resolution). Proximity search is
-- SECURITY INVOKER so published-visibility RLS keeps enforcing itself.

-- ---------------------------------------------------------------------------
-- Admin: store review (HU09 CA3)
-- ---------------------------------------------------------------------------
create or replace function public.admin_review_store(
  p_store_id uuid,
  p_approve boolean,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise 'administrator role required';
  end if;

  update public.stores
  set status = (case when p_approve then 'published' else 'pending' end)::public.store_status,
      rejection_note = case when p_approve then null else p_note end,
      updated_at = now()
  where id = p_store_id;

  if not found then
    raise 'store not found';
  end if;
end;
$$;

-- Admin: retire / unpublish (formulation §7, third control stage)
create or replace function public.admin_retire_store(p_store_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise 'administrator role required';
  end if;

  update public.stores
  set status = 'retired', updated_at = now()
  where id = p_store_id;

  if not found then
    raise 'store not found';
  end if;
end;
$$;

-- Admin: featured badge (HU07; payment happens off-platform, so activation
-- is a deliberate manual step)
create or replace function public.admin_set_featured(
  p_store_id uuid,
  p_featured boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise 'administrator role required';
  end if;

  update public.stores
  set is_featured = p_featured, updated_at = now()
  where id = p_store_id and status = 'published';

  if not found then
    raise 'store not found or not published';
  end if;
end;
$$;

-- Admin: reports lifecycle (HU11 CA2/CA3)
create or replace function public.admin_resolve_report(
  p_report_id uuid,
  p_status public.report_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise 'administrator role required';
  end if;

  update public.store_reports
  set status = p_status
  where id = p_report_id;

  if not found then
    raise 'report not found';
  end if;
end;
$$;

-- Admin: hide misleading product content ("ocultar contenido engañoso", §8).
create or replace function public.admin_remove_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise 'administrator role required';
  end if;

  delete from public.products where id = p_product_id;

  if not found then
    raise 'product not found';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Proximity search (HU10, formulation §9): distance computed in the DB with
-- PostGIS. Three modes, in the preference order the document defines:
--   1) browser coords  -> distance from them (optional radius filter)
--   2) chosen barrio   -> distance from the barrio reference point
--   3) neither         -> alphabetical (distance_m NULL)
-- Featured stores are NOT reordered here on purpose: whether "Destacada"
-- beats proximity is a product decision left to the app layer (HU07 CA3
-- vs HU10 CA2), flagged in the feature doc Log.
-- ---------------------------------------------------------------------------
create or replace function public.search_stores(
  p_lat double precision default null,
  p_lng double precision default null,
  p_barrio text default null,
  p_store_type text default null,
  p_radius_m integer default null
)
returns table (
  id uuid,
  name text,
  store_type text,
  barrio text,
  address text,
  reference_place text,
  opening_hours text,
  photo_url text,
  is_featured boolean,
  distance_m numeric
)
language sql
stable
-- invoker: RLS (published-only for the public) applies inside
set search_path = public
as $$
  with ref as (
    select coalesce(
      case
        when p_lat is not null and p_lng is not null
          then st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
      end,
      (select location from public.barrio_reference_points
       where barrio = p_barrio)
    ) as point
  )
  select
    s.id, s.name, s.store_type, s.barrio, s.address, s.reference_place,
    s.opening_hours, s.photo_url, s.is_featured,
    case
      when r.point is null then null
      else round(st_distance(s.location, r.point)::numeric)
    end as distance_m
  from public.stores s
  cross join ref r
  where s.status = 'published'
    and (p_store_type is null or s.store_type = p_store_type)
    and (r.point is null or p_radius_m is null
         or st_dwithin(s.location, r.point, p_radius_m::numeric))
  order by distance_m nulls last, s.name;
$$;

-- Owner/admin metric: orders sent by WhatsApp in the last N days (§18 "Ventas
-- en línea: al menos 10 pedidos por mes").
create or replace function public.store_order_count(
  p_store_id uuid,
  p_days integer default 30
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)
  from public.order_events oe
  where oe.store_id = p_store_id
    and oe.created_at >= now() - make_interval(days => p_days)
    and (public.is_admin() or public.is_store_owner(p_store_id));
$$;
