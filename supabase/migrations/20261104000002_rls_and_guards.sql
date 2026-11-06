-- Row Level Security: authorization is enforced by the database engine, not
-- by the UI. Satisfies RNF-02 (per-store isolation), formulation §8
-- (roles/permissions matrix) and neutralizes the high risk "inadequate
-- validation of permissions and roles on the server side" (matrix §20).
--
-- Context conventions used by the guards below:
-- - auth.uid() is the caller's user id from the JWT; NULL in migrations,
--   seed scripts and service_role contexts (those legitimately bypass the
--   user-facing guards, but they still cannot match "id = auth.uid()"
--   policies, which stay closed).
-- - Admin operations go through SECURITY DEFINER RPCs (000003), a single
--   choke point per §8.

alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.store_verifications enable row level security;
alter table public.store_reports enable row level security;
alter table public.order_events enable row level security;
alter table public.barrio_reference_points enable row level security;

-- Helper functions run as owner (SECURITY DEFINER) to avoid recursive RLS on
-- profiles when evaluating policies.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'administrador'
  );
$$;

create or replace function public.is_store_owner(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.stores
    where id = p_store_id and owner_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
-- Own row (or admin). No public reads of names/roles beyond that (§8 privacy).
create policy profiles_select_own_or_admin
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

-- Signup is automated by the 000001 trigger; this documents intent and blocks
-- any API insert of foreign/privileged rows.
create policy profiles_insert_self_as_cliente
  on public.profiles for insert
  with check (id = auth.uid() and role = 'cliente');

create policy profiles_update_own
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Role escalation guard:
--   All role changes require admin or a trusted non-request context. The
--   store-creation trigger uses a transaction-local marker while running as
--   its SECURITY DEFINER owner; direct API updates cannot set that context.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() is null or public.is_admin() then
      return new;
    end if;
    if current_user = 'postgres'
      and nullif(pg_catalog.current_setting('app.store_owner_promotion', true), '') = new.id::text then
      return new;
    end if;
    raise 'profile role can only be changed by an administrator';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ---------------------------------------------------------------------------
-- stores
-- ---------------------------------------------------------------------------
-- Public sees published; owners see their own (any status); admin sees all.
create policy stores_select_published_or_owner_or_admin
  on public.stores for select
  using (status = 'published' or owner_id = auth.uid() or public.is_admin());

-- New stores always start pending review (HU09 CA2), never self-featured
-- (HU07 CA3: the badge is a deliberate admin step; the BEFORE-UPDATE guard
-- alone does not cover INSERT paths).
create policy stores_insert_self_pending
  on public.stores for insert
  with check (owner_id = auth.uid() and status = 'pending' and not is_featured);

-- Owner-only (§8: the administrator does NOT edit commercial content).
-- Admin actions go exclusively through the SECURITY DEFINER RPCs (000003),
-- which bypass RLS as table owner while still checking is_admin() inside.
create policy stores_update_owner
  on public.stores for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Physical deletion is admin-only (retire flow, §7). Owners hide/retire via
-- status changes, never via DELETE.
create policy stores_delete_admin
  on public.stores for delete
  using (public.is_admin());

-- Column/transition guard for direct (non-admin) updates:
--   * is_featured is admin-only (HU07 payment is off-platform)
--   * status: owners may only toggle published <-> hidden (HU02 CA5).
--     Approving a review (pending -> published), rejecting, or retiring
--     require the admin RPCs.
--   * owner_id is immutable.
create or replace function public.guard_store_columns()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.is_featured is distinct from old.is_featured then
    raise 'is_featured is administrator-only';
  end if;

  if new.owner_id is distinct from old.owner_id then
    raise 'store ownership is immutable';
  end if;

  if new.status is distinct from old.status then
    if old.status = 'published' and new.status = 'hidden' then
      return new;
    end if;
    if old.status = 'hidden' and new.status = 'published' then
      return new;
    end if;
    raise 'status changes require administrator review';
  end if;

  return new;
end;
$$;

create trigger stores_guard_columns
  before update on public.stores
  for each row execute function public.guard_store_columns();

-- Creating a store turns its owner into a merchant (§8). This SECURITY
-- DEFINER trigger is the only authenticated-user path that may change a role;
-- its transaction-local marker is checked by guard_profile_role above.
create or replace function public.promote_owner_on_store()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.set_config('app.store_owner_promotion', new.owner_id::text, true);
  update public.profiles
  set role = 'comerciante'
  where id = new.owner_id and role = 'cliente';
  perform pg_catalog.set_config('app.store_owner_promotion', '', true);
  return new;
end;
$$;

create trigger stores_promote_owner
  after insert on public.stores
  for each row execute function public.promote_owner_on_store();

-- Trigger functions are not API RPCs; remove the default execute grants.
revoke all on function public.promote_owner_on_store() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
-- Visible with the store: published stores expose everything; owners and
-- admins always see their/all rows (HU03, RNF-02).
create policy products_select_visible_with_store
  on public.products for select
  using (
    public.is_admin()
    or public.is_store_owner(store_id)
    or exists (
      select 1 from public.stores s
      where s.id = store_id and s.status = 'published'
    )
  );

create policy products_insert_owner
  on public.products for insert
  with check (public.is_store_owner(store_id));

create policy products_update_owner
  on public.products for update
  using (public.is_store_owner(store_id))
  with check (public.is_store_owner(store_id));

create policy products_delete_owner
  on public.products for delete
  using (public.is_store_owner(store_id));

-- ---------------------------------------------------------------------------
-- store_verifications (private documents — HU09 CA1)
-- ---------------------------------------------------------------------------
create policy verifications_select_owner_or_admin
  on public.store_verifications for select
  using (public.is_store_owner(store_id) or public.is_admin());

create policy verifications_insert_owner
  on public.store_verifications for insert
  with check (public.is_store_owner(store_id));

-- ---------------------------------------------------------------------------
-- store_reports (HU11)
-- ---------------------------------------------------------------------------
create policy reports_insert_self
  on public.store_reports for insert
  with check (reporter_id = auth.uid());

create policy reports_select_own_or_admin
  on public.store_reports for select
  using (reporter_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- order_events (metrics only, formulation §18)
-- ---------------------------------------------------------------------------
-- Any client (even anonymous) may log the WhatsApp order click, but only for
-- published stores (HU06). Owner and admin can read them.
create policy order_events_insert_published_store
  on public.order_events for insert
  with check (
    (requester_id is null or requester_id = auth.uid())
    and exists (
      select 1 from public.stores s
      where s.id = store_id and s.status = 'published'
    )
  );

create policy order_events_select_owner_or_admin
  on public.order_events for select
  using (
    public.is_admin()
    or public.is_store_owner(store_id)
  );

-- ---------------------------------------------------------------------------
-- barrio_reference_points (public catalog data)
-- ---------------------------------------------------------------------------
create policy barrios_select_public
  on public.barrio_reference_points for select
  using (true);
