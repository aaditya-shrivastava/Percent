import fs from 'node:fs'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const ids = {
  customer: '10000000-0000-4000-a000-000000000001',
  purchasingSuper: '10000000-0000-4000-a000-000000000002',
  wishlistAdmin: '10000000-0000-4000-a000-000000000003',
  staffAdmin: '10000000-0000-4000-a000-000000000004',
  staffSuper: '10000000-0000-4000-a000-000000000005',
}
const caller = async (role, uid, fn) => {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${uid ?? ''}',false)`)
  try { return await fn() } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub','',false)") }
}

try {
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create schema private;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
    create table private.user_roles(user_id uuid primary key,role text not null);
    create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from private.user_roles r where r.user_id=auth.uid() and r.role in ('admin','super_admin'))$$;
    grant usage on schema private to authenticated; grant execute on function private.is_admin() to authenticated;
    create table public.profiles(id uuid primary key,display_name text not null,first_name text,last_name text,phone text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
    create table public.orders(id uuid primary key default gen_random_uuid(),order_reference text,user_id uuid,status text,payment_status text,fulfillment_status text,currency text,subtotal_paise bigint,discount_paise bigint,shipping_paise bigint,tax_paise bigint,total_paise bigint,created_at timestamptz default now());
    create table public.addresses(id uuid primary key default gen_random_uuid(),user_id uuid,label text,is_default boolean,full_name text,phone text,address_line1 text,address_line2 text,city text,state text,pin_code text,country text,created_at timestamptz default now(),updated_at timestamptz default now());
    create table public.products(id uuid primary key default gen_random_uuid(),name text,slug text);
    create table public.product_reviews(id uuid primary key default gen_random_uuid(),user_id uuid,product_id uuid,rating smallint,title text,status text,created_at timestamptz default now());
    create table public.wishlist_items(user_id uuid,product_id uuid,created_at timestamptz default now());
    create table public.checkout_reservations(id uuid primary key default gen_random_uuid(),order_id uuid,status text,expires_at timestamptz);
  `)
  for (const [name,id] of Object.entries(ids)) {
    const role = name === 'customer' ? 'customer' : name === 'purchasingSuper' || name === 'staffSuper' ? 'super_admin' : 'admin'
    await db.query('insert into auth.users(id,email) values($1,$2)',[id,`${name}@example.test`])
    await db.query('insert into public.profiles(id,display_name) values($1,$2)',[id,name])
    await db.query('insert into private.user_roles(user_id,role) values($1,$2)',[id,role])
  }
  const product=(await db.query("insert into public.products(name,slug) values('Fixture','fixture') returning id")).rows[0].id
  await db.query("insert into public.orders(order_reference,user_id,status,payment_status,fulfillment_status,currency,subtotal_paise,discount_paise,shipping_paise,tax_paise,total_paise) values('PCT-ELIGIBLE',$1,'pending','unpaid','unfulfilled','INR',149900,0,0,0,149900)",[ids.purchasingSuper])
  await db.query('insert into public.wishlist_items(user_id,product_id) values($1,$2)',[ids.wishlistAdmin,product])
  await db.exec(fs.readFileSync(new URL('migrations/20260921160000_admin_customer_eligibility_refinement.sql',import.meta.url),'utf8'))

  const list = async uid => caller('authenticated',uid,async()=>{
    const row=(await db.query("select public.admin_list_customers(null,'all','newest',1,25) result")).rows[0]
    return row.result
  })
  await caller('anon',null,()=>assert.rejects(db.query("select public.admin_list_customers(null,'all','newest',1,25)"),e=>e.code==='42501'))
  await caller('authenticated',ids.customer,()=>assert.rejects(db.query("select public.admin_list_customers(null,'all','newest',1,25)"),e=>e.code==='42501'))
  const fromAdmin=await list(ids.staffAdmin),fromSuper=await list(ids.staffSuper)
  assert.equal(Number(fromAdmin.count),3);assert.equal(Number(fromSuper.count),3)
  assert.deepEqual(new Set(fromAdmin.items.map(item=>item.id)),new Set([ids.customer,ids.purchasingSuper,ids.wishlistAdmin]))
  assert.equal(Number(fromAdmin.metrics.total_customers),3)
  assert.equal(Number(fromAdmin.metrics.customers_with_orders),1)
  assert.equal(Number(fromAdmin.metrics.total_customer_order_value_paise),149900)
  const orderSearch=await caller('authenticated',ids.staffAdmin,async()=>(await db.query("select public.admin_list_customers('PCT-ELIGIBLE','all','newest',1,25) result")).rows[0].result)
  assert.deepEqual(orderSearch.items.map(item=>item.id),[ids.purchasingSuper])
  const staffAdminDetail=await caller('authenticated',ids.staffAdmin,async()=>(await db.query('select public.admin_get_customer($1) result',[ids.staffAdmin])).rows[0].result)
  const staffSuperDetail=await caller('authenticated',ids.staffAdmin,async()=>(await db.query('select public.admin_get_customer($1) result',[ids.staffSuper])).rows[0].result)
  assert.equal(staffAdminDetail,null);assert.equal(staffSuperDetail,null)
  const purchasingDetail=await caller('authenticated',ids.staffAdmin,async()=>(await db.query('select public.admin_get_customer($1) result',[ids.purchasingSuper])).rows[0].result)
  assert.equal(purchasingDetail.profile.account_role,'super_admin');assert.equal(Number(purchasingDetail.metrics.order_count),1)
  console.log('PASS Phase 5 eligibility: customer/no activity, super_admin/order, admin/wishlist included; staff-only admin/super_admin excluded; detail and role boundaries enforced')
} finally { await db.close() }
