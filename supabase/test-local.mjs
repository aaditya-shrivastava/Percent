import fs from 'node:fs'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
process.chdir(fileURLToPath(new URL('.',import.meta.url)))
const db = new PGlite()
const results=[]
async function test(name,fn) { await fn(); results.push({name,status:'passed'}); console.log('PASS '+name) }
const sql = s => db.exec(s)
const rows = async s => (await db.query(s)).rows
async function rejects(s,code) { let error;try {await sql(s)} catch(e){error=e} assert.ok(error,'Expected rejection: '+s); if(code) assert.equal(error.code,code,error.message) }
async function as(role,user,fn) {
 await sql(`set role ${role}; select set_config('request.jwt.claim.sub','${user??''}',false);`)
 try {await fn()} finally {await sql("reset role; select set_config('request.jwt.claim.sub','',false);")}
}
// Minimal Supabase boundary shim. Real PostgreSQL tables, grants, triggers and RLS;
// not an Auth server, HTTP Data API or Storage server test.
await sql(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
 create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated,service_role; grant execute on function auth.uid() to anon,authenticated,service_role;
 create schema storage; create table storage.buckets(id text primary key,name text not null,public boolean,file_size_limit bigint,allowed_mime_types text[]);
`)
try {
 await test('Migration executes on a fresh PostgreSQL database',async()=>{ for(const f of fs.readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort()) await sql(fs.readFileSync('migrations/'+f,'utf8')) })
 await test('Seed is repeatable and creates only draft catalog/content',async()=>{
  await sql(fs.readFileSync('seed.sql','utf8')); await sql(fs.readFileSync('seed.sql','utf8'))
  assert.equal((await rows('select count(*)::int n from products'))[0].n,27)
  assert.equal((await rows('select count(*)::int n from product_variants'))[0].n,216)
  assert.equal((await rows('select count(*)::int n from blog_posts'))[0].n,9)
  assert.equal((await rows("select count(*)::int n from products where status<>'draft'"))[0].n,0)
  assert.equal((await rows('select count(*)::int n from inventory_units'))[0].n,0)
 })
 const p=(await rows("select * from products where slug='ink-bloom-tee'"))[0]
 const draft=(await rows("select * from products where slug='echo-script-tee'"))[0]
 const v=(await rows(`select * from product_variants where product_id='${p.id}' order by sku limit 1`))[0]
 const u1='10000000-0000-4000-a000-000000000001',u2='10000000-0000-4000-a000-000000000002',admin='10000000-0000-4000-a000-000000000003'
 await test('Auth bootstrap ignores self-assigned role metadata',async()=>{
  await sql(`insert into auth.users(id,raw_user_meta_data) values('${u1}','{"role":"super_admin"}'),('${u2}','{}'),('${admin}','{}')`)
  assert.equal((await rows(`select role from private.user_roles where user_id='${u1}'`))[0].role,'customer')
  assert.equal((await rows('select count(*)::int n from profiles'))[0].n,3)
 })
 await test('Duplicate product/blog slugs and invalid foreign keys rejected',async()=>{
  await rejects(`insert into products(design_code,slug,name,fit_type,price_paise) values('duplicate','${p.slug}','Duplicate','standard',10)`,'23505')
  await rejects(`insert into blog_posts(slug,title,excerpt,introduction,category,author) select slug,title,excerpt,introduction,category,author from blog_posts limit 1`,'23505')
  await rejects(`insert into wishlist_items(user_id,product_id) values('${u1}','00000000-0000-4000-a000-000000000000')`,'23503')
 })
 await test('Limited runs reject 101 produced and activation without 100 allocated units',async()=>{
  await rejects("insert into products(design_code,slug,name,fit_type,price_paise,total_produced) values('bad','bad','Bad','standard',10,101)",'23514')
  await rejects(`update products set status='active',is_visible=true where id='${p.id}'`,'P0001')
  await sql(`insert into inventory_units(product_id,variant_id,piece_number) select '${p.id}','${v.id}',n from generate_series(1,100)n; update products set status='active',is_visible=true where id='${p.id}';`)
  await rejects(`insert into inventory_units(product_id,variant_id,piece_number) values('${p.id}','${v.id}',101)`,'P0001')
  await rejects(`update products set status='archived',archived_at=now(),sold_out_at=now() where id='${p.id}'`,'P0001')
 })
 await test('Money, coupon values and variant-product consistency are constrained',async()=>{
  await rejects("insert into coupons(code,kind) values('INVALID','fixed')",'23514')
  await rejects("insert into coupons(code,kind,percent_bps) values('INVALID','percentage',10001)",'23514')
  await rejects(`update products set price_paise=-1 where id='${p.id}'`,'23514')
  const other=(await rows(`select id from product_variants where product_id='${draft.id}' limit 1`))[0].id
  await rejects(`insert into inventory_units(product_id,variant_id,piece_number) values('${draft.id}','${v.id}',1)`,'23503')
  assert.ok(other)
 })
 await test('Public catalog is readable; draft products and their images/variants are private',async()=>as('anon',null,async()=>{
  assert.equal((await rows('select count(*)::int n from products'))[0].n,1)
  assert.equal((await rows(`select count(*)::int n from product_variants where product_id='${draft.id}'`))[0].n,0)
  assert.equal((await rows(`select count(*)::int n from product_images where product_id='${draft.id}'`))[0].n,0)
  assert.equal((await rows('select count(*)::int n from blog_posts'))[0].n,0)
  assert.equal((await rows('select count(*)::int n from blog_sections'))[0].n,0)
  await rejects('select * from profiles','42501')
  await rejects('select * from inventory_units','42501')
 }))
 await test('Published blog and sections readable; scheduled content remains private',async()=>{
  await sql("update blog_posts set status='published',published_at=now()-interval '1 day' where slug='less-ordinary'; update blog_posts set status='published',published_at=now()+interval '1 day' where slug='intentional-design'")
  await as('anon',null,async()=>{assert.equal((await rows('select count(*)::int n from blog_posts'))[0].n,1);assert.equal((await rows('select count(*)::int n from blog_sections'))[0].n,3)})
 })
 let address,review;
 await test('Customers can edit only their own profile and addresses',async()=>{
  await as('authenticated',u1,async()=>{
   assert.equal((await rows('select count(*)::int n from profiles'))[0].n,1)
   await sql("update profiles set display_name='Owner'")
   address=(await rows(`insert into addresses(user_id,full_name,phone,address_line1,city,state,pin_code) values('${u1}','Owner','9876543210','Original street','Mumbai','MH','400001') returning id`))[0].id
   await rejects(`insert into addresses(user_id,full_name,phone,address_line1,city,state,pin_code) values('${u2}','Other','9876543210','Other','Mumbai','MH','400001')`,'42501')
   await rejects(`update addresses set user_id='${u2}' where id='${address}'`,'42501')
  })
  await as('authenticated',u2,async()=>{
   assert.equal((await rows(`select * from addresses where id='${address}'`)).length,0)
   await sql(`update addresses set city='Stolen' where id='${address}'; delete from addresses where id='${address}'`)
  })
  assert.equal((await rows(`select city from addresses where id='${address}'`))[0].city,'Mumbai')
 })
 await test('Wishlist ownership and duplicate protection',async()=>{
  await as('authenticated',u1,async()=>{
   await sql(`insert into wishlist_items(user_id,product_id) values('${u1}','${p.id}')`)
   await rejects(`insert into wishlist_items(user_id,product_id) values('${u1}','${p.id}')`,'23505')
   await rejects(`insert into wishlist_items(user_id,product_id) values('${u2}','${p.id}')`,'42501')
  })
  await as('authenticated',u2,async()=>{assert.equal((await rows('select * from wishlist_items')).length,0);await sql('delete from wishlist_items')})
  assert.equal((await rows('select * from wishlist_items')).length,1)
 })
 await test('Review ownership, validation and moderation cannot be bypassed',async()=>{
  await as('authenticated',u1,async()=>{
   review=(await rows(`insert into product_reviews(user_id,product_id,rating,body,customer_name) values('${u1}','${p.id}',5,'Great','Owner') returning id`))[0].id
   await sql(`update product_reviews set body='Updated' where id='${review}'`)
   await rejects(`update product_reviews set status='approved' where id='${review}'`,'42501')
   await rejects(`update product_reviews set rating=6 where id='${review}'`,'23514')
   await rejects(`insert into product_reviews(user_id,product_id,rating,body,customer_name) values('${u2}','${p.id}',5,'Fake','Fake')`,'42501')
  })
  await as('authenticated',u2,async()=>{assert.equal((await rows('select * from product_reviews')).length,0);await sql(`update product_reviews set body='Hijack' where id='${review}'`)})
  await as('anon',null,async()=>assert.equal((await rows('select * from product_reviews')).length,0))
  await sql(`update product_reviews set status='approved' where id='${review}'`)
  await as('anon',null,async()=>assert.equal((await rows('select * from product_reviews')).length,1))
  await as('authenticated',u1,async()=>await sql(`update product_reviews set body='Changed after approval' where id='${review}'`))
  assert.equal((await rows(`select body from product_reviews where id='${review}'`))[0].body,'Updated')
 })
 await test('Normal clients cannot self-assign roles or modify operational inventory/orders',async()=>as('authenticated',u1,async()=>{
  await rejects(`update private.user_roles set role='super_admin' where user_id='${u1}'`,'42501')
  await rejects(`insert into private.user_roles(user_id,role) values('${u1}','admin')`,'42501')
  await rejects(`update inventory_units set sold_at=now() where product_id='${p.id}'`,'42501')
  await rejects("insert into orders(order_reference,subtotal_paise,total_paise) values('fake',1,1)",'42501')
 }))
 await test('Protected admin role grants catalog access but not role assignment',async()=>{
  await sql(`update private.user_roles set role='admin' where user_id='${admin}'`)
  await as('authenticated',admin,async()=>{
   assert.equal((await rows('select count(*)::int n from products'))[0].n,27)
   await sql(`update products set name='Admin name' where id='${draft.id}'`)
   await rejects(`update private.user_roles set role='super_admin' where user_id='${admin}'`,'42501')
  })
  await as('authenticated',u1,async()=>await sql(`update products set name='Customer overwrite' where id='${draft.id}'`))
  assert.equal((await rows(`select name from products where id='${draft.id}'`))[0].name,'Admin name')
 })
 await test('Order items/address are immutable snapshots; private order reads enforced',async()=>{
  const o=(await rows(`insert into orders(order_reference,user_id,subtotal_paise,total_paise) values('TEST-1','${u1}',100,100) returning id`))[0].id
  await sql(`insert into order_items(order_id,product_id,variant_id,product_name,product_slug,sku,size,colour,quantity,unit_price_paise) values('${o}','${p.id}','${v.id}','Historic name','${p.slug}','Historic sku','M','Stone',1,100);
   insert into order_addresses(order_id,full_name,email,phone,address_line1,city,state,pin_code,country) values('${o}','Historic name','test@example.invalid','9876543210','Historic street','Mumbai','MH','400001','IN');
   update products set name='New name',price_paise=999 where id='${p.id}'; update addresses set address_line1='New street' where id='${address}';`)
  assert.equal((await rows(`select product_name from order_items where order_id='${o}'`))[0].product_name,'Historic name')
  assert.equal((await rows(`select address_line1 from order_addresses where order_id='${o}'`))[0].address_line1,'Historic street')
  await rejects(`update order_items set product_name='Mutated' where order_id='${o}'`,'P0001')
  await rejects(`delete from order_addresses where order_id='${o}'`,'P0001')
  await as('authenticated',u1,async()=>{assert.equal((await rows('select * from orders')).length,1);assert.equal((await rows('select * from order_items')).length,1)})
  await as('authenticated',u2,async()=>{for(const t of ['orders','order_items','order_addresses']) assert.equal((await rows('select * from '+t)).length,0)})
 })
 await test('100th sale permanently archives; no restock, reuse, deletion or run expansion',async()=>{
  await sql(`update inventory_units set sold_at=now() where product_id='${p.id}' and piece_number<=99`)
  assert.equal((await rows(`select status from products where id='${p.id}'`))[0].status,'active')
  await sql(`update inventory_units set sold_at=now() where product_id='${p.id}' and piece_number=100`)
  const final=(await rows(`select * from products where id='${p.id}'`))[0];assert.equal(final.status,'archived');assert.ok(final.sold_out_at)
  await rejects(`update products set status='active',archived_at=null where id='${p.id}'`,'P0001')
  await rejects(`update products set total_produced=101 where id='${p.id}'`,'P0001')
  await rejects(`update inventory_units set sold_at=null where product_id='${p.id}'`,'P0001')
  await rejects(`delete from inventory_units where product_id='${p.id}'`,'P0001')
  await rejects(`delete from products where id='${p.id}'`,'P0001')
  assert.equal((await rows(`select count(*)::int n from inventory_adjustments`))[0].n,200)
  await rejects('delete from inventory_adjustments','P0001')
 })
 await test('Every application table has RLS and Storage buckets remain private',async()=>{
  assert.equal((await rows("select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r' and not c.relrowsecurity"))[0].n,0)
  assert.equal((await rows('select count(*)::int n from storage.buckets where public'))[0].n,0)
  assert.equal((await rows('select count(*)::int n from storage.buckets'))[0].n,3)
 })
 fs.writeFileSync('../docs/backend/test-results.json',JSON.stringify({runtime:'PGlite PostgreSQL; mocked auth.uid/Auth table and Storage bucket metadata only',remoteVerified:false,results},null,2)+'\n')
 console.log(`${results.length} test groups passed. Hosted Supabase/Auth/Storage and concurrent-session tests are deferred.`)
} catch(e) { console.error(e.message, e.code??'');process.exitCode=1 } finally {await db.close()}
