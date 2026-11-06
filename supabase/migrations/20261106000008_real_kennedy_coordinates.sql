-- The first version of the barrio reference points used approximate centroids
-- that drifted south of the locality: Timiza, Patio Bonito, Tintal, Bavaria and
-- Kennedy Central landed in Tunjuelito/Bosa. The fallback of HU10 therefore
-- ordered stores by a point that was not in Kennedy, and the map opened on
-- Tunjuelito.
--
-- These are real points inside the locality, taken from OpenStreetMap
-- (Nominatim lookups filtered by the Kennedy boundary, relation 4740229).
update public.barrio_reference_points
set location = st_setsrid(st_makepoint(-74.14330, 4.64000), 4326)::geography
where barrio = 'Castilla';

update public.barrio_reference_points
set location = st_setsrid(st_makepoint(-74.13220, 4.63770), 4326)::geography
where barrio = 'Bavaria';

update public.barrio_reference_points
set location = st_setsrid(st_makepoint(-74.15470, 4.62320), 4326)::geography
where barrio = 'Kennedy Central';

update public.barrio_reference_points
set location = st_setsrid(st_makepoint(-74.15400, 4.65090), 4326)::geography
where barrio = 'Tintal';

update public.barrio_reference_points
set location = st_setsrid(st_makepoint(-74.16070, 4.63940), 4326)::geography
where barrio = 'Patio Bonito';

update public.barrio_reference_points
set location = st_setsrid(st_makepoint(-74.15190, 4.61640), 4326)::geography
where barrio = 'Timiza';

update public.barrio_reference_points
set location = st_setsrid(st_makepoint(-74.17320, 4.65160), 4326)::geography
where barrio = 'Tierra Buena';
