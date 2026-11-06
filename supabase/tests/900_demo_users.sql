-- LOCAL TEST HARNESS ONLY — demo auth accounts for the RLS suite + seed.
-- In a real project these exist because people actually signed up
-- (or were created via the Supabase dashboard).
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
   extensions.crypt('BarrioShop2026!', extensions.gen_salt('bf', 8)), now(), '{"full_name":"María Vecina"}')
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
