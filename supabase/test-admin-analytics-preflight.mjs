import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
await db.exec(`
  create schema auth; create schema private;
  create table private.user_roles(user_id uuid primary key, role text);
  create function private.current_user_id() returns uuid language sql stable as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;
  create function private.is_admin() returns boolean language sql stable as $$ select true $$;
  create table public.profiles(id uuid primary key, created_at timestamptz not null default now());
  create table public.orders(id uuid primary key, user_id uuid, status text not null, payment_status text not null, total_paise bigint not null, created_at timestamptz not null default now());
  create table public.order_items(id uuid primary key, order_id uuid not null, product_id uuid, product_name text not null, quantity integer not null, line_total_paise bigint not null);
  create table public.products(id uuid primary key, name text not null, slug text not null, status text not null, production_limit integer not null, sold_out_at timestamptz);
  create table public.product_variants(id uuid primary key, enabled boolean not null);
  create table public.inventory_units(id uuid primary key, product_id uuid, variant_id uuid, sold_at timestamptz, withdrawn_at timestamptz);
  create table public.addresses(id uuid primary key, user_id uuid);
  create table public.product_reviews(id uuid primary key, user_id uuid);
  create table public.wishlist_items(id uuid primary key, user_id uuid);
  create table public.coupon_redemptions(id uuid primary key, coupon_id uuid, user_id uuid, order_id uuid, coupon_code_snapshot text, discount_paise bigint, created_at timestamptz not null default now());
  create role anon; create role authenticated; create role service_role;
`)

const migration = await readFile(new URL('./migrations/20260930192557_admin_analytics_foundation.sql', import.meta.url), 'utf8')
await db.exec(migration)

const result = await db.query(`select public.admin_get_analytics(now() - interval '30 days', now()) as payload`)
const payload = result.rows[0].payload
assert.equal(payload.summary.confirmed_orders, 0)
assert.equal(payload.summary.confirmed_sales_paise, 0)
assert.equal(payload.summary.units_sold, 0)
assert.deepEqual(payload.top_products, [])
assert.deepEqual(payload.coupons, [])
assert.ok(payload.trend.length >= 30)

await db.exec(`
  insert into public.products(id,name,slug,status,production_limit,sold_out_at) values
    ('10000000-0000-0000-0000-000000000001','All sold','all-sold','archived',100,now()),
    ('10000000-0000-0000-0000-000000000002','Mixed exhaustion','mixed-exhaustion','archived',100,null),
    ('10000000-0000-0000-0000-000000000003','One remaining','one-remaining','active',100,null),
    ('10000000-0000-0000-0000-000000000004','All withdrawn','all-withdrawn','archived',100,null),
    ('10000000-0000-0000-0000-000000000005','Configurable fifty','configurable-fifty','archived',50,null);
  insert into public.product_variants(id,enabled) values
    ('20000000-0000-0000-0000-000000000001',true),
    ('20000000-0000-0000-0000-000000000002',true),
    ('20000000-0000-0000-0000-000000000003',true),
    ('20000000-0000-0000-0000-000000000004',true),
    ('20000000-0000-0000-0000-000000000005',true);
  insert into public.inventory_units(id,product_id,variant_id,sold_at,withdrawn_at)
  select ('30000000-0000-0000-' || lpad(p::text,4,'0') || '-' || lpad(n::text,12,'0'))::uuid,
    ('10000000-0000-0000-0000-' || lpad(p::text,12,'0'))::uuid,
    ('20000000-0000-0000-0000-' || lpad(p::text,12,'0'))::uuid,
    case when p=1 or (p in (2,3) and n<=94) or (p=5 and n<=25) then now() end,
    case when (p=2 and n>94) or (p=3 and n between 95 and 99) or p=4 or (p=5 and n>25) then now() end
  from generate_series(1,5) p
  cross join lateral generate_series(1,case when p=5 then 50 else 100 end) n;
`)

const scenarios = (await db.query(`select public.admin_get_analytics(null,null) as payload`)).rows[0].payload
const production = new Map(scenarios.production.map(row => [row.name, row]))
assert.deepEqual(
  ['used','remaining_capacity','used_percent','production_exhausted','sold_out'].map(key => production.get('All sold')[key]),
  [100,0,100,true,true])
assert.deepEqual(
  ['sold','withdrawn','used','remaining_capacity','used_percent','production_exhausted','sold_out'].map(key => production.get('Mixed exhaustion')[key]),
  [94,6,100,0,100,true,false])
assert.deepEqual(
  ['sold','withdrawn','used','remaining_capacity','used_percent','production_exhausted'].map(key => production.get('One remaining')[key]),
  [94,5,99,1,99,false])
assert.deepEqual(
  ['sold','withdrawn','used','remaining_capacity','used_percent','production_exhausted','sold_out'].map(key => production.get('All withdrawn')[key]),
  [0,100,100,0,100,true,false])
assert.deepEqual(
  ['production_limit','sold','withdrawn','used','remaining_capacity','production_exhausted'].map(key => production.get('Configurable fifty')[key]),
  [50,25,25,50,0,true])
assert.equal(scenarios.inventory.production_exhausted_designs, 4)
assert.equal(scenarios.inventory.sold_out_designs, 1)

const grants = await db.query(`
  select grantee, privilege_type from information_schema.routine_privileges
  where routine_schema='public' and routine_name='admin_get_analytics'
  order by grantee
`)
assert.deepEqual(grants.rows.filter(row => ['anon', 'authenticated', 'service_role', 'PUBLIC'].includes(row.grantee)),
  [{ grantee: 'authenticated', privilege_type: 'EXECUTE' }])

const source = migration.toLowerCase()
assert.match(source, /private\.current_user_id\(\)/)
assert.match(source, /private\.is_admin\(\)/)
assert.doesNotMatch(source, /auth\.uid\(\)/)
assert.doesNotMatch(source, /random\s*\(/)
assert.match(source, /payment_status\s*=\s*'paid'\s+and\s+o\.status\s*=\s*'completed'/)
assert.match(source, /i\.sold\s*\+\s*i\.withdrawn\s*>=\s*i\.production_limit/)
assert.match(source, /greatest\(i\.production_limit\s*-\s*i\.sold\s*-\s*i\.withdrawn,\s*0\)/)
assert.doesNotMatch(source, /sold_out'\s*,\s*i\.sold\s*>=/)

await db.exec(`create or replace function private.is_admin() returns boolean language sql stable as $$ select false $$`)
await assert.rejects(
  db.query(`select public.admin_get_analytics(now() - interval '7 days',now())`),
  error => error?.message?.includes('Admin access required'))

console.log('PASS Admin Analytics SQL syntax, zero-data output, authorization grants, and confirmed-sale semantics')
await db.close()
