-- One editor transaction. Existing RLS, audit triggers and immutable-run guards
-- remain authoritative. No inventory mutation and no elevated execution rights.
create or replace function public.save_product_draft(draft jsonb, product_id uuid default null, expected_updated_at timestamptz default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
 p public.products; fields jsonb; v jsonb; i jsonb; link jsonb; saved_id uuid;
 variant_id uuid; image_id uuid; price integer; run_limit integer; offset_order integer;
begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if jsonb_typeof(draft) is distinct from 'object' or exists(select 1 from jsonb_object_keys(draft) k where k not in ('product','tags','variants','images','variant_images')) then
  raise exception 'Unsupported editor fields' using errcode='22023';
 end if;
 fields=draft->'product';
 if jsonb_typeof(fields) is distinct from 'object' or exists(select 1 from jsonb_object_keys(fields) k where k not in ('name','slug','design_code','short_description','full_description','price_paise','compare_at_price_paise','category_id','fit_type','production_limit','material','style','care_instructions','shipping_and_returns')) then
  raise exception 'Unsupported product fields' using errcode='22023';
 end if;
 if jsonb_typeof(draft->'tags') is distinct from 'array' or jsonb_typeof(draft->'variants') is distinct from 'array' or jsonb_typeof(draft->'images') is distinct from 'array' or jsonb_typeof(draft->'variant_images') is distinct from 'array' then raise exception 'Editor relations required' using errcode='22023'; end if;
 if nullif(btrim(fields->>'name'),'') is null or (fields->>'price_paise') is null or (fields->>'price_paise') !~ '^[0-9]+$' or (fields->>'production_limit') is null or (fields->>'production_limit') !~ '^[1-9][0-9]*$' then raise exception 'Invalid name, price or production limit' using errcode='22023'; end if;
 price=(fields->>'price_paise')::integer;run_limit=(fields->>'production_limit')::integer;
 if fields->>'fit_type' is null or fields->>'fit_type' not in ('standard','oversized') then raise exception 'Invalid fit' using errcode='22023'; end if;
 if fields->>'compare_at_price_paise' is not null and ((fields->>'compare_at_price_paise') !~ '^[0-9]+$' or (fields->>'compare_at_price_paise')::bigint < price) then raise exception 'Invalid comparison price' using errcode='22023'; end if;
 if product_id is null then
  if expected_updated_at is not null then raise exception 'Unexpected version' using errcode='22023'; end if;
  if nullif(btrim(fields->>'design_code'),'') is null or fields->>'slug' is null or (fields->>'slug') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'Invalid design identity' using errcode='22023'; end if;
  insert into public.products(name,slug,design_code,fit_type,price_paise,production_limit,status,is_visible,is_shop_available)
  values(btrim(fields->>'name'),fields->>'slug',btrim(fields->>'design_code'),fields->>'fit_type',price,run_limit,'draft',false,false) returning * into p;
 else
  select * into p from public.products where id=product_id for update;
  if not found then raise exception 'Product unavailable' using errcode='42501'; end if;
  if p.status<>'draft' or p.sold_out_at is not null then raise exception 'Only editable drafts may be saved' using errcode='22023'; end if;
  if expected_updated_at is null or p.updated_at is distinct from expected_updated_at then raise exception 'Product changed; reload before saving' using errcode='PT409'; end if;
  if (fields->>'slug') is distinct from p.slug or (fields->>'design_code') is distinct from p.design_code then raise exception 'Design identity is immutable' using errcode='22023'; end if;
  if run_limit<>p.production_limit and exists(select 1 from public.inventory_units where inventory_units.product_id=p.id) then raise exception 'Allocated production limit is locked' using errcode='22023'; end if;
 end if;
 saved_id=p.id;
 update public.products set name=btrim(fields->>'name'),short_description=coalesce(fields->>'short_description',''),full_description=coalesce(fields->>'full_description',''),price_paise=price,compare_at_price_paise=(fields->>'compare_at_price_paise')::integer,category_id=(fields->>'category_id')::uuid,fit_type=fields->>'fit_type',production_limit=run_limit,material=fields->>'material',style=fields->>'style',care_instructions=fields->>'care_instructions',shipping_and_returns=fields->>'shipping_and_returns' where id=saved_id;
 -- Existing variants may be disabled, never silently deleted or repurposed.
 if exists(select 1 from public.product_variants old where old.product_id=saved_id and not exists(select 1 from jsonb_array_elements(draft->'variants') x where (x->>'id')::uuid=old.id)) then raise exception 'Existing variants cannot be removed' using errcode='22023'; end if;
 if (select count(*) from jsonb_array_elements(draft->'variants'))<>(select count(distinct (x->>'colour_id',x->>'size')) from jsonb_array_elements(draft->'variants') x) then raise exception 'Duplicate variant combination' using errcode='23505'; end if;
 if (select count(*) from jsonb_array_elements(draft->'variants'))<>(select count(distinct btrim(x->>'sku')) from jsonb_array_elements(draft->'variants') x) then raise exception 'Duplicate SKU' using errcode='23505'; end if;
 if (select count(x->>'id') from jsonb_array_elements(draft->'variants') x)<>(select count(distinct x->>'id') from jsonb_array_elements(draft->'variants') x) then raise exception 'Duplicate variant identity' using errcode='22023'; end if;
 for v in select value from jsonb_array_elements(draft->'variants') loop
  if jsonb_typeof(v) is distinct from 'object' or exists(select 1 from jsonb_object_keys(v) k where k not in ('id','colour_id','size','sku','price_paise','compare_at_price_paise','enabled')) then raise exception 'Unsupported variant fields' using errcode='22023'; end if;
  if nullif(btrim(v->>'sku'),'') is null or nullif(btrim(v->>'size'),'') is null or v->>'colour_id' is null or (v->>'price_paise') is null or (v->>'price_paise') !~ '^[0-9]+$' or jsonb_typeof(v->'enabled') is distinct from 'boolean' then raise exception 'Invalid variant' using errcode='22023'; end if;
  variant_id=coalesce((v->>'id')::uuid,gen_random_uuid());
  if exists(select 1 from public.product_variants pv where pv.id=variant_id and pv.product_id<>saved_id) then raise exception 'Variant belongs to another product' using errcode='42501'; end if;
  if exists(select 1 from public.product_variants pv where pv.id=variant_id and (exists(select 1 from public.inventory_units u where u.variant_id=pv.id) or exists(select 1 from public.order_items oi where oi.variant_id=pv.id)) and (pv.colour_id,pv.size,pv.sku) is distinct from ((v->>'colour_id')::uuid,btrim(v->>'size'),btrim(v->>'sku'))) then raise exception 'Variant identity has history' using errcode='22023'; end if;
  insert into public.product_variants(id,product_id,colour_id,size,sku,price_paise,compare_at_price_paise,enabled) values(variant_id,saved_id,(v->>'colour_id')::uuid,btrim(v->>'size'),btrim(v->>'sku'),(v->>'price_paise')::integer,(v->>'compare_at_price_paise')::integer,(v->>'enabled')::boolean)
  on conflict(id) do update set colour_id=excluded.colour_id,size=excluded.size,sku=excluded.sku,price_paise=excluded.price_paise,compare_at_price_paise=excluded.compare_at_price_paise,enabled=excluded.enabled;
 end loop;
 delete from public.product_tags where product_tags.product_id=saved_id;
 insert into public.product_tags(product_id,tag_id) select saved_id,(value#>>'{}')::uuid from jsonb_array_elements(draft->'tags');
 -- Validate identities before touching relations. Existing URLs cannot be swapped.
 for i in select value from jsonb_array_elements(draft->'images') loop
  if jsonb_typeof(i) is distinct from 'object' or exists(select 1 from jsonb_object_keys(i) k where k not in ('id','url','alt','width','height','role','sort_order')) then raise exception 'Unsupported image fields' using errcode='22023'; end if;
  image_id=(i->>'id')::uuid;
  if image_id is null or i->>'url' is null or i->>'alt' is null or (i->>'width') is null or (i->>'width') !~ '^[1-9][0-9]*$' or (i->>'height') is null or (i->>'height') !~ '^[1-9][0-9]*$' or (i->>'sort_order') is null or (i->>'sort_order') !~ '^[0-9]+$' or (i->>'sort_order')::bigint>1000000 then raise exception 'Invalid image metadata' using errcode='22023'; end if;
  if exists(select 1 from public.product_images pi where pi.id=image_id and (pi.product_id<>saved_id or pi.url<>i->>'url')) then raise exception 'Image identity is immutable' using errcode='42501'; end if;
  if not exists(select 1 from public.product_images pi where pi.id=image_id) and (i->>'url') !~ ('^storage://percent-product-images/products/'||saved_id::text||'/[0-9a-f]{64}\.(jpg|png|webp)$') then raise exception 'Product-scoped uploaded image required' using errcode='22023'; end if;
 end loop;
 if (select count(*) from jsonb_array_elements(draft->'images'))<>(select count(distinct x->>'id') from jsonb_array_elements(draft->'images') x) or (select count(*) from jsonb_array_elements(draft->'images'))<>(select count(distinct (x->>'sort_order')::integer) from jsonb_array_elements(draft->'images') x) or (select count(*) from jsonb_array_elements(draft->'images') x where x->>'role'='primary')>1 then raise exception 'Duplicate image identity, order or primary' using errcode='22023'; end if;
 delete from public.variant_images where variant_images.product_id=saved_id;
 delete from public.product_images pi where pi.product_id=saved_id and not exists(select 1 from jsonb_array_elements(draft->'images') x where (x->>'id')::uuid=pi.id);
 select coalesce(max(sort_order),0)+1000001 into offset_order from public.product_images where product_images.product_id=saved_id;
 update public.product_images set sort_order=sort_order+offset_order where product_images.product_id=saved_id;
 for i in select value from jsonb_array_elements(draft->'images') loop
  insert into public.product_images(id,product_id,url,alt,width,height,role,sort_order) values((i->>'id')::uuid,saved_id,i->>'url',i->>'alt',(i->>'width')::integer,(i->>'height')::integer,i->>'role',(i->>'sort_order')::integer)
  on conflict(id) do update set alt=excluded.alt,width=excluded.width,height=excluded.height,role=excluded.role,sort_order=excluded.sort_order;
 end loop;
 for link in select value from jsonb_array_elements(draft->'variant_images') loop
  if jsonb_typeof(link) is distinct from 'object' or exists(select 1 from jsonb_object_keys(link) k where k not in ('variant_id','image_id','sort_order')) then raise exception 'Invalid variant image fields' using errcode='22023'; end if;
  insert into public.variant_images(product_id,variant_id,image_id,sort_order) values(saved_id,(link->>'variant_id')::uuid,(link->>'image_id')::uuid,(link->>'sort_order')::integer);
 end loop;
 select * into p from public.products where id=saved_id;
 return jsonb_build_object('id',p.id,'updated_at',p.updated_at,'status',p.status);
end $$;
