-- RUN ONLY IN: Percent (gijyjdeohvdrnvqfqdha) -> SQL Editor.
-- Prepared for manual execution. Adds one RPC; no tables/columns/schemas.
-- Target quantities are cumulative. Existing physical pieces are never moved,
-- deleted, withdrawn, sold, or recreated by this allocation-only operation.
begin;

create function public.allocate_product_run(
 product_id uuid,
 allocations jsonb,
 expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
 p public.products;
 item jsonb;
 selected_variant_id uuid;  
 target_quantity integer;
 current_quantity integer;
 total_quantity bigint := 0;
 allocated_quantity integer;
 added_quantity integer := 0;
 inserted_quantity integer;
 previous_reason text;
begin
 if auth.uid() is null or not private.is_admin() then
  raise exception 'Admin access required' using errcode = '42501';
 end if;
 if product_id is null or expected_updated_at is null then
  raise exception 'Product and current version are required' using errcode = '22023';
 end if;
 if jsonb_typeof(allocations) is distinct from 'array' then
  raise exception 'Variant allocation array required' using errcode = '22023';
 end if;

 -- Same lock used by the product editor and existing physical-unit trigger.
 select * into p from public.products where id = product_id for update;
 if not found then raise exception 'Product unavailable' using errcode = '42501'; end if;
 if p.updated_at is distinct from expected_updated_at then
  raise exception 'Inventory was updated elsewhere' using errcode = 'PT409';
 end if;
 if p.status <> 'draft' or p.archived_at is not null or p.sold_out_at is not null then
  raise exception 'Only an eligible draft can receive production allocation' using errcode = '22023';
 end if;
 if exists(select 1 from public.inventory_units u where u.product_id = p.id and (u.sold_at is not null or u.withdrawn_at is not null))
    or exists(select 1 from public.order_items oi where oi.product_id = p.id) then
  raise exception 'Production with sale, withdrawal or order history is locked' using errcode = '22023';
 end if;
 perform v.id from public.product_variants v where v.product_id = p.id order by v.id for update;

 for item in select value from jsonb_array_elements(allocations) loop
  if jsonb_typeof(item) is distinct from 'object' then
   raise exception 'Invalid variant allocation' using errcode = '22023';
  end if;
  if exists(select 1 from jsonb_object_keys(item) k where k not in ('variant_id','quantity'))
     or jsonb_typeof(item->'variant_id') is distinct from 'string'
     or (item->>'variant_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or jsonb_typeof(item->'quantity') is distinct from 'number'
     or (item->>'quantity') !~ '^(0|[1-9][0-9]*)$' then
   raise exception 'Use a variant UUID and a non-negative whole quantity only' using errcode = '22023';
  end if;
  if (item->>'quantity')::numeric > p.production_limit then
   raise exception 'Allocation exceeds the configured production limit' using errcode = '22023';
  end if;
  selected_variant_id := (item->>'variant_id')::uuid;
  target_quantity := (item->>'quantity')::integer;
  if not exists(select 1 from public.product_variants v where v.id = selected_variant_id and v.product_id = p.id) then
   raise exception 'Variant does not belong to this product' using errcode = '22023';
  end if;
  select count(*) into current_quantity from public.inventory_units u where u.variant_id = selected_variant_id;
  if target_quantity < current_quantity then
   raise exception 'Existing physical allocation cannot be reduced or reassigned' using errcode = '22023';
  end if;
  if target_quantity > current_quantity and not exists(select 1 from public.product_variants v where v.id = selected_variant_id and v.enabled) then
   raise exception 'Disabled variants cannot receive new allocation' using errcode = '22023';
  end if;
  total_quantity := total_quantity + target_quantity;
 end loop;
 if jsonb_array_length(allocations) <> (select count(distinct (x->>'variant_id')::uuid) from jsonb_array_elements(allocations) x) then
  raise exception 'Duplicate variant allocation' using errcode = '22023';
 end if;
 if jsonb_array_length(allocations) = 0
    or jsonb_array_length(allocations) <> (select count(*) from public.product_variants v where v.product_id = p.id) then
  raise exception 'Submit every existing variant exactly once' using errcode = '22023';
 end if;
 if total_quantity > p.production_limit then
  raise exception 'Allocation exceeds the configured production limit' using errcode = '22023';
 end if;

 previous_reason := current_setting('percent.inventory_reason', true);
 perform set_config('percent.inventory_reason', 'Production allocation', true);
 for item in select value from jsonb_array_elements(allocations) order by value->>'variant_id' loop
  selected_variant_id := (item->>'variant_id')::uuid;
  target_quantity := (item->>'quantity')::integer;
  select count(*) into current_quantity from public.inventory_units u where u.variant_id = selected_variant_id;
  if target_quantity > current_quantity then
   insert into public.inventory_units(product_id, variant_id, piece_number)
   select p.id, selected_variant_id, serial
   from generate_series(1, p.production_limit) as serial
   where not exists(select 1 from public.inventory_units u where u.product_id = p.id and u.piece_number = serial)
   order by serial limit (target_quantity - current_quantity);
   get diagnostics inserted_quantity = row_count;
   if inserted_quantity <> target_quantity - current_quantity then
    raise exception 'Not enough unused production serials' using errcode = '22023';
   end if;
   added_quantity := added_quantity + inserted_quantity;
  end if;
 end loop;
 perform set_config('percent.inventory_reason', coalesce(previous_reason, ''), true);
 select count(*) into allocated_quantity from public.inventory_units u where u.product_id = p.id;
 if added_quantity > 0 then
  -- Existing timestamp/audit triggers run; no lifecycle or limit field changes.
  update public.products set updated_at = now() where id = p.id returning * into p;
 end if;
 return jsonb_build_object('id',p.id,'updated_at',p.updated_at,'allocated',allocated_quantity,
  'remaining_to_allocate',p.production_limit - allocated_quantity,'added',added_quantity);
end;
$$;

revoke all on function public.allocate_product_run(uuid,jsonb,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.allocate_product_run(uuid,jsonb,timestamptz) to authenticated;

commit;
