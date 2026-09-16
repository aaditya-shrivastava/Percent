import fs from 'node:fs'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'

// Execute the complete migration chain with the same local boundary shims.
const db = new PGlite()
const root = new URL('./', import.meta.url)
const query = async sql => (await db.query(sql)).rows
const caller = async (role, uid, fn) => {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${uid ?? ''}',false)`)
  try { await fn() } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub','',false)") }
}
try {
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated,service_role;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key,bucket_id text,name text); alter table storage.objects enable row level security;`)
  await db.exec("create function storage.allow_any_operation(text[]) returns boolean language sql stable as $$select coalesce(current_setting('storage.operation',true)=any($1),false)$$")
  for (const name of fs.readdirSync(new URL('migrations/',root)).filter(f=>f.endsWith('.sql')).sort()) await db.exec(fs.readFileSync(new URL('migrations/'+name,root),'utf8'))
  const uid='10000000-0000-4000-a000-000000000001',colour='20000000-0000-4000-a000-000000000001'
  await db.exec(`insert into auth.users(id) values('${uid}'); insert into public.colours(id,slug,label,swatch_value) values('${colour}','black','Black','#000000')`)
  const payload=(code,limit=250)=>({product:{name:'Local transaction test',slug:code,design_code:code,fit_type:'standard',price_paise:129900,production_limit:limit},tags:[],variants:[{colour_id:colour,size:'S',sku:code+'-S',price_paise:129900,enabled:true}],images:[],variant_images:[]})
  const save=async(d,id=null,version=null)=>(await db.query('select public.save_product_draft($1::jsonb,$2::uuid,$3::timestamptz) as saved',[JSON.stringify(d),id,version])).rows[0].saved
  await caller('anon',null,()=>assert.rejects(save(payload('anon')),e=>e.code==='42501'))
  await caller('authenticated',uid,()=>assert.rejects(save(payload('customer')),e=>e.code==='42501'))
  for(const role of ['admin','super_admin']){
    await db.exec(`update private.user_roles set role='${role}' where user_id='${uid}'`)
    await caller('authenticated',uid,async()=>{
      const draft=payload('test-'+role.replace('_','-'),role==='admin'?250:1000)
      const created=await save(draft)
      assert.equal(created.status,'draft')
      const [p]=await query(`select * from public.products where id='${created.id}'`)
      assert.equal(p.is_visible,false);assert.equal(p.is_shop_available,false);assert.equal(p.production_limit,draft.product.production_limit)
      const [variant]=await query(`select * from public.product_variants where product_id='${p.id}'`)
      draft.variants[0].id=variant.id
      draft.product.name='Changed atomically'
      const edited=await save(draft,p.id,created.updated_at)
      await assert.rejects(save(draft,p.id,'2000-01-01'),e=>e.code==='PT409')
      const bad=structuredClone(draft);bad.product.name='Must roll back';bad.tags=['30000000-0000-4000-a000-000000000001']
      await assert.rejects(save(bad,p.id,edited.updated_at),e=>e.code==='23503')
      assert.equal((await query(`select name from public.products where id='${p.id}'`))[0].name,'Changed atomically')
      for(const extra of ['status','is_visible','is_shop_available','sold_quantity','inventory_units']){const bad=payload('bad-'+extra.replaceAll('_','-'));bad.product[extra]='active';await assert.rejects(save(bad),e=>e.code==='22023')}
      for(const limit of [0,-50,12.5,'NaN','Infinity',''])await assert.rejects(save(payload('bad-limit',limit)))
      const duplicate=payload('duplicate');duplicate.variants.push({...duplicate.variants[0]});await assert.rejects(save(duplicate),e=>e.code==='23505')
      const duplicateSku=payload('duplicate-sku');duplicateSku.variants[0].sku=variant.sku;await assert.rejects(save(duplicateSku),e=>e.code==='23505')
      await assert.rejects(save(payload(draft.product.slug)),e=>e.code==='23505')
      const identity=structuredClone(draft);identity.product.slug='changed-slug';await assert.rejects(save(identity,p.id,edited.updated_at),e=>e.code==='22023')
      const removal=structuredClone(draft);removal.variants=[];await assert.rejects(save(removal,p.id,edited.updated_at),e=>e.code==='22023')
      assert.equal((await query('select count(*)::int n from public.products'))[0].n,role==='admin'?1:2)
    })
  }
  const archived=payload('archive-local',1)
  let saved
  await caller('authenticated',uid,async()=>{saved=await save(archived)})
  const [variant]=await query(`select id from public.product_variants where product_id='${saved.id}'`)
  await db.exec(`insert into public.inventory_units(product_id,variant_id,piece_number) values('${saved.id}','${variant.id}',1)`)
  archived.variants[0].id=variant.id;archived.product.production_limit=250
  await caller('authenticated',uid,()=>assert.rejects(save(archived,saved.id,saved.updated_at),e=>e.code==='22023'))
  await db.exec(`update public.products set status='archived',archived_at=now() where id='${saved.id}'`)
  await caller('authenticated',uid,()=>assert.rejects(save(archived,saved.id,saved.updated_at),e=>e.code==='22023'))
  console.log('PASS draft RPC: anon/customer denied, admin/super_admin, 250/1000, draft-only, publication/inventory rejection, duplicates, stale save, relational rollback, immutable identity, no variant deletion, allocation lock, archived denial')
} finally { await db.close() }

