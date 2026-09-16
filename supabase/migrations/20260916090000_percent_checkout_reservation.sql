begin;

-- Existing orders have no checkout identity; only this trusted RPC may set it.
alter table public.orders
  add column checkout_key uuid,
  add column checkout_request jsonb,
  add constraint orders_checkout_identity_pair
    check ((checkout_key is null) = (checkout_request is null));
create unique index orders_customer_checkout_key
  on public.orders(user_id, checkout_key) where checkout_key is not null;

-- One historical row per exact piece/order item. Expired rows remain evidence.
create table public.checkout_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  inventory_unit_id uuid not null references public.inventory_units(id) on delete restrict,
  reserved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'active'
    check (status in ('active','expired','released','converted')),
  state_changed_at timestamptz,
  check (expires_at > reserved_at),
  check ((status = 'active') = (state_changed_at is null)),
  unique(order_id, inventory_unit_id)
);
create unique index one_active_checkout_per_piece
  on public.checkout_reservations(inventory_unit_id) where status = 'active';
create index checkout_reservations_order_idx
  on public.checkout_reservations(order_id);
create index checkout_reservations_active_expiry_idx
  on public.checkout_reservations(expires_at) where status = 'active';

alter table public.checkout_reservations enable row level security;
revoke all on public.checkout_reservations from public, anon, authenticated;
grant all on public.checkout_reservations to service_role;
-- No browser reads or writes of physical piece identities.

-- A single centrally adjustable policy, currently fifteen minutes.
create function private.checkout_reservation_ttl() returns interval
  language sql stable set search_path = ''
  as $$ select interval '15 minutes' $$;
revoke all on function private.checkout_reservation_ttl() from public, anon, authenticated;

-- Centralized checkout shipping policy. Percent currently uses free shipping.
-- Keep this server-side so future shipping rules can change without altering
-- the trusted checkout RPC contract.
create function private.checkout_shipping_paise(subtotal_paise bigint)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select 0::bigint
$$;
revoke all on function private.checkout_shipping_paise(bigint)
  from public, anon, authenticated;

create function private.guard_checkout_reservation() returns trigger
language plpgsql set search_path = '' as $$
declare
  item public.order_items;
  unit public.inventory_units;
begin
  if TG_OP = 'DELETE' then
    raise exception 'Checkout reservation history cannot be deleted';
  end if;
  if TG_OP = 'UPDATE' then
    if (new.id,new.order_id,new.order_item_id,new.inventory_unit_id,
        new.reserved_at,new.expires_at)
       is distinct from
       (old.id,old.order_id,old.order_item_id,old.inventory_unit_id,
        old.reserved_at,old.expires_at)
       or old.status <> 'active' or new.status <> 'expired'
       or old.expires_at > statement_timestamp() then
      raise exception 'Only due reservations may be expired';
    end if;
    new.state_changed_at := statement_timestamp();
    return new;
  end if;
  if new.status <> 'active' or new.state_changed_at is not null
     or new.expires_at <= statement_timestamp() then
    raise exception 'Invalid new reservation';
  end if;
  select * into item from public.order_items where id = new.order_item_id;
  if not found or item.order_id <> new.order_id or item.variant_id is null then
    raise exception 'Reservation must belong to its order item';
  end if;
  select * into unit from public.inventory_units where id = new.inventory_unit_id for update;
  if not found or unit.variant_id <> item.variant_id
     or unit.product_id <> item.product_id
     or unit.sold_at is not null or unit.withdrawn_at is not null then
    raise exception 'Physical piece is not eligible for this item';
  end if;
  return new;
end $$;
revoke all on function private.guard_checkout_reservation() from public, anon, authenticated;
create trigger guard_checkout_reservation
  before insert or update or delete on public.checkout_reservations
  for each row execute function private.guard_checkout_reservation();

create function public.create_checkout_order(
  cart_lines jsonb,
  shipping_address_id uuid,
  idempotency_key uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  request jsonb;
  raw_line jsonb;
  line record;
  product public.products;
  variant public.product_variants;
  address public.addresses;
  customer_email text;
  colour_name text;
  image_path text;
  existing_order public.orders;
  created_order public.orders;
  created_item uuid;
  unit record;
  wanted integer;
  reserved integer;
  subtotal bigint := 0;
  shipping bigint := 0;
  discount bigint := 0;
  tax bigint := 0;
  total bigint := 0;
  total_quantity integer := 0;
  expiry timestamptz := statement_timestamp() + private.checkout_reservation_ttl();
begin
  if actor is null then
    raise exception 'Sign in to continue' using errcode = '42501';
  end if;
  if idempotency_key is null or shipping_address_id is null
     or jsonb_typeof(cart_lines) is distinct from 'array' then
    raise exception 'Review your cart and delivery address' using errcode = '22023';
  end if;
  if jsonb_array_length(cart_lines) not between 1 and 20 then
    raise exception 'Review your cart and delivery address' using errcode = '22023';
  end if;
  foreach raw_line in array (select array_agg(value) from jsonb_array_elements(cart_lines)) loop
    if jsonb_typeof(raw_line) <> 'object'
       or (select count(*) from jsonb_object_keys(raw_line)) <> 2
       or not (raw_line ? 'variant_id' and raw_line ? 'quantity')
       or coalesce(raw_line->>'variant_id','') !~
         '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
       or coalesce(raw_line->>'quantity','') !~ '^[1-9][0-9]*$'
       or length(raw_line->>'quantity') > 2
       or (raw_line->>'quantity')::integer > 10 then
      raise exception 'Review your cart items' using errcode = '22023';
    end if;
    total_quantity := total_quantity + (raw_line->>'quantity')::integer;
  end loop;
  if total_quantity > 30 or
     (select count(distinct (value->>'variant_id')::uuid)
      from jsonb_array_elements(cart_lines)) <> jsonb_array_length(cart_lines) then
    raise exception 'Review your cart items' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'address_id',shipping_address_id,
    'lines',jsonb_agg(
      jsonb_build_object('variant_id',(value->>'variant_id')::uuid,
                         'quantity',(value->>'quantity')::integer)
      order by (value->>'variant_id')::uuid))
  into request from jsonb_array_elements(cart_lines);

  -- Concurrent retries for the same owner/key serialize before checking the
  -- unique index. Hash collisions only delay an unrelated checkout.
  perform pg_advisory_xact_lock(
    hashtextextended(actor::text || ':' || idempotency_key::text,0));
  select * into existing_order from public.orders
    where user_id = actor and checkout_key = idempotency_key for update;
  if found then
    if existing_order.checkout_request is distinct from request then
      raise exception 'Checkout key was reused for a different cart or address'
        using errcode = '22023';
    end if;
    return jsonb_build_object(
      'id',existing_order.id,'order_reference',existing_order.order_reference,
      'status',existing_order.status,'payment_status',existing_order.payment_status,
      'fulfillment_status',existing_order.fulfillment_status,
      'subtotal_paise',existing_order.subtotal_paise,
      'shipping_paise',existing_order.shipping_paise,
      'discount_paise',existing_order.discount_paise,
      'tax_paise',existing_order.tax_paise,
      'total_paise',existing_order.total_paise,
      'reservation_expires_at',
        (select min(r.expires_at) from public.checkout_reservations r
         where r.order_id = existing_order.id),
      'reservation_active',
        exists(select 1 from public.checkout_reservations r
               where r.order_id = existing_order.id and r.status = 'active'
                 and r.expires_at > statement_timestamp()));
  end if;

  if not exists(select 1 from public.profiles where id = actor) then
    raise exception 'Complete your customer profile' using errcode = '22023';
  end if;
  select email into customer_email from auth.users where id = actor;
  if nullif(btrim(customer_email),'') is null then
    raise exception 'An authenticated email is required' using errcode = '22023';
  end if;
  select * into address from public.addresses
    where id = shipping_address_id and user_id = actor for share;
  if not found or nullif(btrim(address.full_name),'') is null
     or nullif(btrim(address.address_line1),'') is null
     or nullif(btrim(address.phone),'') is null
     or address.pin_code !~ '^[1-9][0-9]{5}$' or address.country <> 'IN' then
    raise exception 'Choose a valid address from your account' using errcode = '22023';
  end if;

  -- All prices and snapshots are selected from the current catalog. The
  -- browser has no price, total, user ID or physical piece ID parameter.
  for line in
    select (value->>'variant_id')::uuid as variant_id,
           (value->>'quantity')::integer as quantity
    from jsonb_array_elements(cart_lines)
    order by (value->>'variant_id')::uuid
  loop
    select v.* into variant from public.product_variants v
      where v.id = line.variant_id for share;
    if not found then
      raise exception 'One of your items changed. Review your cart' using errcode = '22023';
    end if;
    select p.* into product from public.products p
      where p.id = variant.product_id for share;
    if not found or product.status <> 'active'
       or not product.is_visible or not product.is_shop_available
       or product.archived_at is not null or product.sold_out_at is not null
       or not variant.enabled or variant.price_paise <= 0
       or nullif(btrim(variant.sku),'') is null
       or nullif(btrim(variant.size),'') is null then
      raise exception 'This item is no longer available' using errcode = '22023';
    end if;
    subtotal := subtotal + line.quantity::bigint * variant.price_paise;
  end loop;

  -- Current commercial policy:
  -- - shipping is centrally calculated server-side (currently free)
  -- - no authoritative coupon discount yet
  -- - storefront prices are treated as tax-inclusive, so no additional tax
  shipping := private.checkout_shipping_paise(subtotal);
  discount := 0;
  tax := 0;
  total := subtotal - discount + shipping + tax;

  created_order.id := gen_random_uuid();
  insert into public.orders
    (id,order_reference,user_id,status,payment_status,fulfillment_status,
     subtotal_paise,shipping_paise,discount_paise,tax_paise,total_paise,
     checkout_key,checkout_request)
  values
    (created_order.id,'PCT-' || upper(replace(created_order.id::text,'-','')),
     actor,'pending','unpaid','unfulfilled',
     subtotal,shipping,discount,tax,total,idempotency_key,request)
  returning * into created_order;

  insert into public.order_addresses
    (order_id,kind,full_name,email,phone,address_line1,address_line2,
     city,state,pin_code,country)
  values
    (created_order.id,'shipping',address.full_name,customer_email,
     address.phone,address.address_line1,address.address_line2,
     address.city,address.state,address.pin_code,address.country);

  for line in
    select (value->>'variant_id')::uuid as variant_id,
           (value->>'quantity')::integer as quantity
    from jsonb_array_elements(cart_lines)
    order by (value->>'variant_id')::uuid
  loop
    select * into variant from public.product_variants where id = line.variant_id;
    select * into product from public.products where id = variant.product_id;
    select label into colour_name from public.colours where id = variant.colour_id;
    select url into image_path from public.product_images
      where product_id = product.id and role = 'primary'
      order by sort_order,id limit 1;
    insert into public.order_items
      (order_id,product_id,variant_id,product_name,product_slug,sku,
       size,colour,image_url,quantity,unit_price_paise)
    values
      (created_order.id,product.id,variant.id,product.name,product.slug,
       variant.sku,variant.size,colour_name,image_path,
       line.quantity,variant.price_paise)
    returning id into created_item;

    wanted := line.quantity;
    reserved := 0;
    for unit in
      select u.id from public.inventory_units u
      where u.product_id = product.id and u.variant_id = variant.id
        and u.sold_at is null and u.withdrawn_at is null
        and not exists(
          select 1 from public.checkout_reservations r
          where r.inventory_unit_id = u.id and r.status = 'active'
            and r.expires_at > statement_timestamp())
      order by u.piece_number,u.id
      for update of u skip locked
      limit wanted
    loop
      -- Expiry is non-blocking even when no cron cleanup has run. Reclaim
      -- stale rows while holding the exact physical unit's row lock.
      update public.checkout_reservations
        set status = 'expired',state_changed_at = statement_timestamp()
        where inventory_unit_id = unit.id and status = 'active'
          and expires_at <= statement_timestamp();
      insert into public.checkout_reservations
        (order_id,order_item_id,inventory_unit_id,expires_at)
      values (created_order.id,created_item,unit.id,expiry);
      reserved := reserved + 1;
    end loop;
    if reserved <> wanted then
      raise exception 'Only % pieces remain for this size',reserved
        using errcode = 'PT409';
    end if;
  end loop;

  return jsonb_build_object(
    'id',created_order.id,'order_reference',created_order.order_reference,
    'status',created_order.status,'payment_status',created_order.payment_status,
    'fulfillment_status',created_order.fulfillment_status,
    'subtotal_paise',created_order.subtotal_paise,
    'shipping_paise',created_order.shipping_paise,
    'discount_paise',created_order.discount_paise,
    'tax_paise',created_order.tax_paise,
    'total_paise',created_order.total_paise,
    'reservation_expires_at',expiry,'reservation_active',true);
end $$;
revoke all on function public.create_checkout_order(jsonb,uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.create_checkout_order(jsonb,uuid,uuid)
  to authenticated;

commit;