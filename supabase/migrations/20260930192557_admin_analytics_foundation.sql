-- Percent Admin Analytics foundation.
-- Aggregates authoritative commerce data in PostgreSQL and exposes no PII.
begin;

create index if not exists orders_analytics_created_status_payment_idx
  on public.orders(created_at, status, payment_status)
  include (total_paise, user_id);

create index if not exists profiles_created_at_idx
  on public.profiles(created_at, id);

create or replace function public.admin_get_analytics(
  start_at timestamptz default null,
  end_at timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.current_user_id();
  range_start timestamptz;
  range_end timestamptz;
  previous_start timestamptz;
  bucket_kind text;
  bucket_step interval;
  result jsonb;
begin
  if actor is null or not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if (start_at is null) <> (end_at is null) then
    raise exception 'Provide both range boundaries or neither' using errcode = '22023';
  end if;
  if start_at is not null and (end_at <= start_at or end_at > statement_timestamp() + interval '1 day') then
    raise exception 'Invalid analytics range' using errcode = '22023';
  end if;

  range_end := coalesce(end_at, statement_timestamp());
  if start_at is null then
    select min(value) into range_start
    from (values
      ((select min(o.created_at) from public.orders o)),
      ((select min(p.created_at) from public.profiles p)),
      ((select min(i.sold_at) from public.inventory_units i where i.sold_at is not null)),
      ((select min(i.withdrawn_at) from public.inventory_units i where i.withdrawn_at is not null)),
      ((select min(c.created_at) from public.coupon_redemptions c))
    ) earliest(value);
    range_start := coalesce(date_trunc('day', range_start at time zone 'UTC') at time zone 'UTC',
                            date_trunc('day', range_end at time zone 'UTC') at time zone 'UTC');
    previous_start := null;
  else
    range_start := start_at;
    previous_start := start_at - (end_at - start_at);
  end if;

  if range_end - range_start <= interval '90 days' then
    bucket_kind := 'day'; bucket_step := interval '1 day';
  elsif range_end - range_start <= interval '730 days' then
    bucket_kind := 'week'; bucket_step := interval '1 week';
  else
    bucket_kind := 'month'; bucket_step := interval '1 month';
  end if;

  with
  eligible_customers as materialized (
    select p.id, p.created_at
    from public.profiles p
    left join private.user_roles r on r.user_id = p.id
    where r.role = 'customer'
       or exists (select 1 from public.orders o where o.user_id = p.id)
       or exists (select 1 from public.addresses a where a.user_id = p.id)
       or exists (select 1 from public.product_reviews pr where pr.user_id = p.id)
       or exists (select 1 from public.wishlist_items w where w.user_id = p.id)
  ),
  period_orders as materialized (
    select o.* from public.orders o
    where o.created_at >= range_start and o.created_at < range_end
  ),
  confirmed_orders as materialized (
    select o.* from period_orders o
    where o.payment_status = 'paid' and o.status = 'completed'
  ),
  previous_confirmed as materialized (
    select o.* from public.orders o
    where previous_start is not null
      and o.created_at >= previous_start and o.created_at < range_start
      and o.payment_status = 'paid' and o.status = 'completed'
  ),
  confirmed_items as materialized (
    select i.* from public.order_items i join confirmed_orders o on o.id = i.order_id
  ),
  inventory as materialized (
    select p.id, p.name, p.slug, p.status, p.production_limit, p.sold_out_at,
      count(u.id)::integer as allocated,
      count(u.id) filter (where u.sold_at is not null)::integer as sold,
      count(u.id) filter (where u.withdrawn_at is not null)::integer as withdrawn,
      count(u.id) filter (where u.sold_at is null and u.withdrawn_at is null and v.enabled)::integer as available
    from public.products p
    left join public.inventory_units u on u.product_id = p.id
    left join public.product_variants v on v.id = u.variant_id
    group by p.id
  ),
  product_sales as materialized (
    select i.product_id, max(i.product_name) as product_name,
      sum(i.quantity)::bigint as units_sold,
      sum(i.line_total_paise)::bigint as confirmed_sales_paise
    from confirmed_items i group by i.product_id
  ),
  customer_confirmed as materialized (
    select o.user_id, count(*)::integer as confirmed_order_count
    from public.orders o
    where o.user_id is not null and o.payment_status = 'paid' and o.status = 'completed'
    group by o.user_id
  ),
  bucket_bounds as (
    select
      case bucket_kind
        when 'day' then date_trunc('day', range_start at time zone 'UTC') at time zone 'UTC'
        when 'week' then date_trunc('week', range_start at time zone 'UTC') at time zone 'UTC'
        else date_trunc('month', range_start at time zone 'UTC') at time zone 'UTC'
      end as first_bucket,
      case bucket_kind
        when 'day' then date_trunc('day', (range_end - interval '1 microsecond') at time zone 'UTC') at time zone 'UTC'
        when 'week' then date_trunc('week', (range_end - interval '1 microsecond') at time zone 'UTC') at time zone 'UTC'
        else date_trunc('month', (range_end - interval '1 microsecond') at time zone 'UTC') at time zone 'UTC'
      end as last_bucket
  ),
  buckets as materialized (
    select generate_series(b.first_bucket, b.last_bucket, bucket_step) as bucket_start
    from bucket_bounds b
  ),
  sales_buckets as (
    select case bucket_kind
      when 'day' then date_trunc('day', o.created_at at time zone 'UTC') at time zone 'UTC'
      when 'week' then date_trunc('week', o.created_at at time zone 'UTC') at time zone 'UTC'
      else date_trunc('month', o.created_at at time zone 'UTC') at time zone 'UTC'
    end as bucket_start, count(*)::integer as orders, sum(o.total_paise)::bigint as sales_paise
    from confirmed_orders o group by 1
  ),
  customer_buckets as (
    select case bucket_kind
      when 'day' then date_trunc('day', c.created_at at time zone 'UTC') at time zone 'UTC'
      when 'week' then date_trunc('week', c.created_at at time zone 'UTC') at time zone 'UTC'
      else date_trunc('month', c.created_at at time zone 'UTC') at time zone 'UTC'
    end as bucket_start, count(*)::integer as customers
    from eligible_customers c
    where c.created_at >= range_start and c.created_at < range_end
    group by 1
  )
  select jsonb_build_object(
    'range', jsonb_build_object('start_at', range_start, 'end_at', range_end,
      'all_time', start_at is null, 'bucket', bucket_kind),
    'summary', jsonb_build_object(
      'confirmed_sales_paise', coalesce((select sum(total_paise) from confirmed_orders), 0),
      'confirmed_orders', (select count(*) from confirmed_orders),
      'units_sold', coalesce((select sum(quantity) from confirmed_items), 0),
      'total_customers', (select count(*) from eligible_customers),
      'new_customers', (select count(*) from eligible_customers where created_at >= range_start and created_at < range_end),
      'previous', case when previous_start is null then null else jsonb_build_object(
        'confirmed_sales_paise', coalesce((select sum(total_paise) from previous_confirmed), 0),
        'confirmed_orders', (select count(*) from previous_confirmed),
        'units_sold', coalesce((select sum(i.quantity) from public.order_items i join previous_confirmed o on o.id=i.order_id), 0),
        'new_customers', (select count(*) from eligible_customers where created_at >= previous_start and created_at < range_start)
      ) end
    ),
    'trend', coalesce((select jsonb_agg(jsonb_build_object(
      'start_at', b.bucket_start,
      'confirmed_sales_paise', coalesce(s.sales_paise, 0),
      'confirmed_orders', coalesce(s.orders, 0),
      'new_customers', coalesce(c.customers, 0)
    ) order by b.bucket_start) from buckets b
      left join sales_buckets s using(bucket_start)
      left join customer_buckets c using(bucket_start)), '[]'::jsonb),
    'order_statuses', coalesce((select jsonb_agg(jsonb_build_object(
      'status', status, 'count', amount) order by status)
      from (select status, count(*)::integer amount from period_orders group by status) x), '[]'::jsonb),
    'top_products', coalesce((select jsonb_agg(to_jsonb(x) order by x.units_sold desc, x.product_name, x.product_id)
      from (select s.product_id, s.product_name, s.units_sold, s.confirmed_sales_paise,
        i.slug, i.production_limit, i.sold, i.withdrawn, i.available
        from product_sales s left join inventory i on i.id=s.product_id
        order by s.units_sold desc, s.product_name, s.product_id limit 5) x), '[]'::jsonb),
    'production', coalesce((select jsonb_agg(jsonb_build_object(
      'product_id', i.id, 'name', i.name, 'slug', i.slug, 'status', i.status,
      'production_limit', i.production_limit, 'allocated', i.allocated,
      'sold', i.sold, 'withdrawn', i.withdrawn, 'available', i.available,
      'used', i.sold + i.withdrawn,
      'remaining_capacity', greatest(i.production_limit - i.sold - i.withdrawn, 0),
      'used_percent', round(100.0 * (i.sold + i.withdrawn) / nullif(i.production_limit, 0), 1),
      'production_exhausted', i.sold + i.withdrawn >= i.production_limit,
      'sold_out', i.sold_out_at is not null
    ) order by (i.sold + i.withdrawn)::numeric / nullif(i.production_limit,0) desc, i.name, i.id)
      from inventory i), '[]'::jsonb),
    'inventory', jsonb_build_object(
      'available_units', coalesce((select sum(available) from inventory), 0),
      'sold_units', coalesce((select sum(sold) from inventory), 0),
      'withdrawn_units', coalesce((select sum(withdrawn) from inventory), 0),
      'production_exhausted_designs', (select count(*) from inventory where sold + withdrawn >= production_limit),
      'sold_out_designs', (select count(*) from inventory where sold_out_at is not null),
      'active_products', (select count(*) from inventory where status='active')
    ),
    'customers', jsonb_build_object(
      'total_eligible', (select count(*) from eligible_customers),
      'new_in_period', (select count(*) from eligible_customers where created_at >= range_start and created_at < range_end),
      'with_confirmed_orders', (select count(*) from eligible_customers c join customer_confirmed s on s.user_id=c.id),
      'repeat_customers', (select count(*) from eligible_customers c join customer_confirmed s on s.user_id=c.id where s.confirmed_order_count >= 2)
    ),
    'coupons', coalesce((select jsonb_agg(to_jsonb(x) order by x.redemptions desc, x.code, x.coupon_id)
      from (select r.coupon_id, r.coupon_code_snapshot as code,
        count(*)::integer as redemptions,
        sum(r.discount_paise)::bigint as discount_granted_paise,
        sum(o.total_paise)::bigint as confirmed_sales_paise
        from public.coupon_redemptions r
        join confirmed_orders o on o.id=r.order_id
        group by r.coupon_id,r.coupon_code_snapshot
        order by count(*) desc,r.coupon_code_snapshot,r.coupon_id limit 5) x), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_get_analytics(timestamptz,timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_get_analytics(timestamptz,timestamptz)
  to authenticated;

commit;
