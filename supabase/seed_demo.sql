-- DEMO SEED — BarrioShop (content only, prototype fidelity, matches the
-- Lovable mockup: La Espiga, Fruver El Campo, NEARBUY).
--
-- All coordinates sit inside the official Kennedy boundary (OSM relation
-- 4740229); the first version drifted into Tunjuelito and Bosa.
--
-- Demo accounts are provisioned by tests/900_demo_users.sql (run before this
-- file by both the docker harness and `supabase db reset`). For a hosted
-- project, run 900_demo_users.sql and this file in order via the SQL editor
-- (they are idempotent). The seed binds stores to those profiles by email.

do $$
declare
  v_panadera uuid;
  v_fruver uuid;
  v_tienda uuid;
  v_vecina uuid;
  v_espiga uuid;
  v_campo uuid;
  v_nearbuy uuid;
  v_esquina uuid;
begin
  select p.id into v_panadera from public.profiles p
    join auth.users u on u.id = p.id where u.email = 'panadera@barrioshop.demo';
  select p.id into v_fruver from public.profiles p
    join auth.users u on u.id = p.id where u.email = 'fruver@barrioshop.demo';
  select p.id into v_tienda from public.profiles p
    join auth.users u on u.id = p.id where u.email = 'tienda@barrioshop.demo';
  select p.id into v_vecina from public.profiles p
    join auth.users u on u.id = p.id where u.email = 'vecina@barrioshop.demo';

  if v_panadera is null or v_fruver is null or v_tienda is null or v_vecina is null then
    raise 'create the four demo accounts in Supabase Auth first (see README)';
  end if;

  if exists (select 1 from public.stores where name = 'Panadería La Espiga') then
    raise notice 'demo seed already applied — nothing to do';
    return;
  end if;

  insert into public.stores (owner_id, name, store_type, description, address, barrio, upz,
    reference_place, whatsapp, opening_hours, location, status, is_featured, photo_url)
  values
    (v_panadera, 'Panadería La Espiga', 'Panadería',
     'Pan artesanal y recetas de la casa, recién horneado todos los días.',
     'Calle 40 Sur # 78-25', 'Castilla', 'Bavaria - Santa Rita',
     'Frente al parque de Castilla', '573001112233',
     'Lun–Dom · 6:00 a.m. – 8:00 p.m.',
     st_setsrid(st_makepoint(-74.1438, 4.6394), 4326), 'published', true,
     '/hero-tienda.jpg'),
    (v_fruver, 'Fruver El Campo', 'Fruver',
     'Frutas y verduras seleccionadas del campo, precio del día.',
     'Carrera 68 # 6-40', 'Kennedy Central', 'Kennedy Central',
     'Cerca a la estación Banderas', '573002223344',
     'Lun–Dom · 6:30 a.m. – 7:30 p.m.',
     st_setsrid(st_makepoint(-74.1552, 4.6229), 4326), 'published', true, null),
    (v_tienda, 'NEARBUY', 'Tienda',
     'Todo lo que necesitas para la semana, sin filas y sin comisiones.',
     'Avenida Ciudad de Cali # 12-30', 'Tintal', 'Tintal - Galán',
     'Éxito', '573003334455',
     'Lun–Vie · 8:00 a.m. – 8:00 p.m.',
     st_setsrid(st_makepoint(-74.1544, 4.6505), 4326), 'published', false, null),
    (v_tienda, 'Miscelánea La Esquina', 'Miscelánea',
     'Miscelánea de barrio: mercado, lácteos y sorpresas.',
     'Calle 38 Sur # 74-10', 'Bavaria', 'Bavaria - Santa Rita',
     'Esquina del canódromo', '573004445566',
     'Lun–Sáb · 7:00 a.m. – 9:00 p.m.',
     st_setsrid(st_makepoint(-74.1322, 4.6377), 4326), 'pending', false, null);

  select id into v_espiga from public.stores where name = 'Panadería La Espiga';

  select id into v_campo from public.stores where name = 'Fruver El Campo';
  select id into v_nearbuy from public.stores where name = 'NEARBUY';
  select id into v_esquina from public.stores where name = 'Miscelánea La Esquina';

  insert into public.store_verifications (store_id, doc_type, storage_path) values
    (v_espiga, 'rut', 'verifications/espiga/rut.pdf'),
    (v_esquina, 'fachada', 'verifications/esquina/fachada.jpg'),
    (v_esquina, 'recibo_servicio', 'verifications/esquina/recibo.pdf');

  insert into public.products (store_id, name, description, price, category, status) values
    -- La Espiga (one with a recent price change -> HU03 CA5 notice)
    (v_espiga, 'Pan campesino 500 g', 'Masa madre, horneado a leña.', 4000, 'Panadería', 'available'),
    (v_espiga, 'Almojábana unidad', 'Queso y almidón, recién salida del horno.', 1200, 'Panadería', 'available'),
    (v_espiga, 'Café americano', 'Café del altiplán, 12 oz.', 2500, 'Bebidas', 'available'),
    -- Fruver (one sold_out -> HU03 CA4)
    (v_campo, 'Naranja x kilo', 'Naranja jugosa seleccionada.', 3800, 'Frutas', 'available'),
    (v_campo, 'Piña golden x unidad', null, 4500, 'Frutas', 'available'),
    (v_campo, 'Banano x kilo', null, 2500, 'Frutas', 'available'),
    (v_campo, 'Aguacate fuerte x unidad', 'Se consigue los martes.', 3000, 'Verduras', 'sold_out'),
    -- NEARBUY
    (v_nearbuy, 'Agua 1.5 L', null, 3500, 'Bebidas', 'available'),
    (v_nearbuy, 'Huevos x 12', 'Grande, banda roja.', 9000, 'Lácteos', 'available'),
    (v_nearbuy, 'Arroz 5 kg', null, 18000, 'Granos', 'available'),
    -- Miscelánea pending (only owner/admin can see these — RNF-02 test case)
    (v_esquina, 'Panela x libra', null, 2800, 'Comidas', 'available');

  -- Simulate a price change on one product so the UI can show the notice.
  update public.products
  set price = 2500, price_updated_at = now()
  where store_id = v_espiga and name = 'Café americano';

  insert into public.store_reports (reporter_id, target, store_id, reason)
  values (v_vecina, 'store', v_nearbuy, 'El horario publicado no coincide con la tienda física.');

  insert into public.order_events (store_id, requester_id, payload) values
    (v_espiga, v_vecina,
     '{"items":[{"product_id":null,"name":"Pan campesino 500 g","quantity":2,"price":4000},{"product_id":null,"name":"Café americano","quantity":1,"price":2500}],"total":10500,"customer":{"name":"María Vecina","address":"Calle 42 Sur # 77-10","payment_method":"domicilio"}}'::jsonb),
    (v_campo, null,
     '{"items":[{"product_id":null,"name":"Naranja x kilo","quantity":3,"price":3800}],"total":11400,"customer":{"name":"Cliente sin cuenta","address":"Carrera 70 # 8-12","payment_method":"recogida"}}'::jsonb);
end;
$$;
