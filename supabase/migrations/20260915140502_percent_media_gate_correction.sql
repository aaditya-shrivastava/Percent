-- Correct the manually deployed image pattern and align visible archived media
-- with the existing public product/image RLS. No tables, columns or bucket changes.
begin;

drop policy if exists percent_active_product_image_signing on storage.objects;
create policy percent_active_product_image_signing on storage.objects
for select to anon, authenticated
using (
  bucket_id = 'percent-product-images'
  and storage.allow_any_operation(array['object.sign', 'object.sign_many'])
  and exists (
    select 1
    from public.product_images i
    join public.products p on p.id = i.product_id
    where i.url = 'storage://percent-product-images/' || storage.objects.name
      and p.status in ('active', 'archived')
      and p.is_visible
  )
);

create or replace function public.publish_product(product_id uuid, expected_updated_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  product public.products;
  enabled_variants integer;
  produced integer;
  eligible integer;
  sold integer;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if product_id is null or expected_updated_at is null then
    raise exception 'Product and current version are required' using errcode = '22023';
  end if;

  select p.* into product
  from public.products p
  where p.id = product_id
  for update;
  if not found then
    raise exception 'Product unavailable' using errcode = '42501';
  end if;
  if product.updated_at is distinct from expected_updated_at then
    raise exception 'Product was updated elsewhere' using errcode = 'PT409';
  end if;
  if product.status <> 'draft' or product.archived_at is not null or product.sold_out_at is not null then
    raise exception 'Only an eligible draft can be published' using errcode = '22023';
  end if;
  if product.name like '[Verification]%' then
    raise exception 'Verification products cannot be published' using errcode = '22023';
  end if;
  if nullif(btrim(product.name),'') is null
     or nullif(btrim(product.slug),'') is null
     or nullif(btrim(product.design_code),'') is null
     or product.price_paise <= 0
     or product.production_limit <= 0
     or product.fit_type not in ('standard','oversized')
     or product.category_id is null
     or not exists(select 1 from public.categories c where c.id = product.category_id and c.active) then
    raise exception 'Complete the required product information before publishing' using errcode = '22023';
  end if;

  perform v.id from public.product_variants v
  where v.product_id = product.id order by v.id for update;
  select count(*) into enabled_variants
  from public.product_variants v
  where v.product_id = product.id and v.enabled;
  if enabled_variants = 0 then
    raise exception 'At least one enabled variant is required' using errcode = '22023';
  end if;
  if exists(
    select 1 from public.product_variants v
    where v.product_id = product.id and v.enabled
      and (nullif(btrim(v.sku),'') is null or nullif(btrim(v.size),'') is null or v.price_paise <= 0)
  ) then
    raise exception 'Every enabled variant needs valid identity, size, SKU and price' using errcode = '22023';
  end if;
  if not exists(
    select 1 from public.product_images i
    where i.product_id = product.id and i.role = 'primary'
      and (
        (i.url ~ '^https://' and i.url not like 'storage://%')
        or (
          i.url ~ ('^storage://percent-product-images/products/' || product.id::text || '/[0-9a-f]{64}\.(jpg|png|webp)$')
          and exists (
            select 1 from storage.objects o
            where o.bucket_id = 'percent-product-images'
              and i.url = 'storage://percent-product-images/' || o.name
          )
        )
      )
  ) then
    raise exception 'A publicly deliverable primary image is required' using errcode = '22023';
  end if;

  perform u.id from public.inventory_units u
  where u.product_id = product.id order by u.piece_number for update;
  select count(*),
         count(*) filter(where u.sold_at is null and u.withdrawn_at is null and v.enabled),
         count(*) filter(where u.sold_at is not null)
    into produced, eligible, sold
  from public.inventory_units u
  join public.product_variants v on v.id = u.variant_id and v.product_id = product.id
  where u.product_id = product.id;
  if produced > product.production_limit then
    raise exception 'Historical production exceeds the configured limit' using errcode = '22023';
  end if;
  if produced < product.production_limit then
    raise exception '% production units remain unallocated', product.production_limit - produced using errcode = '22023';
  end if;
  if sold > 0 then
    raise exception 'A draft with sales history requires lifecycle review' using errcode = '22023';
  end if;
  if eligible = 0 then
    raise exception 'No sellable physical inventory exists' using errcode = '22023';
  end if;

  update public.products
  set status = 'active',
      is_visible = true,
      is_shop_available = true,
      launch_at = coalesce(launch_at, now()),
      updated_at = now()
  where id = product.id
  returning * into product;

  return jsonb_build_object(
    'id', product.id,
    'status', product.status,
    'is_visible', product.is_visible,
    'is_shop_available', product.is_shop_available,
    'production_limit', product.production_limit,
    'historical_produced', produced,
    'eligible_stock', eligible,
    'enabled_variants', enabled_variants,
    'updated_at', product.updated_at
  );
end;
$$;

revoke all on function public.publish_product(uuid,timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.publish_product(uuid,timestamptz) to authenticated;

commit;

