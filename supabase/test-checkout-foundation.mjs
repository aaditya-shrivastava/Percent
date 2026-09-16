import fs from 'node:fs'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const root = new URL('./', import.meta.url)
const a = '10000000-0000-4000-a000-000000000001'
const b = '10000000-0000-4000-a000-000000000002'
const product = '20000000-0000-4000-a000-000000000001'
const variant = '30000000-0000-4000-a000-000000000001'
const addressA = '40000000-0000-4000-a000-000000000001'
const addressB = '40000000-0000-4000-a000-000000000002'
const keyA = '50000000-0000-4000-a000-000000000001'
const keyB = keyA // The same key is valid independently for another owner.
const cart = [{ variant_id: variant, quantity: 1 }]
const caller = async (role, uid, run) => {
  await db.exec(`set role ${role};select set_config('request.jwt.claim.sub','${uid ?? ''}',false)`)
  try { return await run() } finally { await db.exec("reset role;select set_config('request.jwt.claim.sub','',false)") }
}
const create = (addressId, key, lines = cart) =>
  db.query('select public.create_checkout_order($1::jsonb,$2::uuid,$3::uuid) result',
    [JSON.stringify(lines), addressId, key])
const count = async table => Number((await db.query(`select count(*) n from public.${table}`)).rows[0].n)

try {
  await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key,bucket_id text,name text);alter table storage.objects enable row level security")
  await db.exec("create function storage.allow_any_operation(text[]) returns boolean language sql stable as $$select coalesce(current_setting('storage.operation',true)=any($1),false)$$")
  for (const name of fs.readdirSync(new URL('migrations/',root)).filter(n => n.endsWith('.sql')).sort())
    await db.exec(fs.readFileSync(new URL('migrations/' + name,root),'utf8'))
  assert.equal(Number((await db.query('select private.checkout_shipping_paise($1::bigint) value',[129900])).rows[0].value),0)
  await db.exec(`insert into auth.users(id,email)values
    ('${a}','a@example.com'),('${b}','b@example.com');
    insert into public.categories(slug,name)values('tee','Tee');
    insert into public.colours(slug,label,swatch_value)values('black','Black','#000000');
    insert into public.products(id,design_code,slug,name,fit_type,price_paise,production_limit)
      values('${product}','LOCAL-TEE','local-tee','Local Tee','standard',129900,2);
    insert into public.product_variants(id,product_id,colour_id,size,sku,price_paise)
      select '${variant}','${product}',id,'M','LOCAL-TEE-M',129900 from public.colours;
    insert into public.inventory_units(product_id,variant_id,piece_number)
      values('${product}','${variant}',1),('${product}','${variant}',2);
    update public.products set status='active',is_visible=true,is_shop_available=true
      where id='${product}';
    insert into public.addresses(id,user_id,full_name,phone,address_line1,city,state,pin_code)
      values('${addressA}','${a}','A Customer','9876543210','One Street','Mumbai','Maharashtra','400001'),
            ('${addressB}','${b}','B Customer','9876543211','Two Street','Mumbai','Maharashtra','400002')`)
  await caller('anon',null,() => assert.rejects(create(addressA,keyA),e => e.code === '42501'))
  await caller('authenticated',a,() => assert.rejects(create(addressB,keyA),e => e.code === '22023'))
  await caller('authenticated',a,() => assert.rejects(
    db.query("insert into public.orders(order_reference,user_id,subtotal_paise,total_paise)values('PCT-FAKE',$1,1,1)",[a]),
    e => e.code === '42501'))
  const first = (await caller('authenticated',a,() => create(addressA,keyA))).rows[0].result
  assert.equal(first.status,'pending')
  assert.equal(first.payment_status,'unpaid')
  assert.equal(first.fulfillment_status,'unfulfilled')
  assert.equal(first.total_paise,129900)
  assert.equal(first.shipping_paise,0)
  assert.equal(first.reservation_active,true)
  assert.equal((await caller('authenticated',a,() => create(addressA,keyA))).rows[0].result.id,first.id)
  await caller('authenticated',a,() => assert.rejects(create(addressA,keyA,[{variant_id:variant,quantity:2}]),e => e.code === '22023'))
  assert.equal(await count('orders'),1)
  assert.equal(await count('checkout_reservations'),1)
  assert.equal((await db.query('select count(*) n from public.inventory_units where sold_at is not null')).rows[0].n,0)
  await caller('authenticated',b,() => assert.rejects(create(addressB,keyB,[{variant_id:variant,quantity:2}]),e => e.code === 'PT409'))
  assert.equal(await count('orders'),1)
  const second = (await caller('authenticated',b,() => create(addressB,keyB))).rows[0].result
  assert.notEqual(second.id,first.id)
  assert.equal(await count('checkout_reservations'),2)
  await caller('authenticated',b,() => assert.rejects(create(addressB,'50000000-0000-4000-a000-000000000003'),e => e.code === 'PT409'))
  assert.equal(await count('orders'),2)
  await caller('authenticated',a,async () => assert.equal((await db.query('select * from public.orders')).rows.length,1))
  await caller('authenticated',b,async () => assert.equal((await db.query('select * from public.orders')).rows.length,1))
  await caller('authenticated',a,() => assert.rejects(
    db.query('select * from public.checkout_reservations'),e => e.code === '42501'))
  await caller('authenticated',a,() => assert.rejects(
    db.query('update public.checkout_reservations set status=$1',['released']),e => e.code === '42501'))
  // Simulate elapsed time without waiting fifteen minutes; historical rows stay.
  await db.exec(`alter table public.checkout_reservations disable trigger guard_checkout_reservation;
    update public.checkout_reservations
      set reserved_at=now()-interval '31 minutes',expires_at=now()-interval '16 minutes'
      where order_id='${first.id}';
    alter table public.checkout_reservations enable trigger guard_checkout_reservation`)
  const reclaimed = (await caller('authenticated',a,() => create(addressA,'50000000-0000-4000-a000-000000000004'))).rows[0].result
  assert.notEqual(reclaimed.id,first.id)
  assert.equal(await count('orders'),3)
  assert.equal(await count('checkout_reservations'),3)
  assert.equal((await db.query("select count(*) n from public.checkout_reservations where status='expired'")).rows[0].n,1)
  const oldReplay = (await caller('authenticated',a,() => create(addressA,keyA))).rows[0].result
  assert.equal(oldReplay.id,first.id)
  assert.equal(oldReplay.reservation_active,false)
  assert.equal((await db.query('select count(*) n from public.inventory_units where sold_at is not null')).rows[0].n,0)
  console.log('PASS checkout foundation: auth, ownership, exact pieces, stock conflict rollback, server totals, idempotency, unpaid/unsold boundary, reservation privacy')
} finally { await db.close() }
