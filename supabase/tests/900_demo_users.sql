-- DEMO ACCOUNTS — used by the local harness and by a hosted demo project.
-- In a real project these exist because people actually signed up
-- (or were created via the Supabase dashboard). The administrator is the one
-- exception: HU09 CA4 says the team creates it, and the seed does that here so
-- a demo never needs a manual promotion.
--
-- Seeding auth.users by hand must mirror what GoTrue itself writes, or the
-- rows can sign up but can never log in:
--   instance_id             multi-tenant scope; NULL rows are invisible to lookups
--   aud + role              the password grant filters by audience 'authenticated'
--   *_token / *_change      GoTrue scans these into non-nullable Go strings, so
--                           NULL makes login fail with "Database error querying schema"

insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-000000000001', 'panadera@barrioshop.demo',
   extensions.crypt('BarrioShop2026!', extensions.gen_salt('bf', 8)), now(), '{"full_name":"Rosa Espiga"}'),
  ('a0000000-0000-4000-8000-000000000002', 'fruver@barrioshop.demo',
   extensions.crypt('BarrioShop2026!', extensions.gen_salt('bf', 8)), now(), '{"full_name":"Jorge El Campo"}'),
  ('a0000000-0000-4000-8000-000000000003', 'tienda@barrioshop.demo',
   extensions.crypt('BarrioShop2026!', extensions.gen_salt('bf', 8)), now(), '{"full_name":"Ana Nearbuy"}'),
  ('a0000000-0000-4000-8000-000000000004', 'vecina@barrioshop.demo',
   extensions.crypt('BarrioShop2026!', extensions.gen_salt('bf', 8)), now(), '{"full_name":"María Vecina"}'),
  ('a0000000-0000-4000-8000-000000000005', 'admin@barrioshop.demo',
   extensions.crypt('BarrioShop2026!', extensions.gen_salt('bf', 8)), now(), '{"full_name":"Admin BarrioShop"}')
on conflict (id) do update
  set encrypted_password = excluded.encrypted_password,
      email_confirmed_at = now();

-- Normalize every demo account (idempotent, also repairs rows from an older seed).
update auth.users
set instance_id = '00000000-0000-0000-0000-000000000000',
    aud = 'authenticated',
    role = 'authenticated',
    confirmation_token = '',
    recovery_token = '',
    email_change_token_new = '',
    email_change_token_current = '',
    email_change = '',
    phone_change = '',
    phone_change_token = '',
    reauthentication_token = '',
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    created_at = coalesce(created_at, now()),
    updated_at = now(),
    raw_app_meta_data = coalesce(raw_app_meta_data, '{"provider":"email","providers":["email"]}'::jsonb)
where email like '%@barrioshop.demo';

-- The on_auth_user_created trigger creates the profile as `cliente`. Promote
-- the seeded administrator afterwards; auth.uid() is null in the SQL editor
-- (and in the harness), which the role guard treats as a trusted context.
insert into public.profiles (id, full_name)
select id, coalesce(raw_user_meta_data->>'full_name', 'Admin BarrioShop')
from auth.users
where email = 'admin@barrioshop.demo'
on conflict (id) do nothing;

update public.profiles
set role = 'administrador',
    full_name = coalesce(nullif(full_name, ''), 'Admin BarrioShop')
where id = (select id from auth.users where email = 'admin@barrioshop.demo');

-- Keep the demo client a client: the seeded administrator is the only admin.
update public.profiles
set role = 'cliente'
where id = (select id from auth.users where email = 'vecina@barrioshop.demo');
