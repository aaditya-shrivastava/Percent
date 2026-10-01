import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const db=new PGlite(),sql=s=>db.exec(s),rows=async s=>(await db.query(s)).rows
async function rejects(statement,code){let error;try{await sql(statement)}catch(e){error=e}assert.ok(error,`Expected rejection: ${statement}`);if(code)assert.equal(error.code,code,error.message)}
try{
 await sql(`
  create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
  create schema private;
  create table private.percent_principals(id uuid primary key,email text);
  create table public.profiles(id uuid primary key references private.percent_principals(id));
  create table public.coupons(id uuid primary key default gen_random_uuid(),code text not null unique check(code=upper(code) and length(code) between 1 and 40),kind text not null check(kind in('fixed','percentage')),amount_paise integer,percent_bps integer,minimum_subtotal_paise integer not null default 0 check(minimum_subtotal_paise>=0),starts_at timestamptz,ends_at timestamptz,active boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check((kind='fixed' and amount_paise is not null and amount_paise>0 and percent_bps is null)or(kind='percentage' and percent_bps is not null and percent_bps between 1 and 10000 and amount_paise is null)),check(ends_at is null or starts_at is null or ends_at>starts_at));
  create table public.orders(id uuid primary key default gen_random_uuid(),order_reference text not null unique,user_id uuid references public.profiles(id),status text not null default 'pending',payment_status text not null default 'unpaid',fulfillment_status text not null default 'unfulfilled',subtotal_paise bigint not null,shipping_paise bigint not null default 0,discount_paise bigint not null default 0,tax_paise bigint not null default 0,total_paise bigint not null,coupon_code_snapshot text,checkout_key uuid,checkout_request jsonb);
  create table public.addresses(id uuid primary key,user_id uuid,full_name text,address_line1 text,address_line2 text default '',phone text,pin_code text,country text,city text,state text);
  create table public.products(id uuid primary key,status text,is_visible boolean,is_shop_available boolean,archived_at timestamptz,sold_out_at timestamptz,name text,slug text);
  create table public.product_variants(id uuid primary key,product_id uuid,enabled boolean,price_paise integer,sku text,size text,colour_id uuid);
  create table public.colours(id uuid primary key,label text);
  create table public.product_images(id uuid primary key,product_id uuid,url text,role text,sort_order integer);
  create table public.order_addresses(order_id uuid,kind text,full_name text,email text,phone text,address_line1 text,address_line2 text,city text,state text,pin_code text,country text);
  create table public.order_items(id uuid primary key default gen_random_uuid(),order_id uuid,product_id uuid,variant_id uuid,product_name text,product_slug text,sku text,size text,colour text,image_url text,quantity integer,unit_price_paise integer);
  create table public.inventory_units(id uuid primary key,product_id uuid,variant_id uuid,piece_number integer,sold_at timestamptz,withdrawn_at timestamptz);
  create table public.checkout_reservations(order_id uuid,order_item_id uuid,inventory_unit_id uuid,status text default 'active',expires_at timestamptz,state_changed_at timestamptz);
  create function private.current_user_id()returns uuid language sql stable as $$select null::uuid$$;
  create function private.is_admin()returns boolean language sql stable as $$select false$$;
  create function private.checkout_reservation_ttl()returns interval language sql immutable as $$select interval '15 minutes'$$;
  create function private.checkout_shipping_paise(bigint)returns bigint language sql immutable as $$select 0::bigint$$;
  create function private.immutable_snapshot()returns trigger language plpgsql as $$begin raise exception 'immutable';end$$;
  create function private.touch_updated_at()returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
  create trigger touch_updated_at before update on public.coupons for each row execute function private.touch_updated_at();
  alter table public.coupons enable row level security;
  grant all on public.coupons to authenticated,service_role;
  create policy admin_manage on public.coupons for all to authenticated using(private.is_admin())with check(private.is_admin());
 `)
 await sql(fs.readFileSync('supabase/migrations/20260929200419_phase_9_coupon_foundation.sql','utf8'))
 assert.equal((await rows(`select to_regclass('public.coupon_redemptions') is not null ok`))[0].ok,true)
 await rejects(`insert into coupons(code,kind,percent_bps)values('lower','percentage',1000)`,'23514')
 await rejects(`insert into coupons(code,kind,percent_bps)values('OVER', 'percentage',10001)`,'23514')
 await sql(`insert into private.percent_principals values('10000000-0000-4000-a000-000000000001','fixture@example.invalid');insert into profiles values('10000000-0000-4000-a000-000000000001');insert into coupons(code,description,kind,percent_bps,minimum_subtotal_paise,maximum_discount_paise,total_usage_limit,per_customer_usage_limit,active)values('SAVE10','Fixture','percentage',1000,10000,25000,2,1,true);insert into coupons(code,description,kind,amount_paise,minimum_subtotal_paise,active)values('FIXED500','Fixture','fixed',50000,0,true)`)
 const pct=(await rows(`select private.evaluate_coupon(' save10 ','10000000-0000-4000-a000-000000000001',500000,false) result`))[0].result
 assert.equal(pct.valid,true);assert.equal(Number(pct.discount_paise),25000);assert.equal(pct.code,'SAVE10')
 const fixed=(await rows(`select private.evaluate_coupon('fixed500','10000000-0000-4000-a000-000000000001',30000,false) result`))[0].result
 assert.equal(Number(fixed.discount_paise),30000)
 const minimum=(await rows(`select private.evaluate_coupon('save10','10000000-0000-4000-a000-000000000001',9999,false) result`))[0].result
 assert.equal(minimum.reason,'minimum_not_met')
 const coupon=(await rows(`select id from coupons where code='SAVE10'`))[0].id
 await sql(`insert into orders(id,order_reference,user_id,subtotal_paise,discount_paise,total_paise)values('20000000-0000-4000-a000-000000000001','FIXTURE','10000000-0000-4000-a000-000000000001',500000,25000,475000);insert into coupon_redemptions(coupon_id,user_id,order_id,coupon_code_snapshot,discount_paise)values('${coupon}','10000000-0000-4000-a000-000000000001','20000000-0000-4000-a000-000000000001','SAVE10',25000)`)
 const customerLimit=(await rows(`select private.evaluate_coupon('SAVE10','10000000-0000-4000-a000-000000000001',500000,false) result`))[0].result
 assert.equal(customerLimit.reason,'customer_limit')
 await rejects(`update coupon_redemptions set discount_paise=1`,'P0001')
 assert.equal((await rows(`select has_table_privilege('authenticated','public.coupons','select') ok`))[0].ok,false)
 assert.equal((await rows(`select has_table_privilege('authenticated','public.coupon_redemptions','select') ok`))[0].ok,false)
 assert.equal((await rows(`select to_regprocedure('public.create_checkout_order(jsonb,uuid,uuid)')is not null old_ok,to_regprocedure('public.create_checkout_order(jsonb,uuid,uuid,text)')is not null new_ok`))[0].old_ok,true)
 console.log('PASS coupon migration, constraints, integer discounts, caps, limits, immutable redemption and RPC compatibility')
}finally{await db.close()}
