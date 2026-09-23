-- Phase 5 hosted verification correction.
-- Customer identity is auth.users.id = profiles.id; an admin role must not
-- remove a legitimate purchasing account from customer intelligence.
begin;

create or replace function public.admin_list_customers(
  search_text text default null,
  customer_filter text default 'all',
  sort_by text default 'newest',
  page_number integer default 1,
  page_size integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  safe_search text := nullif(btrim(coalesce(search_text, '')), '');
  safe_filter text := lower(coalesce(customer_filter, 'all'));
  safe_sort text := lower(coalesce(sort_by, 'newest'));
  safe_page integer := greatest(coalesce(page_number, 1), 1);
  safe_size integer := least(greatest(coalesce(page_size, 25), 1), 50);
  result jsonb;
begin
  if actor is null or not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if safe_filter not in ('all', 'has_orders', 'no_orders', 'recently_joined') then
    raise exception 'Invalid customer filter' using errcode = '22023';
  end if;
  if safe_sort not in ('newest', 'oldest', 'most_orders', 'highest_value', 'latest_order') then
    raise exception 'Invalid customer sort' using errcode = '22023';
  end if;

  with customer_base as materialized (
    select
      p.id,
      p.display_name,
      p.first_name,
      p.last_name,
      p.phone,
      p.created_at,
      p.updated_at,
      u.email,
      r.role as account_role
    from public.profiles p
    join auth.users u on u.id = p.id
    left join private.user_roles r on r.user_id = p.id
  ),
  order_stats as materialized (
    select
      o.user_id,
      count(*)::integer as order_count,
      coalesce(sum(o.total_paise) filter (where o.status <> 'cancelled'), 0)::bigint as lifetime_order_value_paise,
      max(o.created_at) as latest_order_at
    from public.orders o
    where o.user_id is not null
    group by o.user_id
  ),
  address_stats as materialized (
    select a.user_id, count(*)::integer as address_count
    from public.addresses a
    group by a.user_id
  ),
  review_stats as materialized (
    select r.user_id, count(*)::integer as review_count
    from public.product_reviews r
    group by r.user_id
  ),
  customers as materialized (
    select
      c.*,
      coalesce(os.order_count, 0) as order_count,
      coalesce(os.lifetime_order_value_paise, 0) as lifetime_order_value_paise,
      os.latest_order_at,
      coalesce(ads.address_count, 0) as address_count,
      coalesce(rs.review_count, 0) as review_count
    from customer_base c
    left join order_stats os on os.user_id = c.id
    left join address_stats ads on ads.user_id = c.id
    left join review_stats rs on rs.user_id = c.id
  ),
  filtered as materialized (
    select c.*
    from customers c
    where
      (safe_filter = 'all'
       or (safe_filter = 'has_orders' and c.order_count > 0)
       or (safe_filter = 'no_orders' and c.order_count = 0)
       or (safe_filter = 'recently_joined'
           and c.created_at >= date_trunc('month', timezone('UTC', now())) at time zone 'UTC'
           and c.created_at < (date_trunc('month', timezone('UTC', now())) + interval '1 month') at time zone 'UTC'))
      and (
        safe_search is null
        or c.display_name ilike '%' || safe_search || '%'
        or coalesce(c.first_name, '') ilike '%' || safe_search || '%'
        or coalesce(c.last_name, '') ilike '%' || safe_search || '%'
        or coalesce(c.email, '') ilike '%' || safe_search || '%'
        or coalesce(c.phone, '') ilike '%' || safe_search || '%'
        or exists (
          select 1 from public.orders o
          where o.user_id = c.id and o.order_reference ilike '%' || safe_search || '%'
        )
      )
  ),
  page_rows as (
    select f.*
    from filtered f
    order by
      case when safe_sort = 'newest' then f.created_at end desc nulls last,
      case when safe_sort = 'oldest' then f.created_at end asc nulls last,
      case when safe_sort = 'most_orders' then f.order_count end desc nulls last,
      case when safe_sort = 'highest_value' then f.lifetime_order_value_paise end desc nulls last,
      case when safe_sort = 'latest_order' then f.latest_order_at end desc nulls last,
      f.id asc
    limit safe_size
    offset (safe_page - 1) * safe_size
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(p) order by
      case when safe_sort = 'newest' then p.created_at end desc nulls last,
      case when safe_sort = 'oldest' then p.created_at end asc nulls last,
      case when safe_sort = 'most_orders' then p.order_count end desc nulls last,
      case when safe_sort = 'highest_value' then p.lifetime_order_value_paise end desc nulls last,
      case when safe_sort = 'latest_order' then p.latest_order_at end desc nulls last,
      p.id asc) from page_rows p), '[]'::jsonb),
    'count', (select count(*) from filtered),
    'page', safe_page,
    'page_size', safe_size,
    'metrics', jsonb_build_object(
      'total_customers', (select count(*) from customers),
      'customers_with_orders', (select count(*) from customers where order_count > 0),
      'new_customers_current_utc_month', (select count(*) from customers
        where created_at >= date_trunc('month', timezone('UTC', now())) at time zone 'UTC'
          and created_at < (date_trunc('month', timezone('UTC', now())) + interval '1 month') at time zone 'UTC'),
      'total_customer_order_value_paise', (select coalesce(sum(lifetime_order_value_paise), 0) from customers)
    )
  ) into result;

  return result;
end;
$$;

create or replace function public.admin_get_customer(customer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  result jsonb;
begin
  if actor is null or not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p.id,
      'display_name', p.display_name,
      'first_name', p.first_name,
      'last_name', p.last_name,
      'email', u.email,
      'account_role', r.role,
      'phone', p.phone,
      'created_at', p.created_at,
      'updated_at', p.updated_at
    ),
    'metrics', jsonb_build_object(
      'order_count', (select count(*) from public.orders o where o.user_id = p.id),
      'lifetime_order_value_paise', (select coalesce(sum(o.total_paise), 0) from public.orders o where o.user_id = p.id and o.status <> 'cancelled'),
      'average_order_value_paise', (select coalesce(round(avg(o.total_paise)), 0) from public.orders o where o.user_id = p.id and o.status <> 'cancelled'),
      'latest_order_at', (select max(o.created_at) from public.orders o where o.user_id = p.id),
      'address_count', (select count(*) from public.addresses a where a.user_id = p.id),
      'review_count', (select count(*) from public.product_reviews pr where pr.user_id = p.id),
      'wishlist_count', (select count(*) from public.wishlist_items wi where wi.user_id = p.id)
    ),
    'addresses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'label', a.label, 'is_default', a.is_default,
        'full_name', a.full_name, 'phone', a.phone,
        'address_line1', a.address_line1, 'address_line2', a.address_line2,
        'city', a.city, 'state', a.state, 'pin_code', a.pin_code,
        'country', a.country, 'created_at', a.created_at, 'updated_at', a.updated_at
      ) order by a.is_default desc, a.created_at asc, a.id asc)
      from public.addresses a where a.user_id = p.id
    ), '[]'::jsonb),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'order_reference', o.order_reference,
        'status', o.status, 'payment_status', o.payment_status,
        'fulfillment_status', o.fulfillment_status, 'currency', o.currency,
        'total_paise', o.total_paise, 'created_at', o.created_at,
        'active_reservation_count', (select count(*) from public.checkout_reservations cr where cr.order_id = o.id and cr.status = 'active' and cr.expires_at > now()),
        'reservation_expires_at', (select max(cr.expires_at) from public.checkout_reservations cr where cr.order_id = o.id and cr.status = 'active' and cr.expires_at > now())
      ) order by o.created_at desc, o.id desc)
      from public.orders o where o.user_id = p.id
    ), '[]'::jsonb),
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pr.id, 'product_id', pr.product_id, 'product_name', product.name,
        'rating', pr.rating, 'title', pr.title, 'status', pr.status,
        'created_at', pr.created_at
      ) order by pr.created_at desc, pr.id desc)
      from public.product_reviews pr
      left join public.products product on product.id = pr.product_id
      where pr.user_id = p.id
    ), '[]'::jsonb),
    'wishlist', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id', wi.product_id, 'product_name', product.name,
        'product_slug', product.slug, 'created_at', wi.created_at
      ) order by wi.created_at desc, wi.product_id desc)
      from public.wishlist_items wi
      left join public.products product on product.id = wi.product_id
      where wi.user_id = p.id
    ), '[]'::jsonb)
  ) into result
  from public.profiles p
  join auth.users u on u.id = p.id
  left join private.user_roles r on r.user_id = p.id
  where p.id = customer_id;

  return result;
end;
$$;

revoke all on function public.admin_list_customers(text,text,text,integer,integer) from public, anon, authenticated;
revoke all on function public.admin_get_customer(uuid) from public, anon, authenticated;
grant execute on function public.admin_list_customers(text,text,text,integer,integer) to authenticated;
grant execute on function public.admin_get_customer(uuid) to authenticated;

commit;
