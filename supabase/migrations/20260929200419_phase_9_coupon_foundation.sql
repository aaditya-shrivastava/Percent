begin;

-- Phase 9 coupons: extend the existing minimal coupon row, add immutable
-- redemption history, and expose only narrow customer/admin RPCs.
alter table public.coupons
  add column description text not null default '',
  add column maximum_discount_paise bigint,
  add column total_usage_limit integer,
  add column per_customer_usage_limit integer;

alter table public.coupons
  alter column amount_paise type bigint,
  alter column minimum_subtotal_paise type bigint;

alter table public.coupons
  drop constraint coupons_code_check,
  drop constraint coupons_check,
  add constraint coupons_code_check check (
    code = upper(btrim(code))
    and code ~ '^[A-Z0-9][A-Z0-9_-]{0,39}$'
  ),
  add constraint coupons_configuration_check check (
    (kind = 'fixed' and amount_paise is not null and amount_paise > 0
      and percent_bps is null and maximum_discount_paise is null)
    or
    (kind = 'percentage' and percent_bps is not null
      and percent_bps between 1 and 10000
      and amount_paise is null)
  ),
  add constraint coupons_description_check check (length(description) <= 240),
  add constraint coupons_maximum_discount_check check (
    maximum_discount_paise is null or maximum_discount_paise > 0
  ),
  add constraint coupons_total_usage_limit_check check (
    total_usage_limit is null or total_usage_limit > 0
  ),
  add constraint coupons_customer_usage_limit_check check (
    per_customer_usage_limit is null or per_customer_usage_limit > 0
  );

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete restrict,
  user_id uuid not null references private.percent_principals(id) on delete restrict,
  order_id uuid not null unique references public.orders(id) on delete restrict,
  coupon_code_snapshot text not null,
  discount_paise bigint not null check (discount_paise > 0),
  created_at timestamptz not null default now()
);

create index coupon_redemptions_coupon_user_idx
  on public.coupon_redemptions(coupon_id, user_id);
create index coupon_redemptions_coupon_created_idx
  on public.coupon_redemptions(coupon_id, created_at);

alter table public.coupon_redemptions enable row level security;
revoke all on public.coupon_redemptions from public, anon, authenticated;
grant all on public.coupon_redemptions to service_role;

create trigger immutable_coupon_redemptions
  before update or delete on public.coupon_redemptions
  for each row execute function private.immutable_snapshot();

-- Coupon management is RPC-only. The pre-existing table policy and browser DML
-- grants are removed so callers cannot bypass normalization or validation.
drop policy if exists admin_manage on public.coupons;
revoke all on public.coupons from anon, authenticated;
grant all on public.coupons to service_role;

create function private.normalize_coupon_code(raw_code text)
returns text
language sql immutable
set search_path = ''
as $$
  select nullif(upper(btrim(raw_code)), '')
$$;
revoke all on function private.normalize_coupon_code(text)
  from public, anon, authenticated;

create function private.validate_checkout_lines(cart_lines jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  raw_line jsonb;
  total_quantity integer := 0;
begin
  if jsonb_typeof(cart_lines) is distinct from 'array'
     or jsonb_array_length(cart_lines) not between 1 and 20 then
    raise exception 'Review your cart items' using errcode = '22023';
  end if;

  foreach raw_line in array
    (select array_agg(value) from jsonb_array_elements(cart_lines))
  loop
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
end $$;
revoke all on function private.validate_checkout_lines(jsonb)
  from public, anon, authenticated;

create function private.checkout_cart_subtotal(cart_lines jsonb)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  line record;
  product public.products;
  variant public.product_variants;
  subtotal bigint := 0;
begin
  perform private.validate_checkout_lines(cart_lines);

  for line in
    select (value->>'variant_id')::uuid as variant_id,
           (value->>'quantity')::integer as quantity
      from jsonb_array_elements(cart_lines)
      order by (value->>'variant_id')::uuid
  loop
    select v.* into variant
      from public.product_variants v
      where v.id = line.variant_id
      for share;
    if not found then
      raise exception 'One of your items changed. Review your cart'
        using errcode = '22023';
    end if;

    select p.* into product
      from public.products p
      where p.id = variant.product_id
      for share;
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

  return subtotal;
end $$;
revoke all on function private.checkout_cart_subtotal(jsonb)
  from public, anon, authenticated;

create function private.evaluate_coupon(
  raw_code text,
  actor uuid,
  subtotal_paise bigint,
  lock_coupon boolean default false
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  normalized text := private.normalize_coupon_code(raw_code);
  coupon public.coupons;
  total_uses bigint;
  customer_uses bigint;
  calculated_discount bigint;
begin
  if normalized is null or normalized !~ '^[A-Z0-9][A-Z0-9_-]{0,39}$' then
    return jsonb_build_object('valid',false,'code',normalized,
      'reason','invalid','message','Invalid coupon');
  end if;

  if lock_coupon then
    select c.* into coupon from public.coupons c
      where c.code = normalized for update;
  else
    select c.* into coupon from public.coupons c
      where c.code = normalized;
  end if;

  if not found then
    return jsonb_build_object('valid',false,'code',normalized,
      'reason','invalid','message','Invalid coupon');
  end if;
  if not coupon.active then
    return jsonb_build_object('valid',false,'code',normalized,
      'reason','disabled','message','Coupon is disabled');
  end if;
  if coupon.starts_at is not null and statement_timestamp() < coupon.starts_at then
    return jsonb_build_object('valid',false,'code',normalized,
      'reason','not_started','message','Coupon is not active yet');
  end if;
  if coupon.ends_at is not null and statement_timestamp() >= coupon.ends_at then
    return jsonb_build_object('valid',false,'code',normalized,
      'reason','expired','message','Coupon expired');
  end if;
  if subtotal_paise < coupon.minimum_subtotal_paise then
    return jsonb_build_object('valid',false,'code',normalized,
      'reason','minimum_not_met','message',
      format('Minimum order of ₹%s required',
        trim(to_char(coupon.minimum_subtotal_paise / 100.0,'FM999999999990.00'))),
      'minimum_order_paise',coupon.minimum_subtotal_paise);
  end if;

  select count(*) into total_uses
    from public.coupon_redemptions r where r.coupon_id = coupon.id;
  if coupon.total_usage_limit is not null
     and total_uses >= coupon.total_usage_limit then
    return jsonb_build_object('valid',false,'code',normalized,
      'reason','usage_exhausted','message','Coupon usage limit reached');
  end if;

  select count(*) into customer_uses
    from public.coupon_redemptions r
    where r.coupon_id = coupon.id and r.user_id = actor;
  if coupon.per_customer_usage_limit is not null
     and customer_uses >= coupon.per_customer_usage_limit then
    return jsonb_build_object('valid',false,'code',normalized,
      'reason','customer_limit','message',
      'You have already used this coupon the maximum number of times');
  end if;

  if coupon.kind = 'fixed' then
    calculated_discount := least(coupon.amount_paise, subtotal_paise);
  else
    calculated_discount := (subtotal_paise * coupon.percent_bps::bigint) / 10000;
    if coupon.maximum_discount_paise is not null then
      calculated_discount := least(calculated_discount,
        coupon.maximum_discount_paise);
    end if;
    calculated_discount := least(calculated_discount, subtotal_paise);
  end if;

  if calculated_discount <= 0 then
    return jsonb_build_object('valid',false,'code',normalized,
      'reason','invalid','message','Coupon cannot be applied to this order');
  end if;

  return jsonb_build_object(
    'valid',true,
    'coupon_id',coupon.id,
    'code',coupon.code,
    'discount_type',coupon.kind,
    'discount_paise',calculated_discount,
    'message','Coupon applied'
  );
end $$;
revoke all on function private.evaluate_coupon(text,uuid,bigint,boolean)
  from public, anon, authenticated;

create function public.validate_coupon(code text, cart_lines jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.current_user_id();
  subtotal bigint;
  result jsonb;
begin
  if actor is null then
    raise exception 'Sign in to continue' using errcode = '42501';
  end if;
  subtotal := private.checkout_cart_subtotal(cart_lines);
  result := private.evaluate_coupon(code, actor, subtotal, false);
  return (result - 'coupon_id') || jsonb_build_object('subtotal_paise',subtotal);
end $$;
revoke all on function public.validate_coupon(text,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.validate_coupon(text,jsonb) to authenticated;

create function public.admin_list_coupons(
  search_query text default null,
  status_filter text default 'all',
  page_number integer default 1,
  page_size integer default 20
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.current_user_id();
  normalized_search text := nullif(btrim(search_query),'');
  safe_status text := lower(coalesce(nullif(btrim(status_filter),''),'all'));
  safe_page integer := greatest(coalesce(page_number,1),1);
  safe_size integer := least(greatest(coalesce(page_size,20),1),100);
  result jsonb;
begin
  if actor is null or not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if safe_status not in ('all','active','scheduled','expired','disabled','exhausted') then
    raise exception 'Invalid coupon status filter' using errcode = '22023';
  end if;

  with usage as (
    select r.coupon_id,count(*)::bigint as redemption_count
      from public.coupon_redemptions r group by r.coupon_id
  ), rows as (
    select c.*,coalesce(u.redemption_count,0) as redemption_count,
      case
        when not c.active then 'disabled'
        when c.starts_at is not null and statement_timestamp() < c.starts_at then 'scheduled'
        when c.ends_at is not null and statement_timestamp() >= c.ends_at then 'expired'
        when c.total_usage_limit is not null
             and coalesce(u.redemption_count,0) >= c.total_usage_limit then 'exhausted'
        else 'active'
      end as effective_status
    from public.coupons c left join usage u on u.coupon_id = c.id
  ), filtered as (
    select * from rows
    where (normalized_search is null
      or code ilike '%' || normalized_search || '%'
      or description ilike '%' || normalized_search || '%')
      and (safe_status = 'all' or effective_status = safe_status)
  ), paged as (
    select * from filtered order by updated_at desc,id
    limit safe_size offset (safe_page - 1) * safe_size
  )
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(to_jsonb(p) order by p.updated_at desc,p.id)
      from paged p),'[]'::jsonb),
    'total',(select count(*) from filtered),
    'page',safe_page,
    'page_size',safe_size
  ) into result;
  return result;
end $$;
revoke all on function public.admin_list_coupons(text,text,integer,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_list_coupons(text,text,integer,integer)
  to authenticated;

create function public.admin_get_coupon(coupon_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.current_user_id();
  result jsonb;
begin
  if actor is null or not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  select to_jsonb(c) || jsonb_build_object(
    'redemption_count',(select count(*) from public.coupon_redemptions r
      where r.coupon_id = c.id)
  ) into result from public.coupons c where c.id = coupon_id;
  if result is null then
    raise exception 'Coupon not found' using errcode = 'P0002';
  end if;
  return result;
end $$;
revoke all on function public.admin_get_coupon(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_get_coupon(uuid) to authenticated;

create function public.save_coupon(
  coupon_id uuid,
  code text,
  description text,
  discount_type text,
  fixed_amount_paise bigint,
  percentage_bps integer,
  minimum_order_paise bigint,
  maximum_discount_paise bigint,
  valid_from timestamptz,
  valid_until timestamptz,
  total_usage_limit integer,
  per_customer_usage_limit integer,
  enabled boolean,
  expected_updated_at timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.current_user_id();
  normalized_code text := private.normalize_coupon_code(code);
  normalized_kind text := lower(btrim(discount_type));
  saved public.coupons;
  total_uses bigint;
  maximum_customer_uses bigint;
begin
  if actor is null or not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if normalized_code is null
     or normalized_code !~ '^[A-Z0-9][A-Z0-9_-]{0,39}$' then
    raise exception 'Use 1–40 letters, numbers, underscores or hyphens for the code'
      using errcode = '22023';
  end if;
  if coalesce(length(description),0) > 240 then
    raise exception 'Description must be 240 characters or fewer'
      using errcode = '22023';
  end if;
  if normalized_kind is null or normalized_kind not in ('fixed','percentage')
     or coalesce(minimum_order_paise,0) < 0
     or (valid_from is not null and valid_until is not null
         and valid_until <= valid_from)
     or (total_usage_limit is not null and total_usage_limit <= 0)
     or (per_customer_usage_limit is not null and per_customer_usage_limit <= 0)
     or (normalized_kind = 'fixed' and
         (coalesce(fixed_amount_paise,0) <= 0 or percentage_bps is not null
          or maximum_discount_paise is not null))
     or (normalized_kind = 'percentage' and
         (coalesce(percentage_bps,0) not between 1 and 10000
          or fixed_amount_paise is not null
          or (maximum_discount_paise is not null and maximum_discount_paise <= 0))) then
    raise exception 'Review the coupon configuration' using errcode = '22023';
  end if;

  if coupon_id is null then
    if expected_updated_at is not null then
      raise exception 'New coupons cannot include an edit token' using errcode = '22023';
    end if;
    begin
      insert into public.coupons
        (code,description,kind,amount_paise,percent_bps,
         minimum_subtotal_paise,maximum_discount_paise,starts_at,ends_at,
         total_usage_limit,per_customer_usage_limit,active)
      values
        (normalized_code,coalesce(description,''),normalized_kind,
         case when normalized_kind='fixed' then fixed_amount_paise end,
         case when normalized_kind='percentage' then percentage_bps end,
         coalesce(minimum_order_paise,0),
         case when normalized_kind='percentage' then maximum_discount_paise end,
         valid_from,valid_until,total_usage_limit,per_customer_usage_limit,
         coalesce(enabled,false))
      returning * into saved;
    exception when unique_violation then
      raise exception 'Coupon code already exists' using errcode = '23505';
    end;
  else
    if expected_updated_at is null then
      raise exception 'Refresh this coupon before saving' using errcode = 'PT409';
    end if;
    select count(*) into total_uses from public.coupon_redemptions r
      where r.coupon_id = save_coupon.coupon_id;
    select coalesce(max(customer_count),0) into maximum_customer_uses from (
      select count(*) as customer_count from public.coupon_redemptions r
      where r.coupon_id = save_coupon.coupon_id group by r.user_id
    ) counted;
    if total_usage_limit is not null and total_usage_limit < total_uses then
      raise exception 'Total usage limit cannot be below existing redemptions'
        using errcode = '22023';
    end if;
    if per_customer_usage_limit is not null
       and per_customer_usage_limit < maximum_customer_uses then
      raise exception 'Customer usage limit cannot be below existing redemptions'
        using errcode = '22023';
    end if;
    begin
      update public.coupons c set
        code = normalized_code,
        description = coalesce(save_coupon.description,''),
        kind = normalized_kind,
        amount_paise = case when normalized_kind='fixed' then fixed_amount_paise end,
        percent_bps = case when normalized_kind='percentage' then percentage_bps end,
        minimum_subtotal_paise = coalesce(minimum_order_paise,0),
        maximum_discount_paise = case when normalized_kind='percentage'
          then save_coupon.maximum_discount_paise end,
        starts_at = valid_from,
        ends_at = valid_until,
        total_usage_limit = save_coupon.total_usage_limit,
        per_customer_usage_limit = save_coupon.per_customer_usage_limit,
        active = coalesce(enabled,false)
      where c.id = save_coupon.coupon_id
        and c.updated_at = expected_updated_at
      returning c.* into saved;
    exception when unique_violation then
      raise exception 'Coupon code already exists' using errcode = '23505';
    end;
    if saved.id is null then
      if exists(select 1 from public.coupons c where c.id=save_coupon.coupon_id) then
        raise exception 'Coupon changed. Refresh and try again' using errcode = 'PT409';
      end if;
      raise exception 'Coupon not found' using errcode = 'P0002';
    end if;
  end if;
  return to_jsonb(saved);
end $$;
revoke all on function public.save_coupon(uuid,text,text,text,bigint,integer,bigint,bigint,timestamptz,timestamptz,integer,integer,boolean,timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.save_coupon(uuid,text,text,text,bigint,integer,bigint,bigint,timestamptz,timestamptz,integer,integer,boolean,timestamptz)
  to authenticated;

create function public.create_checkout_order(
  cart_lines jsonb,
  shipping_address_id uuid,
  idempotency_key uuid,
  coupon_code text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.current_user_id();
  normalized_coupon text := private.normalize_coupon_code(coupon_code);
  request jsonb;
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
  expiry timestamptz := statement_timestamp() + private.checkout_reservation_ttl();
  coupon_result jsonb;
  applied_coupon_id uuid;
begin
  if actor is null then
    raise exception 'Sign in to continue' using errcode = '42501';
  end if;
  if idempotency_key is null or shipping_address_id is null then
    raise exception 'Review your cart and delivery address' using errcode = '22023';
  end if;
  if coupon_code is not null and normalized_coupon is null then
    raise exception 'Invalid coupon' using errcode = '22023';
  end if;

  perform private.validate_checkout_lines(cart_lines);
  select jsonb_strip_nulls(jsonb_build_object(
    'address_id',shipping_address_id,
    'coupon_code',normalized_coupon,
    'lines',jsonb_agg(jsonb_build_object(
      'variant_id',(value->>'variant_id')::uuid,
      'quantity',(value->>'quantity')::integer)
      order by (value->>'variant_id')::uuid)
  )) into request from jsonb_array_elements(cart_lines);

  perform pg_advisory_xact_lock(
    hashtextextended(actor::text || ':' || idempotency_key::text,0));
  select * into existing_order from public.orders
    where user_id = actor and checkout_key = idempotency_key for update;
  if found then
    if existing_order.checkout_request is distinct from request then
      raise exception 'Checkout key was reused for a different cart, address or coupon'
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
      'coupon_code_snapshot',existing_order.coupon_code_snapshot,
      'reservation_expires_at',
        (select min(r.expires_at) from public.checkout_reservations r
         where r.order_id = existing_order.id),
      'reservation_active',
        exists(select 1 from public.checkout_reservations r
               where r.order_id = existing_order.id and r.status = 'active'
                 and r.expires_at > statement_timestamp()));
  end if;

  subtotal := private.checkout_cart_subtotal(cart_lines);
  if not exists(select 1 from public.profiles where id = actor) then
    raise exception 'Complete your customer profile' using errcode = '22023';
  end if;
  select email into customer_email from private.percent_principals where id = actor;
  if nullif(btrim(customer_email),'') is null then
    raise exception 'Add a verified contact email before checkout' using errcode = '22023';
  end if;
  select * into address from public.addresses
    where id = shipping_address_id and user_id = actor for share;
  if not found or nullif(btrim(address.full_name),'') is null
     or nullif(btrim(address.address_line1),'') is null
     or nullif(btrim(address.phone),'') is null
     or address.pin_code !~ '^[1-9][0-9]{5}$' or address.country <> 'IN' then
    raise exception 'Choose a valid address from your account' using errcode = '22023';
  end if;

  shipping := private.checkout_shipping_paise(subtotal);
  if normalized_coupon is not null then
    coupon_result := private.evaluate_coupon(normalized_coupon,actor,subtotal,true);
    if not coalesce((coupon_result->>'valid')::boolean,false) then
      raise exception '%',coupon_result->>'message' using errcode = '22023';
    end if;
    applied_coupon_id := (coupon_result->>'coupon_id')::uuid;
    discount := (coupon_result->>'discount_paise')::bigint;
  end if;
  tax := 0;
  total := greatest(0,subtotal - discount + shipping + tax);

  created_order.id := gen_random_uuid();
  insert into public.orders
    (id,order_reference,user_id,status,payment_status,fulfillment_status,
     subtotal_paise,shipping_paise,discount_paise,tax_paise,total_paise,
     coupon_code_snapshot,checkout_key,checkout_request)
  values
    (created_order.id,'PCT-' || upper(replace(created_order.id::text,'-','')),
     actor,'pending','unpaid','unfulfilled',subtotal,shipping,discount,tax,total,
     normalized_coupon,idempotency_key,request)
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

  if applied_coupon_id is not null then
    insert into public.coupon_redemptions
      (coupon_id,user_id,order_id,coupon_code_snapshot,discount_paise)
    values
      (applied_coupon_id,actor,created_order.id,normalized_coupon,discount);
  end if;

  return jsonb_build_object(
    'id',created_order.id,'order_reference',created_order.order_reference,
    'status',created_order.status,'payment_status',created_order.payment_status,
    'fulfillment_status',created_order.fulfillment_status,
    'subtotal_paise',created_order.subtotal_paise,
    'shipping_paise',created_order.shipping_paise,
    'discount_paise',created_order.discount_paise,
    'tax_paise',created_order.tax_paise,
    'total_paise',created_order.total_paise,
    'coupon_code_snapshot',created_order.coupon_code_snapshot,
    'reservation_expires_at',expiry,'reservation_active',true);
end $$;
revoke all on function public.create_checkout_order(jsonb,uuid,uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.create_checkout_order(jsonb,uuid,uuid,text)
  to authenticated;

-- Keep the existing three-argument API operational during the gated frontend
-- rollout. It delegates to the authoritative four-argument implementation.
create or replace function public.create_checkout_order(
  cart_lines jsonb,
  shipping_address_id uuid,
  idempotency_key uuid
) returns jsonb
language sql security definer set search_path = '' as $$
  select public.create_checkout_order(
    cart_lines,shipping_address_id,idempotency_key,null::text)
$$;
revoke all on function public.create_checkout_order(jsonb,uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.create_checkout_order(jsonb,uuid,uuid)
  to authenticated;

commit;
