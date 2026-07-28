-- SK POS: public product/ad image storage
-- Run once in Supabase Dashboard > SQL Editor.
-- The browser uses a publishable key, so access is scoped to this bucket only.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'product-images',
  'product-images',
  true,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
    'application/json'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "sk_product_images_read" on storage.objects;
create policy "sk_product_images_read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'product-images');

drop policy if exists "sk_product_images_insert" on storage.objects;
create policy "sk_product_images_insert"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'product-images');

drop policy if exists "sk_product_images_update" on storage.objects;
create policy "sk_product_images_update"
on storage.objects
for update
to anon, authenticated
using (bucket_id = 'product-images')
with check (bucket_id = 'product-images');

drop policy if exists "sk_product_images_delete" on storage.objects;
create policy "sk_product_images_delete"
on storage.objects
for delete
to anon, authenticated
using (bucket_id = 'product-images');
