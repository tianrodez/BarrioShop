-- Static reference data: Kennedy barrios surveyed with the merchants
-- (formulation §3) plus their approximate centroids. These are prototype
-- reference points for the barrio fallback of HU10, not precise geometry.

insert into public.barrio_reference_points (barrio, location) values
  ('Castilla',        st_setsrid(st_makepoint(-74.1377, 4.5996), 4326)::geography),
  ('Bavaria',         st_setsrid(st_makepoint(-74.1500, 4.5885), 4326)::geography),
  ('Kennedy Central', st_setsrid(st_makepoint(-74.1510, 4.5752), 4326)::geography),
  ('Tintal',          st_setsrid(st_makepoint(-74.1830, 4.5615), 4326)::geography),
  ('Patio Bonito',    st_setsrid(st_makepoint(-74.1640, 4.5570), 4326)::geography),
  ('Timiza',          st_setsrid(st_makepoint(-74.1880, 4.5450), 4326)::geography),
  ('Tierra Buena',    st_setsrid(st_makepoint(-74.1560, 4.5680), 4326)::geography);
