-- LOCAL TEST HARNESS ONLY — never run in a real Supabase project.
-- Emulates the minimal Supabase auth contract that the migrations depend on
-- (auth schema, auth.users, auth.uid(), anon/authenticated roles) so the
-- real migrations and RLS policies can be verified against plain PostGIS
-- inside docker compose.

-- Emulates the Supabase schema layout: pgcrypto lives in `extensions`.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists auth;
create schema if not exists storage;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  encrypted_password text,
  email_confirmed_at timestamptz,
  -- GoTrue scopes logins by these; real Supabase defaults them to ''/null.
  -- instance_id is the multi-tenant key: NULL rows are invisible to GoTrue.
  instance_id uuid not null default '00000000-0000-0000-0000-000000000000',
  aud text not null default '',
  role text not null default '',
  -- GoTrue scans these into non-nullable Go strings: they must be '', not NULL.
  confirmation_token text not null default '',
  recovery_token text not null default '',
  email_change_token_new text not null default '',
  email_change_token_current text not null default '',
  email_change text not null default '',
  phone_change text not null default '',
  phone_change_token text not null default '',
  reauthentication_token text not null default '',
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  raw_app_meta_data jsonb not null default '{"provider":"email","providers":["email"]}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    'anon'
  )
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end;
$$;

grant usage on schema public, auth to anon, authenticated;
grant execute on all functions in schema auth to anon, authenticated;

-- Minimal local-only stand-in for Supabase Storage metadata tables. The real
-- hosted service owns these tables; this harness only exercises our RLS rules.
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets (id),
  name text not null,
  owner_id uuid
);

insert into storage.buckets (id, name, public)
values ('store-photos', 'store-photos', true),
       ('store-verifications', 'store-verifications', false)
on conflict (id) do nothing;

create or replace function storage.foldername(object_name text)
returns text[]
language sql
immutable
as $$
  select coalesce(
    (string_to_array(object_name, '/'))[1:greatest(array_length(string_to_array(object_name, '/'), 1) - 1, 0)],
    array[]::text[]
  )
$$;

grant usage on schema storage to anon, authenticated;
grant execute on all functions in schema storage to anon, authenticated;
grant select, insert, delete on storage.objects to anon, authenticated;
grant select on storage.buckets to anon, authenticated;
alter default privileges in schema storage grant all on tables to anon, authenticated;

-- Emulates Supabase's PostgREST grants for objects created later
-- (RLS policies, not table grants, are what actually restrict access).
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
