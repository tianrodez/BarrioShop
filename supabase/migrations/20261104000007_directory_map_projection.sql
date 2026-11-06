-- HU05 CA1 asks for one marker per store on the directory map, so the search
-- has to carry the point the merchant marked (HU02 CA2). Same arguments, same
-- published-only visibility, same ordering as 20261104000003: this only adds
-- the flattened coordinates to the projection.
--
-- `location` is a geography, and PostgREST would hand the browser a GeoJSON
-- object per row. The directory renders a number, so the point is flattened
-- here the same way the distance already is.
--
-- PostgreSQL refuses to change a function's return type in place, so the old
-- projection is dropped first. Nothing revoked EXECUTE on it (only the trigger
-- functions in 20261104000002 did), so the recreated function keeps the same
-- default grants and the same search_path.

drop function if exists public.search_stores(
  double precision, double precision, text, text, integer
);

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
  distance_m numeric,
  latitude double precision,
  longitude double precision
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
    end as distance_m,
    -- geography uses lon/lat; st_y is the latitude the map needs
    st_y(s.location::geometry) as latitude,
    st_x(s.location::geometry) as longitude
  from public.stores s
  cross join ref r
  where s.status = 'published'
    and (p_store_type is null or s.store_type = p_store_type)
    and (r.point is null or p_radius_m is null
         or st_dwithin(s.location, r.point, p_radius_m::numeric))
  order by distance_m nulls last, s.name;
$$;
