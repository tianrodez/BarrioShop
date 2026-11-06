-- HU02 store photos are public content; HU09 verification documents are private.
-- The public API never stores verification paths in the public stores row.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'store-photos',
    'store-photos',
    true,
    512000,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'store-verifications',
    'store-verifications',
    false,
    52428800,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table storage.objects enable row level security;

drop policy if exists store_photos_insert_owner on storage.objects;
create policy store_photos_insert_owner
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'store-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists store_photos_delete_owner on storage.objects;
create policy store_photos_delete_owner
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'store-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists store_verifications_insert_owner on storage.objects;
create policy store_verifications_insert_owner
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'store-verifications'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists store_verifications_select_owner_or_admin on storage.objects;
create policy store_verifications_select_owner_or_admin
  on storage.objects for select to authenticated
  using (
    bucket_id = 'store-verifications'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

drop policy if exists store_verifications_delete_owner_or_admin on storage.objects;
create policy store_verifications_delete_owner_or_admin
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'store-verifications'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );
