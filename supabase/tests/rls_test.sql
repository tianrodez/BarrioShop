-- BarrioShop RLS behavioral suite (run against the docker compose harness).
-- Every scenario switches to a real session role (anon / authenticated with
-- JWT claims) and asserts the database ENFORCES the HU02/HU09/HU10/HU11
-- isolation rules — not the UI. A failing assertion raises and fails the
-- container exit code.
--
-- Harness-only helper functions are dropped at the end. The database itself
-- is disposable (docker compose down -v).

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function test_expect_error(p_sql text, p_pattern text)
returns void
language plpgsql
as $$
declare
  actual_error text;
begin
  begin
    execute p_sql;
  exception when others then
    actual_error := sqlerrm;
  end;

  if actual_error is null then
    raise exception 'TEST FAILED: statement unexpectedly succeeded';
  end if;
  if actual_error !~ p_pattern then
    raise exception 'TEST FAILED: unexpected error "%" (sql: %)', actual_error, p_sql;
  end if;
end;
$$;

-- Switches JWT claims for the current session (call before `set role`).
create or replace function test_set_claims(p_sub uuid, p_role text)
returns void
language sql
as $$
  select set_config('request.jwt.claims',
    case when p_sub is null then ''
         else json_build_object('sub', p_sub, 'role', p_role)::text end,
    false);
$$;

-- NOTE: a regular table, not TEMP: after SET ROLE the pg_temp namespace of
-- the creator is not resolvable by the switched role.
create table if not exists public.test_fixed (panadera uuid, fruver uuid, tienda uuid, vecina uuid);
truncate public.test_fixed;
insert into public.test_fixed values (
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000003',
  'a0000000-0000-4000-8000-000000000004');

-- ---------------------------------------------------------------------------
-- 1. Anon sees only published content (HU09 CA2, directorio HU04 CA1)
-- ---------------------------------------------------------------------------
do $$
declare n int;
begin
  perform test_set_claims(null, null);
  execute 'reset role'; execute 'set role anon';
  select count(*) into n from public.stores;
  if n <> 3 then raise exception 'TEST FAILED: anon sees % stores, expected 3', n; end if;
  if exists (select 1 from public.stores where status <> 'published') then
    raise exception 'TEST FAILED: anon sees non-published stores';
  end if;
  -- Miscelánea La Esquina is pending → invisible (HU09)
  if exists (select 1 from public.stores where name = 'Miscelánea La Esquina') then
    raise exception 'TEST FAILED: pending store leaked to anon';
  end if;
  -- products of published stores only (La Esquina's panela hidden) → 10
  select count(*) into n from public.products;
  if n <> 10 then raise exception 'TEST FAILED: anon sees % products, expected 10', n; end if;
  -- sold_out products remain VISIBLE (HU03 CA4)
  if not exists (select 1 from public.products where status = 'sold_out') then
    raise exception 'TEST FAILED: sold_out product not visible';
  end if;
  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Private verification documents (HU09 CA1, Ley 1581)
-- ---------------------------------------------------------------------------
do $$
declare n int;
begin
  perform test_set_claims(null, null);
  execute 'reset role'; execute 'set role anon';
  select count(*) into n from public.store_verifications;
  if n <> 0 then raise exception 'TEST FAILED: anon reads % verification docs', n; end if;
  reset role;

  -- other owner cannot read them
  perform test_set_claims((select fruver from test_fixed), 'authenticated');
  execute 'set role authenticated';
  select count(*) into n from public.store_verifications;
  if n <> 0 then raise exception 'TEST FAILED: foreign merchant reads verification docs'; end if;
  reset role;

  -- their owner can
  perform test_set_claims((select panadera from test_fixed), 'authenticated');
  execute 'set role authenticated';
  select count(*) into n from public.store_verifications;
  if n <> 1 then raise exception 'TEST FAILED: doc owner reads % docs, expected 1', n; end if;
  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Anon cannot create stores (no self-service publishing)
-- ---------------------------------------------------------------------------
do $$
begin
  perform test_set_claims(null, null);
  execute 'reset role'; execute 'set role anon';
  perform test_expect_error($q$
    insert into public.stores (owner_id, name, store_type, address, barrio, whatsapp,
      opening_hours, location, status)
    values (null, 'Tienda Falsa', 'Tienda', 'x', 'Castilla', '573009999999',
      'x', st_setsrid(st_makepoint(-74.14, 4.59), 4326), 'published')$q$,
    'row-level security');
  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Cross-store isolation (HU02 CA4, RNF-02)
-- ---------------------------------------------------------------------------
do $$
declare n int;
begin
  perform test_set_claims((select panadera from test_fixed), 'authenticated');
  execute 'reset role'; execute 'set role authenticated';
  execute $q$update public.stores set description = 'hijacked'
    where name = 'Fruver El Campo'$q$;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'TEST FAILED: merchant edited foreign store (% rows)', n; end if;
  -- own store is editable
  execute $q$update public.stores set description = description
    where name = 'Panadería La Espiga'$q$;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'TEST FAILED: owner cannot edit own store'; end if;
  -- ownership is immutable
  perform test_expect_error($q$update public.stores set owner_id = (select fruver from test_fixed)
    where name = 'Panadería La Espiga'$q$, 'immutable');
  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Status guard: owner can hide/show, can NEVER self-approve/retire (HU09)
-- ---------------------------------------------------------------------------
do $$
declare n int;
begin
  perform test_set_claims((select tienda from test_fixed), 'authenticated');
  execute 'reset role'; execute 'set role authenticated';
  -- pending -> published: self-approval blocked
  perform test_expect_error($q$update public.stores set status = 'published'
    where name = 'Miscelánea La Esquina'$q$, 'administrator review');
  -- pending -> hidden: not a legal self-transition either
  perform test_expect_error($q$update public.stores set status = 'hidden'
    where name = 'Miscelánea La Esquina'$q$, 'administrator review');
  -- published -> hidden -> published: legal (HU02 CA5)
  execute $q$update public.stores set status = 'hidden' where name = 'NEARBUY'$q$;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'TEST FAILED: owner cannot hide own store'; end if;
  execute $q$update public.stores set status = 'published' where name = 'NEARBUY'$q$;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'TEST FAILED: owner cannot un-hide own store'; end if;
  -- retired: admin-only (§7)
  perform test_expect_error($q$update public.stores set status = 'retired'
    where name = 'NEARBUY'$q$, 'administrator review');
  -- featured is admin-only (HU07)
  perform test_expect_error($q$update public.stores set is_featured = true
    where name = 'NEARBUY'$q$, 'administrator-only');
  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Profile role escalation (formulación §8: roles in a dedicated table)
-- ---------------------------------------------------------------------------
do $$
declare r text;
begin
  execute 'reset role'; execute 'set role authenticated';
  -- store owners were auto-promoted by the trigger
  perform test_set_claims((select panadera from test_fixed), 'authenticated');
  select role into r from public.profiles where id = (select panadera from test_fixed);
  if r <> 'comerciante' then raise exception 'TEST FAILED: store owner role is %', r; end if;
  -- Direct self-promotion is forbidden; only the trusted store trigger may
  -- assign comerciante (the prior guard accepted this direct UPDATE).
  perform test_set_claims((select vecina from test_fixed), 'authenticated');
  perform test_expect_error($q$update public.profiles set role = 'comerciante'
    where id = (select vecina from test_fixed)$q$, 'changed by an administrator');
  if (select role from public.profiles where id = (select vecina from test_fixed)) <> 'cliente'
    then raise exception 'TEST FAILED: direct merchant self-promotion leaked'; end if;
  -- self-escalation to administrador is blocked (own row, own claims)
  perform test_expect_error($q$update public.profiles set role = 'administrador'
    where id = (select vecina from test_fixed)$q$, 'changed by an administrator');
  if (select role from public.profiles where id = (select vecina from test_fixed)) <> 'cliente'
    then raise exception 'TEST FAILED: vecina escalation leaked'; end if;
  perform test_set_claims(null, null);
  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Products: public reads, foreign writes blocked, owner create/update allowed
-- ---------------------------------------------------------------------------
do $$
declare n int; previous_price_update timestamptz; current_price_update timestamptz;
begin
  perform test_set_claims((select vecina from test_fixed), 'authenticated');
  execute 'reset role'; execute 'set role authenticated';
  perform test_expect_error($q$
    insert into public.products (store_id, name, price, category)
    values ((select id from public.stores where name = 'Panadería La Espiga' limit 1),
            'Pan robado', 5000, 'Panadería')$q$,
    'row-level security');
  -- client can still READ the catalog (it's public)
  select count(*) into n from public.products;
  if n <> 10 then raise exception 'TEST FAILED: client product visibility broke'; end if;
  reset role;

  -- owner edits own products incl. sold_out toggle (HU03 CA4)
  perform test_set_claims((select fruver from test_fixed), 'authenticated');
  execute 'set role authenticated';
  execute $q$update public.products set status = 'available'
    where name = 'Aguacate fuerte x unidad'$q$;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'TEST FAILED: owner cannot toggle sold_out'; end if;
  execute $q$update public.products set status = 'sold_out'
    where name = 'Aguacate fuerte x unidad'$q$;
  -- price change refreshes the notice timestamp source (HU03 CA5)
  select price_updated_at into previous_price_update from public.products
    where name = 'Aguacate fuerte x unidad';
  execute $q$update public.products set price = 3200
    where name = 'Aguacate fuerte x unidad'$q$;
  select price_updated_at into current_price_update from public.products
    where name = 'Aguacate fuerte x unidad';
  if current_price_update <= previous_price_update then
    raise exception 'TEST FAILED: price update did not refresh notice timestamp';
  end if;
  execute $q$update public.products set price_updated_at = '2000-01-01T00:00:00Z'
    where name = 'Aguacate fuerte x unidad'$q$;
  if (select price_updated_at from public.products
      where name = 'Aguacate fuerte x unidad') <> current_price_update then
    raise exception 'TEST FAILED: owner forged price update timestamp';
  end if;
  -- availability changes are not price changes: the notice must stay silent
  execute $q$update public.products set status = 'available'
    where name = 'Aguacate fuerte x unidad'$q$;
  if (select price_updated_at from public.products
      where name = 'Aguacate fuerte x unidad') <> current_price_update then
    raise exception 'TEST FAILED: stock change moved the price notice timestamp';
  end if;
  reset role;

  -- owner can build the catalog even while pending (no public exposure)
  perform test_set_claims((select tienda from test_fixed), 'authenticated');
  execute 'set role authenticated';
  execute $q$insert into public.products (store_id, name, price, category)
    values ((select id from public.stores where name = 'Miscelánea La Esquina' limit 1),
            'Test temporal', 1000, 'Comidas')$q$;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'TEST FAILED: owner cannot draft products while pending'; end if;
  update public.products set deleted_at = now() where name = 'Test temporal';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'TEST FAILED: pending product could not be removed'; end if;
  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- 7b. The price-change notice is server-owned, not caller-owned (HU03 CA5)
-- ---------------------------------------------------------------------------
-- Kept in its own transaction: inside a single one now() is constant, so the
-- refresh of a real price change could not be told apart from a kept value.
do $$
declare before_notice timestamptz; stored_notice timestamptz;
begin
  perform test_set_claims((select fruver from test_fixed), 'authenticated');
  execute 'set role authenticated';
  select price_updated_at into before_notice from public.products
    where name = 'Aguacate fuerte x unidad';
  execute $q$update public.products set price = 1600,
    price_updated_at = '1999-01-01T00:00:00Z'
    where name = 'Aguacate fuerte x unidad'$q$;
  select price_updated_at into stored_notice from public.products
    where name = 'Aguacate fuerte x unidad';
  if stored_notice = '1999-01-01T00:00:00Z'::timestamptz then
    raise exception 'TEST FAILED: caller supplied the price notice timestamp';
  end if;
  if stored_notice <= before_notice then
    raise exception 'TEST FAILED: real price change did not refresh the notice';
  end if;
  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- 8. Product removal retains linked reports and moderation context (HU03/HU11)
-- ---------------------------------------------------------------------------
do $$
<<u4_test>>
declare product_id uuid; report_id uuid; n int;
      hash_before text; hash_after text; tombstone_at timestamptz;
begin
  -- Create a product and a report against it as an authenticated reporter.
  execute 'reset role';
  insert into public.products (store_id, name, price, category)
  values ((select id from public.stores where name = 'Fruver El Campo'),
          'Producto con reporte', 1000, 'Verduras')
  returning id into product_id;

  perform test_set_claims((select vecina from test_fixed), 'authenticated');
  execute 'set role authenticated';
  insert into public.store_reports (reporter_id, target, product_id, reason)
  values ((select vecina from test_fixed), 'product', product_id, 'Precio incorrecto')
  returning id into report_id;
  reset role;

  -- Merchant deletion is logical; direct DELETE must not cascade the report.
  perform test_set_claims((select fruver from test_fixed), 'authenticated');
  execute 'set role authenticated';
  update public.products set deleted_at = now() where id = product_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'TEST FAILED: owner cannot remove product'; end if;
  delete from public.products where id = product_id;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'TEST FAILED: owner physically deleted product'; end if;
  reset role;

  -- The report remains associated with its product for its reporter.
  perform test_set_claims((select vecina from test_fixed), 'authenticated');
  execute 'set role authenticated';
  select count(*) into n from public.store_reports r
    where r.id = u4_test.report_id and r.product_id = u4_test.product_id;
  if n <> 1 then raise exception 'TEST FAILED: product report or target link was deleted'; end if;
  reset role;

  -- Tombstoned products are hidden from public reads.
  perform test_set_claims(null, null);
  execute 'set role anon';
  select count(*) into n from public.products where id = product_id;
  if n <> 0 then raise exception 'TEST FAILED: anonymous user sees removed product'; end if;
  reset role;

  -- Admin removal is also logical, so the moderation target remains available.
  update public.profiles set role = 'administrador'
    where id = (select vecina from test_fixed);
  perform test_set_claims((select vecina from test_fixed), 'authenticated');
  execute 'set role authenticated';
  perform public.admin_remove_product(product_id);
  select count(*) into n from public.store_reports r
    join public.products p on p.id = r.product_id
    where r.id = u4_test.report_id
      and p.id = u4_test.product_id
      and p.deleted_at is not null;
  if n <> 1 then raise exception 'TEST FAILED: admin removal lost report context'; end if;

  -- Re-running the moderation removal is idempotent: no error, one tombstone.
  select p.deleted_at into tombstone_at from public.products p
    where p.id = u4_test.product_id;
  if tombstone_at is null then
    raise exception 'TEST FAILED: admin removal did not store a tombstone';
  end if;
  perform public.admin_remove_product(product_id);
  if (select p.deleted_at from public.products p
      where p.id = u4_test.product_id) <> tombstone_at then
    raise exception 'TEST FAILED: repeated admin removal moved the tombstone';
  end if;

  -- Removing an unknown product fails loudly instead of reporting success.
  perform test_expect_error(
    $q$select public.admin_remove_product('00000000-0000-4000-8000-000000000099')$q$,
    'product not found');
  reset role;

  -- A merchant may not use the moderation RPC, and the rejected call
  -- leaves every product row untouched.
  select md5(string_agg(p.id::text || coalesce(p.deleted_at::text, '-'), ','
                         order by p.id))
    into hash_before from public.products p;
  perform test_set_claims((select fruver from test_fixed), 'authenticated');
  execute 'set role authenticated';
  perform test_expect_error($q$select public.admin_remove_product(
    (select id from public.products where name = 'Producto con reporte' limit 1))$q$,
    'administrator role required');
  reset role;
  select md5(string_agg(p.id::text || coalesce(p.deleted_at::text, '-'), ','
                         order by p.id))
    into hash_after from public.products p;
  if hash_after is distinct from hash_before then
    raise exception 'TEST FAILED: rejected moderation removal still changed products';
  end if;

  -- Tombstones keep referential freedom: the same product name can be sold again.
  perform test_set_claims((select fruver from test_fixed), 'authenticated');
  execute 'set role authenticated';
  insert into public.products (store_id, name, price, category)
  values ((select id from public.stores where name = 'Fruver El Campo'),
          'Producto con reporte', 1500, 'Verduras');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'TEST FAILED: cannot relist a product name kept in a tombstone'; end if;
  reset role;

  -- Public reads are exactly the live products of published stores: parity,
  -- not a magic count, so tombstones never leak and never hide live rows.
  perform test_set_claims(null, null);
  execute 'set role anon';
  select count(*) into n from public.products;
  if n <> (
    select count(*) from public.products p
      join public.stores s on s.id = p.store_id
      where s.status = 'published' and p.deleted_at is null
  ) then
    raise exception 'TEST FAILED: anonymous product visibility diverged from live published rows';
  end if;
  reset role;

  perform test_set_claims(null, null);
  update public.profiles set role = 'cliente'
    where id = (select vecina from test_fixed);
end $$;

-- ---------------------------------------------------------------------------
-- 9. order_events: log click for published stores only (HU06, §18 metric)
-- ---------------------------------------------------------------------------
do $$
declare n int;
begin
  perform test_set_claims(null, null);
  execute 'reset role'; execute 'set role anon';
  execute $q$insert into public.order_events (store_id, requester_id, payload)
    values ((select id from public.stores where name = 'Panadería La Espiga' limit 1),
            null, '{"items":[],"total":0,"customer":{"name":"anónimo"}}'::jsonb)$q$;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'TEST FAILED: anon cannot log an order event'; end if;
  perform test_expect_error($q$
    insert into public.order_events (store_id, requester_id, payload)
    values ((select id from public.stores where name = 'Miscelánea La Esquina' limit 1),
            null, '{}'::jsonb)$q$,
    'row-level security');
  reset role;

  -- events readable by their store owner only
  perform test_set_claims((select vecina from test_fixed), 'authenticated');
  execute 'set role authenticated';
  select count(*) into n from public.order_events;
  if n <> 0 then raise exception 'TEST FAILED: client reads order events'; end if;
  reset role;
  perform test_set_claims((select panadera from test_fixed), 'authenticated');
  execute 'set role authenticated';
  select count(*) into n from public.order_events;
  if n <> 2 then raise exception 'TEST FAILED: owner sees % own events, expected 2', n; end if;
  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- 9b. The logged order belongs to the client who sent it (HU06 CA3-CA4)
-- ---------------------------------------------------------------------------
do $$
declare n int; n_total int; hashed_before text; hashed_after text;
begin
  -- A client may not put someone else's id on an order, and the refused call
  -- leaves every event byte-identical.
  select md5(string_agg(e.id::text || coalesce(e.requester_id::text, '-')
                        || e.payload::text || e.created_at::text, ','
                        order by e.created_at, e.id))
    into hashed_before from public.order_events e;

  perform test_set_claims((select vecina from test_fixed), 'authenticated');
  execute 'reset role'; execute 'set role authenticated';
  perform test_expect_error($q$
    insert into public.order_events (store_id, requester_id, payload)
    values ((select id from public.stores where name = 'Panadería La Espiga' limit 1),
            (select panadera from test_fixed),
            '{"items":[],"total":0,"customer":{"name":"suplantado"}}'::jsonb)$q$,
    'row-level security');

  -- With its own id the same client can log the order it just sent (HU01 CA2:
  -- browsing needs no account, and ordering still works without one).
  execute $q$insert into public.order_events (store_id, requester_id, payload)
    values ((select id from public.stores where name = 'Panadería La Espiga' limit 1),
            auth.uid(),
            '{"items":[{"product_id":null,"name":"Pan campesino 500 g","quantity":2,"price":4000}],"total":8000,"customer":{"name":"Cliente de la sección 9b","address":"Calle 42 Sur # 77-10","payment_method":"domicilio"}}'::jsonb)$q$;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'TEST FAILED: client cannot log its own order'; end if;
  reset role;

  select md5(string_agg(e.id::text || coalesce(e.requester_id::text, '-')
                        || e.payload::text || e.created_at::text, ','
                        order by e.created_at, e.id))
    into hashed_after from public.order_events e;
  if hashed_after = hashed_before then
    raise exception 'TEST FAILED: the accepted order was not stored';
  end if;

  -- The logged row is taken back out again, so the metric counts that later
  -- sections pin keep describing the seed. Removing it proves it really landed.
  delete from public.order_events
    where payload->'customer'->>'name' = 'Cliente de la sección 9b';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'TEST FAILED: the client order did not reach the table';
  end if;

  -- The event is what the metric reads: it must carry the payload it says it
  -- does, so an order logged without one is refused instead of silently blank.
  perform test_expect_error($q$
    insert into public.order_events (store_id)
    values ((select id from public.stores where name = 'Panadería La Espiga' limit 1))$q$,
    'null value in column "payload"');

  -- A store the merchant hid takes no orders (HU02 CA5), and neither does one
  -- still waiting for review (§9 above).
  update public.stores set status = 'hidden'
    where name = 'Panadería La Espiga';
  perform test_set_claims(null, null);
  execute 'set role anon';
  perform test_expect_error($q$
    insert into public.order_events (store_id, requester_id, payload)
    values ((select id from public.stores where name = 'Panadería La Espiga' limit 1),
            null, '{"items":[],"total":0,"customer":{}}'::jsonb)$q$,
    'row-level security');
  reset role;
  update public.stores set status = 'published'
    where name = 'Panadería La Espiga';

  -- Reviewers see every event, owners only their own store's.
  select count(*) into n_total from public.order_events;
  update public.profiles set role = 'administrador'
    where id = (select vecina from test_fixed);
  perform test_set_claims((select vecina from test_fixed), 'authenticated');
  execute 'set role authenticated';
  select count(*) into n from public.order_events;
  if n <> n_total then raise exception 'TEST FAILED: administrator reads % of % order events', n, n_total; end if;
  reset role;
  update public.profiles set role = 'cliente'
    where id = (select vecina from test_fixed);
  perform test_set_claims(null, null);
end $$;

-- ---------------------------------------------------------------------------
-- 9c. A logged order cannot be rewritten by the people who read it (HU06, §18)
-- ---------------------------------------------------------------------------
-- The "Ventas en línea" metric only means something if the row a client wrote
-- stays untouched. There is no UPDATE or DELETE policy for a client, so both
-- must change zero rows and the table must stay byte-identical around them.
do $$
declare n int; own int; hashed_before text; hashed_after text;
begin
  select md5(string_agg(e.id::text || coalesce(e.requester_id::text, '-')
                        || e.payload::text || e.created_at::text, ','
                        order by e.created_at, e.id))
    into hashed_before from public.order_events e;

  perform test_set_claims((select vecina from test_fixed), 'authenticated');
  execute 'reset role'; execute 'set role authenticated';
  execute $q$update public.order_events
    set payload = payload || '{"tampered":true}'::jsonb$q$;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'TEST FAILED: a client rewrote % order events', n; end if;
  execute $q$delete from public.order_events$q$;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'TEST FAILED: a client deleted % order events', n; end if;
  reset role;

  select md5(string_agg(e.id::text || coalesce(e.requester_id::text, '-')
                        || e.payload::text || e.created_at::text, ','
                        order by e.created_at, e.id))
    into hashed_after from public.order_events e;
  if hashed_after is distinct from hashed_before then
    raise exception 'TEST FAILED: a client changed the order log without permission';
  end if;

  -- An owner reads the events of their own stores, checked as a dynamic count
  -- instead of a magic number, so the suite stays true when the seed grows.
  select count(*) into own from public.order_events
    where store_id = (select id from public.stores where name = 'Panadería La Espiga' limit 1);
  perform test_set_claims((select panadera from test_fixed), 'authenticated');
  execute 'set role authenticated';
  select count(*) into n from public.order_events;
  if n <> own then raise exception 'TEST FAILED: owner reads % events, own store has %', n, own; end if;
  reset role;
  perform test_set_claims(null, null);
end $$;

-- ---------------------------------------------------------------------------
-- 10. search_stores: three fallback modes exactly as §9 / HU10 defines
-- ---------------------------------------------------------------------------
do $$
declare first_name text; n int; nearest_m int;
begin
  perform test_set_claims(null, null);
  execute 'reset role'; execute 'set role anon';

  -- mode 1: coordinates → nearest first (the point the merchant marked for
  -- La Espiga, not the old invented Castilla centroid)
  select name into first_name
    from public.search_stores(p_lat => 4.6400, p_lng => -74.1430) limit 1;
  if first_name <> 'Panadería La Espiga'
    then raise exception 'TEST FAILED: coord search first = %', first_name; end if;

  -- distances strictly non-decreasing in the function's own output order
  select count(*) into n from (
    select ord, d, lag(d) over (order by ord) as prev
    from (
      select ord, distance_m as d
      from public.search_stores(p_lat => 4.6400, p_lng => -74.1430)
        with ordinality as t(
          id, name, store_type, barrio, address, reference_place,
          opening_hours, photo_url, is_featured, distance_m,
          latitude, longitude, ord)
    ) x
  ) y
  where prev is not null and d is not null and prev > d;
  if n <> 0 then raise exception 'TEST FAILED: distances not ordered'; end if;

  -- HU05 CA1: every listed store carries the exact point the merchant marked,
  -- with no rounding that could move a marker onto another store.
  select count(*) into n
    from public.search_stores() s
    join public.stores st on st.id = s.id
    where s.latitude is distinct from st_y(st.location::geometry)
       or s.longitude is distinct from st_x(st.location::geometry);
  if n <> 0 then raise exception 'TEST FAILED: directory projection altered a merchant point'; end if;

  -- radius filter: 1500 m around La Espiga finds exactly itself
  select count(*) into n from public.search_stores(
    p_lat => 4.6400, p_lng => -74.1430, p_radius_m => 1500);
  if n <> 1 then raise exception 'TEST FAILED: radius search returned % stores', n; end if;

  -- the radius really cuts: one metre short of a store's own distance drops it
  select floor(min(st_distance(s.location,
    st_setsrid(st_makepoint(-74.1430, 4.6400), 4326)::geography)))::int
    into nearest_m
    from public.stores s where s.status = 'published';
  select count(*) into n from public.search_stores(
    p_lat => 4.6400, p_lng => -74.1430, p_radius_m => nearest_m - 1);
  if n <> 0 then
    raise exception 'TEST FAILED: radius % m still returned the nearest store', nearest_m - 1;
  end if;
  select count(*) into n from public.search_stores(
    p_lat => 4.6400, p_lng => -74.1430, p_radius_m => nearest_m + 1);
  if n < 1 then
    raise exception 'TEST FAILED: radius % m excluded the nearest store', nearest_m + 1;
  end if;

  -- mode 2: barrio fallback → nearest to the barrio reference point
  select name into first_name from public.search_stores(p_barrio => 'Tintal') limit 1;
  if first_name <> 'NEARBUY' then raise exception 'TEST FAILED: barrio search first = %', first_name; end if;

  -- mode 3: neither → alphabetical, distance NULL
  select name into first_name from public.search_stores() limit 1;
  if first_name <> 'Fruver El Campo' then raise exception 'TEST FAILED: alpha first = %', first_name; end if;
  select count(*) into n from public.search_stores() where distance_m is not null;
  if n <> 0 then raise exception 'TEST FAILED: alphabetical mode returned distances'; end if;

  -- store-type filter (HU04 category filter)
  select count(*) into n from public.search_stores(p_store_type => 'Panadería');
  if n <> 1 then raise exception 'TEST FAILED: type filter returned %', n; end if;

  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- 11. Admin RPC choke point (HU09 CA3, HU11 CA2/3)
-- ---------------------------------------------------------------------------
do $$
declare n int;
begin
  -- team promotes vecina (service context: claims cleared, auth.uid() null → allowed)
  perform test_set_claims(null, null);
  execute 'reset role';
  update public.profiles set role = 'administrador'
    where id = (select vecina from test_fixed);

  -- as admin: pending stores become visible
  perform test_set_claims((select vecina from test_fixed), 'authenticated');
  execute 'set role authenticated';
  select count(*) into n from public.stores;
  if n <> 4 then raise exception 'TEST FAILED: admin sees % stores', n; end if;

  -- approve La Esquina
  execute $q$select public.admin_review_store(id, true) from public.stores
    where name = 'Miscelánea La Esquina'$q$;
  if (select status from public.stores where name = 'Miscelánea La Esquina') <> 'published'
    then raise exception 'TEST FAILED: admin approve broke'; end if;

  -- reject with note → stays pending + rejection_note
  execute $q$select public.admin_review_store(id, false, 'La dirección del recibo no coincide')
    from public.stores where name = 'Miscelánea La Esquina'$q$;
  if not exists (select 1 from public.stores
                 where name = 'Miscelánea La Esquina' and rejection_note is not null)
    then raise exception 'TEST FAILED: rejection note missing'; end if;

  -- featured activation + retire
  execute $q$select public.admin_set_featured(id, true) from public.stores
    where name = 'NEARBUY'$q$;
  if not (select is_featured from public.stores where name = 'NEARBUY')
    then raise exception 'TEST FAILED: set_featured broke'; end if;
  execute $q$select public.admin_retire_store(id) from public.stores
    where name = 'Miscelánea La Esquina'$q$;
  if (select status from public.stores where name = 'Miscelánea La Esquina') <> 'retired'
    then raise exception 'TEST FAILED: retire broke'; end if;

  -- search no longer returns retired store
  select count(*) into n from public.search_stores();
  if n <> 3 then raise exception 'TEST FAILED: search returns % after retire', n; end if;

  -- orders metric RPC respects ownership
  select public.store_order_count(id) into n from public.stores
    where name = 'Panadería La Espiga';
  if n <> 2 then raise exception 'TEST FAILED: owner order count = %', n; end if;
  reset role;

  -- NON-admin cannot call the RPCs
  perform test_set_claims((select panadera from test_fixed), 'authenticated');
  execute 'set role authenticated';
  perform test_expect_error($q$select public.admin_set_featured(
      (select id from public.stores where name = 'NEARBUY'), true)$q$,
    'administrator role required');
  perform test_expect_error($q$select public.admin_review_store(
      (select id from public.stores where name = 'NEARBUY'), true)$q$,
    'administrator role required');
  reset role;

  -- demote vecina back to cliente (service context: clear claims FIRST,
  -- otherwise the role guard sees the previous test user and blocks it)
  perform test_set_claims(null, null);
  execute 'reset role';
  update public.profiles set role = 'cliente'
    where id = (select vecina from test_fixed);
end $$;

-- ---------------------------------------------------------------------------
-- 12. Featured badge cannot be injected at store creation (HU07 CA3, §8)
--     Regression: guard trigger only covered UPDATE; INSERT bypassed it.
-- ---------------------------------------------------------------------------
do $$
begin
  perform test_set_claims((select panadera from test_fixed), 'authenticated');
  execute 'reset role'; execute 'set role authenticated';
  perform test_expect_error($q$
    insert into public.stores (owner_id, name, store_type, address, barrio,
      whatsapp, opening_hours, location, is_featured)
    values ((select panadera from test_fixed), 'Featured Sin Permiso', 'Tienda',
      'c 2 #2-2', 'Castilla', '573006666666', '8-8',
      st_setsrid(st_makepoint(-74.1391, 4.5991), 4326), true)$q$,
    'row-level security');
  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- 13. Admin cannot edit commercial content directly (§8); RPC choke point
--     remains the only admin path. Regression: UPDATE policy was owner-or-admin.
-- ---------------------------------------------------------------------------
do $$
declare n int;
begin
  -- promote vecina to admin again (service context, cleared claims)
  perform test_set_claims(null, null);
  execute 'reset role';
  update public.profiles set role = 'administrador'
    where id = (select vecina from test_fixed);

  -- as admin through the regular API: foreign store rows are not updatable
  perform test_set_claims((select vecina from test_fixed), 'authenticated');
  execute 'set role authenticated';
  execute $q$update public.stores set name = 'Cambiado por admin'
    where name = 'Panadería La Espiga'$q$;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'TEST FAILED: admin edited commercial content directly'; end if;
  if exists (select 1 from public.stores where name = 'Cambiado por admin') then
    raise exception 'TEST FAILED: direct admin edit leaked';
  end if;

  -- the RPC choke point still works for the same admin
  execute $q$select public.admin_set_featured(id, false) from public.stores
    where name = 'NEARBUY'$q$;
  if (select is_featured from public.stores where name = 'NEARBUY')
    then raise exception 'TEST FAILED: admin RPC broke'; end if;

  -- demote back
  perform test_set_claims(null, null);
  reset role;
  update public.profiles set role = 'cliente'
    where id = (select vecina from test_fixed);
end $$;

-- ---------------------------------------------------------------------------
-- 14. Storage objects: private proofs and owner-scoped uploads (HU09 CA1)
-- ---------------------------------------------------------------------------
do $$
declare n int; public_bucket boolean; photo_limit bigint;
begin
  select b.public, b.file_size_limit into public_bucket, photo_limit
    from storage.buckets b where b.id = 'store-photos';
  if public_bucket is distinct from true then
    raise exception 'TEST FAILED: store photo bucket is not public';
  end if;
  if photo_limit <> 512000 then
    raise exception 'TEST FAILED: store photo bucket limit is %, expected 512000', photo_limit;
  end if;

  select b.public into public_bucket
    from storage.buckets b where b.id = 'store-verifications';
  if public_bucket is distinct from false then
    raise exception 'TEST FAILED: verification bucket is not private';
  end if;

  -- A merchant can upload a private document inside their own user folder.
  perform test_set_claims((select panadera from test_fixed), 'authenticated');
  execute 'reset role'; execute 'set role authenticated';
  insert into storage.objects (bucket_id, name, owner_id)
  values ('store-verifications',
    (select panadera::text from test_fixed) || '/store-1/rut.pdf',
    (select panadera from test_fixed));
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'TEST FAILED: owner could not upload verification document'; end if;
  insert into storage.objects (bucket_id, name, owner_id)
  values ('store-photos',
    (select panadera::text from test_fixed) || '/store-1/photo.jpg',
    (select panadera from test_fixed));
  reset role;

  -- A different merchant cannot upload into another user's folder.
  perform test_set_claims((select fruver from test_fixed), 'authenticated');
  execute 'set role authenticated';
  perform test_expect_error($q$
    insert into storage.objects (bucket_id, name, owner_id)
    values ('store-verifications',
      (select panadera::text from test_fixed) || '/store-1/forged.pdf',
      (select fruver from test_fixed))$q$,
    'row-level security');
  perform test_expect_error($q$
    insert into storage.objects (bucket_id, name, owner_id)
    values ('store-photos',
      (select panadera::text from test_fixed) || '/store-1/forged.jpg',
      (select fruver from test_fixed))$q$,
    'row-level security');
  select count(*) into n from storage.objects where bucket_id = 'store-verifications';
  if n <> 0 then raise exception 'TEST FAILED: foreign merchant reads private verification objects'; end if;
  reset role;

  -- The owner can read their private document; anonymous users cannot.
  perform test_set_claims((select panadera from test_fixed), 'authenticated');
  execute 'set role authenticated';
  select count(*) into n from storage.objects where bucket_id = 'store-verifications';
  if n <> 1 then raise exception 'TEST FAILED: owner cannot read verification object'; end if;
  reset role;
  perform test_set_claims(null, null);
  execute 'set role anon';
  select count(*) into n from storage.objects where bucket_id = 'store-verifications';
  if n <> 0 then raise exception 'TEST FAILED: anonymous user reads private verification object'; end if;
  reset role;

  -- Admin reviewers can inspect private proofs without granting public access.
  perform test_set_claims(null, null);
  update public.profiles set role = 'administrador'
    where id = (select vecina from test_fixed);
  perform test_set_claims((select vecina from test_fixed), 'authenticated');
  execute 'set role authenticated';
  select count(*) into n from storage.objects where bucket_id = 'store-verifications';
  if n <> 1 then raise exception 'TEST FAILED: administrator cannot read verification object'; end if;
  reset role;
  perform test_set_claims(null, null);
  update public.profiles set role = 'cliente'
    where id = (select vecina from test_fixed);
end $$;

-- ---------------------------------------------------------------------------
-- 15. Public pages read published stores and live products only (HU02 CA3)
-- ---------------------------------------------------------------------------
-- These are the exact query shapes of /tienda/[id] and the public catalog:
-- hiding a store (HU02 CA5) or never passing review (HU09) must take the whole
-- page away, not only the directory card.
do $$
declare target uuid; before_status public.store_status; n int;
begin
  select id, status into target, before_status from public.stores
    where name = 'Panadería La Espiga' limit 1;

  perform test_set_claims(null, null);
  execute 'reset role'; execute 'set role anon';
  select count(*) into n from public.stores
    where id = target and status = 'published';
  if n <> 1 then raise exception 'TEST FAILED: published store missing from its profile page'; end if;
  reset role;

  update public.stores set status = 'hidden' where id = target;
  perform test_set_claims(null, null);
  execute 'set role anon';
  select count(*) into n from public.stores
    where id = target and status = 'published';
  if n <> 0 then raise exception 'TEST FAILED: hidden store still readable by its profile page'; end if;
  select count(*) into n from public.products p
    where p.store_id = target and p.deleted_at is null;
  if n <> 0 then raise exception 'TEST FAILED: catalog of a hidden store leaked'; end if;
  reset role;

  update public.stores set status = before_status where id = target;

  perform test_set_claims(null, null);
  execute 'set role anon';
  select count(*) into n from public.stores where status = 'pending';
  if n <> 0 then raise exception 'TEST FAILED: store pending review is readable anonymously'; end if;
  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- 16. Reports: who files them, who reads them, and who may act on them (HU11)
-- ---------------------------------------------------------------------------
do $$
declare
  store_target uuid;
  product_target uuid;
  own_store_report uuid;
  own_product_report uuid;
  n int;
  own int;
  n_total int;
  before_hash text;
  after_hash text;
begin
  select id into store_target from public.stores where name = 'Fruver El Campo' limit 1;
  select id into product_target from public.products
    where deleted_at is null
    order by name
    limit 1;

  select coalesce(md5(string_agg(r.id::text || r.reporter_id::text
                                 || r.target::text || r.reason || r.status::text
                                 || r.created_at::text, ','
                                 order by r.created_at, r.id)), '')
    into before_hash from public.store_reports r;

  -- An anonymous visitor cannot report: the row has to say who reported it.
  perform test_set_claims(null, null);
  execute 'reset role'; execute 'set role anon';
  perform test_expect_error($q$
    insert into public.store_reports (reporter_id, target, store_id, reason)
    values (gen_random_uuid(), 'store',
            (select id from public.stores where name = 'Fruver El Campo' limit 1),
            'Tienda con información falsa')$q$,
    'row-level security');
  reset role;

  -- Nor can a client file a report under someone else's name; the refused
  -- insert leaves the table byte-identical.
  perform test_set_claims((select vecina from test_fixed), 'authenticated');
  execute 'reset role'; execute 'set role authenticated';
  perform test_expect_error($q$
    insert into public.store_reports (reporter_id, target, store_id, reason)
    values ((select panadera from test_fixed), 'store',
            (select id from public.stores where name = 'Fruver El Campo' limit 1),
            'Suplantación de reportero')$q$,
    'row-level security');
  reset role;

  select coalesce(md5(string_agg(r.id::text || r.reporter_id::text
                                 || r.target::text || r.reason || r.status::text
                                 || r.created_at::text, ','
                                 order by r.created_at, r.id)), '')
    into after_hash from public.store_reports r;
  if after_hash is distinct from before_hash then
    raise exception 'TEST FAILED: a refused report changed the table';
  end if;

  -- The reported target is exclusive: a row cannot be both a store and a
  -- product report (the CHECK is the second line of defence behind the UI).
  perform test_set_claims((select vecina from test_fixed), 'authenticated');
  execute 'reset role'; execute 'set role authenticated';
  perform test_expect_error($q$
    insert into public.store_reports (reporter_id, target, store_id, product_id, reason)
    values ((select vecina from test_fixed), 'store',
            (select id from public.stores where name = 'Fruver El Campo' limit 1),
            (select id from public.products where deleted_at is null order by name limit 1),
            'Dos objetivos en la misma fila')$q$,
    'report_target_exclusive');
  reset role;

  -- A client files one report per target, each against its own column.
  perform test_set_claims((select vecina from test_fixed), 'authenticated');
  execute 'reset role'; execute 'set role authenticated';
  select count(*) into own from public.store_reports
    where reporter_id = (select vecina from test_fixed);
  insert into public.store_reports (reporter_id, target, store_id, reason)
  values ((select vecina from test_fixed), 'store',
          (select id from public.stores where name = 'Fruver El Campo' limit 1),
          'La dirección no existe')
  returning id into own_store_report;
  insert into public.store_reports (reporter_id, target, product_id, reason)
  values ((select vecina from test_fixed), 'product',
          (select id from public.products where deleted_at is null order by name limit 1),
          'El precio que muestra es falso')
  returning id into own_product_report;

  select count(*) into n from public.store_reports
    where id in (own_store_report, own_product_report);
  if n <> 2 then raise exception 'TEST FAILED: client filed % of its 2 reports', n; end if;
  reset role;

  -- The reporter reads its own reports and nobody else's (the count is
  -- dynamic: earlier sections left reports of their own behind).
  perform test_set_claims((select vecina from test_fixed), 'authenticated');
  execute 'set role authenticated';
  select count(*) into n from public.store_reports;
  if n <> own + 2 then
    raise exception 'TEST FAILED: reporter reads % reports instead of %', n, own + 2;
  end if;
  reset role;

  perform test_set_claims((select fruver from test_fixed), 'authenticated');
  execute 'reset role'; execute 'set role authenticated';
  select count(*) into n from public.store_reports where id = any(array[own_store_report, own_product_report]);
  if n <> 0 then raise exception 'TEST FAILED: another merchant reads a client report'; end if;
  reset role;

  -- A client cannot rewrite or delete a report; the admin can only move its
  -- state through the RPC, never by touching the table directly.
  perform test_set_claims((select vecina from test_fixed), 'authenticated');
  execute 'reset role'; execute 'set role authenticated';
  update public.store_reports set status = 'resolved'
    where id = own_store_report;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'TEST FAILED: a client resolved % reports directly', n; end if;
  delete from public.store_reports where reporter_id = (select vecina from test_fixed);
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'TEST FAILED: a client deleted % reports directly', n; end if;
  reset role;

  -- Promoting a profile is a service-context operation: clear the client
  -- claims first or the guard sees the previous user.
  perform test_set_claims(null, null);
  execute 'reset role';
  update public.profiles set role = 'administrador'
    where id = (select vecina from test_fixed);
  perform test_set_claims((select vecina from test_fixed), 'authenticated');
  execute 'reset role'; execute 'set role authenticated';
  update public.store_reports set status = 'resolved'
    where id = own_store_report;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'TEST FAILED: an administrator bypassed the RPC with a direct write'; end if;
  reset role;
  -- Every moderation action is admin-only at the database.
  perform test_set_claims((select panadera from test_fixed), 'authenticated');
  execute 'reset role'; execute 'set role authenticated';
  perform test_expect_error(
    format('select public.admin_resolve_report(%L, %L)', own_store_report, 'resolved'),
    'administrator role required');
  perform test_expect_error(
    format('select public.admin_retire_store(%L)', store_target),
    'administrator role required');
  perform test_expect_error(
    format('select public.admin_remove_product(%L)', product_target),
    'administrator role required');
  reset role;

  -- The admin reviews the case and resolves it: the report survives, its
  -- state changes, and every report is readable for moderation.
  perform test_set_claims(null, null);
  execute 'reset role';
  update public.profiles set role = 'administrador'
    where id = (select vecina from test_fixed);
  perform test_set_claims((select vecina from test_fixed), 'authenticated');
  execute 'set role authenticated';
  select count(*) into n_total from public.store_reports;
  perform public.admin_resolve_report(own_store_report, 'resolved');
  select count(*) into n from public.store_reports;
  if n <> n_total then
    raise exception 'TEST FAILED: resolving a report changed the count (% vs %)', n, n_total;
  end if;
  select count(*) into n from public.store_reports
    where id = own_store_report and status = 'resolved';
  if n <> 1 then raise exception 'TEST FAILED: report not resolved by the administrator'; end if;
  perform test_expect_error(
    format('select public.admin_resolve_report(%L, %L)', gen_random_uuid(), 'resolved'),
    'report not found');

  -- HU11 CA3: a store with confirmed reports can be unpublished, and that
  -- takes it out of the public directory while its reports stay auditable.
  perform public.admin_retire_store(store_target);
  reset role;
  perform test_set_claims(null, null);
  execute 'set role anon';
  select count(*) into n from public.stores where id = store_target;
  if n <> 0 then raise exception 'TEST FAILED: a retired store is still public'; end if;
  reset role;

  perform test_set_claims((select vecina from test_fixed), 'authenticated');
  execute 'reset role'; execute 'set role authenticated';
  select count(*) into n from public.store_reports
    where id in (own_store_report, own_product_report);
  if n <> 2 then raise exception 'TEST FAILED: retiring the store lost its reports'; end if;
  reset role;

  -- Clean-up and restore: the reports created here go away and the store is
  -- published again, so the suite describes the seed when it ends.
  perform test_set_claims(null, null);
  execute 'reset role';
  delete from public.store_reports
    where id in (own_store_report, own_product_report);
  update public.stores set status = 'published' where id = store_target;
  update public.profiles set role = 'cliente'
    where id = (select vecina from test_fixed);
end $$;

-- ---------------------------------------------------------------------------
-- 17. U7 probes: embed topology, admin reads, home filter, product retreat
-- ---------------------------------------------------------------------------
do $$
declare
  vecina uuid := (select vecina from test_fixed);
  store_target uuid; product_target uuid; report_id uuid; n int;
  fk_stores int; fk_products int;
begin
  select id into store_target from public.stores
    where status = 'published' and not is_featured order by name limit 1;
  select id into product_target from public.products
    where deleted_at is null order by name limit 1;

  -- PostgREST embeds stores(name)/products(name): exactly one FK each.
  select count(*) into fk_stores from pg_constraint
    where conrelid = 'public.store_reports'::regclass and contype = 'f'
      and confrelid = 'public.stores'::regclass;
  select count(*) into fk_products from pg_constraint
    where conrelid = 'public.store_reports'::regclass and contype = 'f'
      and confrelid = 'public.products'::regclass;
  if fk_stores <> 1 or fk_products <> 1 then
    raise exception 'TEST FAILED: ambiguous report embed (%/%)', fk_stores, fk_products;
  end if;

  -- Admin reads non-published stores (the panel's pending query); anon reads
  -- neither them nor any report.
  perform test_set_claims(null, null); execute 'reset role';
  update public.profiles set role = 'administrador' where id = vecina;
  perform test_set_claims(vecina, 'authenticated'); execute 'set role authenticated';
  select count(*) into n from public.stores where status = 'retired';
  if n < 1 then raise exception 'TEST FAILED: admin cannot see retired stores'; end if;
  reset role;
  perform test_set_claims(null, null); execute 'reset role'; execute 'set role anon';
  select count(*) into n from public.stores where status = 'retired';
  if n <> 0 then raise exception 'TEST FAILED: anon sees % retired stores', n; end if;
  select count(*) into n from public.store_reports;
  if n <> 0 then raise exception 'TEST FAILED: anon reads % reports', n; end if;
  reset role;

  -- Home query shape: only published AND featured rows reach the section.
  perform test_set_claims(vecina, 'authenticated'); execute 'reset role'; execute 'set role authenticated';
  perform public.admin_set_featured(store_target, true);
  reset role;
  perform test_set_claims(null, null); execute 'reset role'; execute 'set role anon';
  select count(*) into n from public.stores
    where id = store_target and status = 'published' and is_featured;
  if n <> 1 then raise exception 'TEST FAILED: featured published store missing from home query'; end if;
  reset role;

  perform test_set_claims(vecina, 'authenticated'); execute 'reset role'; execute 'set role authenticated';
  perform public.admin_retire_store(store_target);
  reset role;
  perform test_set_claims(null, null); execute 'reset role'; execute 'set role anon';
  select count(*) into n from public.stores
    where id = store_target and status = 'published' and is_featured;
  if n <> 0 then raise exception 'TEST FAILED: retired featured store reaches the home query'; end if;
  reset role;
  perform test_set_claims(vecina, 'authenticated'); execute 'reset role'; execute 'set role authenticated';
  perform test_expect_error(
    format('select public.admin_set_featured(%L, true)', store_target),
    'store not found or not published');
  reset role;
  perform test_set_claims(null, null); execute 'reset role';
  update public.stores set status = 'published' where id = store_target;

  -- Removing a reported product keeps its report and soft-deletes the row.
  insert into public.store_reports (reporter_id, target, product_id, reason)
    values (vecina, 'product', product_target, 'Precio falso (U7 probe)')
    returning id into report_id;
  perform test_set_claims(vecina, 'authenticated'); execute 'reset role'; execute 'set role authenticated';
  perform public.admin_remove_product(product_target);
  select count(*) into n from public.store_reports where id = report_id;
  if n <> 1 then raise exception 'TEST FAILED: product removal deleted its report'; end if;
  select count(*) into n from public.products
    where id = product_target and deleted_at is not null;
  if n <> 1 then raise exception 'TEST FAILED: product not soft-deleted'; end if;
  reset role;

  -- Restore the seed state.
  perform test_set_claims(null, null); execute 'reset role';
  delete from public.store_reports where id = report_id;
  update public.products set deleted_at = null where id = product_target;
  update public.stores set is_featured = false, status = 'published' where id = store_target;
  update public.profiles set role = 'cliente' where id = vecina;
end $$;

select 'RLS SUITE: ALL TESTS PASSED';
