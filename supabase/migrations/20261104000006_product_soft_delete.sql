-- Products referenced by HU11 reports must remain available for moderation.
-- Merchant and administrator removals therefore use a tombstone instead of
-- physically deleting the referenced row.

alter table public.products
  add column if not exists deleted_at timestamptz;

drop policy if exists products_select_visible_with_store on public.products;
create policy products_select_visible_with_store
  on public.products for select
  using (
    public.is_admin()
    or public.is_store_owner(store_id)
    or (
      deleted_at is null
      and exists (
        select 1 from public.stores s
        where s.id = store_id and s.status = 'published'
      )
    )
  );

-- Product removal is represented by setting deleted_at. Keeping the owner
-- DELETE policy would allow a direct API DELETE to cascade store_reports.
drop policy if exists products_delete_owner on public.products;

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

  update public.products
  set deleted_at = coalesce(deleted_at, now())
  where id = p_product_id;

  if not found then
    raise 'product not found';
  end if;
end;
$$;

create or replace function public.refresh_product_price_updated_at()
returns trigger
language plpgsql
as $$
begin
  if new.price is distinct from old.price then
    new.price_updated_at := now();
  else
    new.price_updated_at := old.price_updated_at;
  end if;
  return new;
end;
$$;

drop trigger if exists products_refresh_price_updated_at on public.products;
create trigger products_refresh_price_updated_at
  before update of price, price_updated_at on public.products
  for each row execute function public.refresh_product_price_updated_at();
