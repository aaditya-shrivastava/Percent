import fs from 'node:fs'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'

const db=new PGlite(),root=new URL('./',import.meta.url)
const caller=async(role,uid,fn)=>{await db.exec(`set role ${role};select set_config('request.jwt.claim.sub','${uid??''}',false)`);try{return await fn()}finally{await db.exec("reset role;select set_config('request.jwt.claim.sub','',false)")}}
try{
 await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key,bucket_id text,name text);alter table storage.objects enable row level security;`)
 await db.exec("create function storage.allow_any_operation(text[]) returns boolean language sql stable as $$select coalesce(current_setting('storage.operation',true)=any($1),false)$$")
 for(const name of fs.readdirSync(new URL('migrations/',root)).filter(f=>f.endsWith('.sql')).sort())await db.exec(fs.readFileSync(new URL('migrations/'+name,root),'utf8'))
 const uid='10000000-0000-4000-a000-000000000001',customer='10000000-0000-4000-a000-000000000002',category='20000000-0000-4000-a000-000000000001',colour='30000000-0000-4000-a000-000000000001',product='40000000-0000-4000-a000-000000000001',variant='50000000-0000-4000-a000-000000000001'
 await db.exec(`insert into auth.users(id)values('${uid}'),('${customer}');update private.user_roles set role='super_admin' where user_id='${uid}';insert into public.categories(id,slug,name,active)values('${category}','tees','Tees',true);insert into public.colours(id,slug,label,swatch_value)values('${colour}','black','Black','#000000');insert into public.products(id,design_code,slug,name,category_id,fit_type,price_paise,production_limit,is_shop_available)values('${product}','PUBLISH-TEST','publish-test','Publish Test','${category}','standard',129900,20,false);insert into public.product_variants(id,product_id,colour_id,size,sku,price_paise)values('${variant}','${product}','${colour}','M','PUBLISH-TEST-M',129900);insert into public.product_images(product_id,url,alt,width,height,role,sort_order)values('${product}','https://example.com/product.webp','Publish Test',1200,1500,'primary',0)`)
 const fresh=async()=>(await db.query('select updated_at::text,status,is_visible,is_shop_available from public.products where id=$1',[product])).rows[0]
 const publish=async(version)=>(await db.query('select public.publish_product($1,$2::timestamptz) result',[product,version])).rows[0].result
 let current=await fresh()
 await caller('anon',null,()=>assert.rejects(publish(current.updated_at),e=>e.code==='42501'))
 await caller('authenticated',customer,()=>assert.rejects(publish(current.updated_at),e=>e.code==='42501'))
 await caller('authenticated',uid,()=>assert.rejects(publish(current.updated_at),e=>e.code==='22023'&&/20 production units/.test(e.message)))
 await caller('authenticated',uid,async()=>{await db.query('select public.allocate_product_run($1,$2::jsonb,$3::timestamptz)',[product,JSON.stringify([{variant_id:variant,quantity:20}]),current.updated_at])})
 current=await fresh()
 await caller('authenticated',uid,()=>assert.rejects(db.query("update public.products set status='active',is_visible=true where id=$1",[product]),e=>e.code==='42501'))
 await caller('authenticated',uid,()=>assert.rejects(publish('2000-01-01'),e=>e.code==='PT409'))
 const result=await caller('authenticated',uid,()=>publish(current.updated_at));assert.equal(result.status,'active');assert.equal(result.historical_produced,20);assert.equal(result.eligible_stock,20)
 current=await fresh();assert.deepEqual({status:current.status,visible:current.is_visible,shop:current.is_shop_available},{status:'active',visible:true,shop:true})
 await caller('authenticated',uid,()=>assert.rejects(db.query('select public.allocate_product_run($1,$2::jsonb,$3::timestamptz)',[product,JSON.stringify([{variant_id:variant,quantity:20}]),current.updated_at]),e=>e.code==='22023'))
 await caller('authenticated',uid,()=>assert.rejects(db.query("update public.products set status='draft' where id=$1",[product]),e=>e.code==='22023'))
 const mediaProduct='40000000-0000-4000-a000-000000000002',mediaVariant='50000000-0000-4000-a000-000000000002'
 const mediaPath=`products/${mediaProduct}/${'a'.repeat(64)}.webp`
 const mediaUrl=`storage://percent-product-images/${mediaPath}`
 await db.exec(`insert into public.products(id,design_code,slug,name,category_id,fit_type,price_paise,production_limit,is_shop_available)values('${mediaProduct}','MEDIA-TEST','media-test','Local Media Test','${category}','standard',129900,2,false);insert into public.product_variants(id,product_id,colour_id,size,sku,price_paise)values('${mediaVariant}','${mediaProduct}','${colour}','M','MEDIA-TEST-M',129900);insert into public.product_images(product_id,url,alt,width,height,role,sort_order)values('${mediaProduct}','${mediaUrl}','Local media',1200,1500,'primary',0)`)
 let mediaVersion=(await db.query('select updated_at::text from public.products where id=$1',[mediaProduct])).rows[0].updated_at
 await caller('authenticated',uid,()=>assert.rejects(db.query('select public.publish_product($1,$2::timestamptz)',[mediaProduct,mediaVersion]),e=>e.code==='22023'&&/primary image/.test(e.message)))
 await db.exec(`insert into storage.objects(id,bucket_id,name)values(gen_random_uuid(),'percent-product-images','${mediaPath}')`)
 await caller('authenticated',uid,async()=>{await db.query('select public.allocate_product_run($1,$2::jsonb,$3::timestamptz)',[mediaProduct,JSON.stringify([{variant_id:mediaVariant,quantity:2}]),mediaVersion])})
 mediaVersion=(await db.query('select updated_at::text from public.products where id=$1',[mediaProduct])).rows[0].updated_at
 const mediaResult=await caller('authenticated',uid,async()=>(await db.query('select public.publish_product($1,$2::timestamptz) result',[mediaProduct,mediaVersion])).rows[0].result)
 assert.equal(mediaResult.status,'active')
 await db.exec('grant usage on schema storage to anon;grant select on storage.objects to anon')
 const visible=async(operation)=>{let rows;await caller('anon',null,async()=>{await db.exec(`select set_config('storage.operation','${operation}',false)`);rows=(await db.query('select name from storage.objects where name=$1',[mediaPath])).rows});return rows.length}
 assert.equal(await visible('object.sign_many'),1)
 assert.equal(await visible('object.list'),0)
 await db.exec(`update public.products set status='archived',archived_at=now(),is_shop_available=false where id='${mediaProduct}'`)
 assert.equal(await visible('object.sign_many'),1)
 console.log('PASS publication gate: anon/customer denied, partial/stale/direct bypass rejected, full run published atomically, allocation locked, no return to draft')
}finally{await db.close()}
