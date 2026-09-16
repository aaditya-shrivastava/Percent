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
  const allocate=async(p,values)=>(await db.query('select public.allocate_product_run($1,$2::jsonb,$3::timestamptz) result',[p.id,JSON.stringify(values),p.updated_at])).rows[0].result
  const create=async(code,limit)=>{
    const payload={product:{name:code,slug:code,design_code:code,fit_type:'standard',price_paise:129900,production_limit:limit},tags:[],variants:['S','M'].map(size=>({colour_id:colour,size,sku:code+'-'+size,price_paise:129900,enabled:true})),images:[],variant_images:[]}
    const p=(await db.query('select public.save_product_draft($1::jsonb) result',[JSON.stringify(payload)])).rows[0].result
    const variants=(await db.query('select id from public.product_variants where product_id=$1 order by id',[p.id])).rows
    return {p,values:variants.map(v=>({variant_id:v.id,quantity:0}))}
  }
  await caller('anon',null,()=>assert.rejects(allocate({id:uid,updated_at:'2020-01-01'},[]),e=>e.code==='42501'))
  await caller('authenticated',uid,()=>assert.rejects(allocate({id:uid,updated_at:'2020-01-01'},[]),e=>e.code==='42501'))
  for(const role of ['admin','super_admin']) {
    await db.exec(`update private.user_roles set role='${role}' where user_id='${uid}'`)
    await caller('authenticated',uid,async()=>{
      const {p,values}=await create('allocation-'+role.replace('_','-'),role==='admin'?250:1000)
      const targets=values.map(v=>({...v,quantity:100}))
      const first=await allocate(p,targets)
      assert.equal(first.allocated,200);assert.equal(first.remaining_to_allocate,role==='admin'?50:800)
      await assert.rejects(allocate(p,targets),e=>e.code==='PT409')
      const current={...p,updated_at:first.updated_at}
      for(const invalid of [[],[targets[0]],[targets[0],targets[0]],targets.map(v=>({...v,quantity:1})),targets.map(v=>({...v,quantity:1001})),targets.map(v=>({...v,quantity:role==='admin'?126:501})),targets.map(v=>({...v,quantity:-1})),targets.map(v=>({...v,quantity:1.5})),targets.map(v=>({...v,quantity:'100'})),targets.map(v=>({...v,other:1})),targets.map(v=>({...v,variant_id:uid}))]) await assert.rejects(allocate(current,invalid),e=>e.code==='22023')
      assert.equal((await allocate(current,targets)).added,0)
      targets[1].quantity=role==='admin'?150:900
      const full=await allocate(current,targets)
      assert.equal(full.remaining_to_allocate,0);assert.equal(full.allocated,role==='admin'?250:1000)
      await assert.rejects(db.query('insert into public.inventory_units(product_id,variant_id,piece_number) values($1,$2,1)',[p.id,values[0].variant_id]),e=>e.code==='42501')
    })
  }
  let fixture
  await caller('authenticated',uid,async()=>{fixture=await create('rollback-allocation',250)})
  await db.exec(`create function public.local_fail_allocation() returns trigger language plpgsql as $$ begin if new.variant_id='${fixture.values[1].variant_id}'::uuid then raise exception 'Local injected failure'; end if; return new; end $$; create trigger local_fail before insert on public.inventory_units for each row execute function public.local_fail_allocation();`)
  const before=(await query('select count(*)::int n from public.inventory_adjustments'))[0].n
  await caller('authenticated',uid,()=>assert.rejects(allocate(fixture.p,fixture.values.map(v=>({...v,quantity:10}))),/Local injected failure/))
  assert.equal((await db.query('select count(*)::int n from public.inventory_units where product_id=$1',[fixture.p.id])).rows[0].n,0)
  assert.equal((await query('select count(*)::int n from public.inventory_adjustments'))[0].n,before)
  const [acl]=await query(`select has_function_privilege('anon','public.allocate_product_run(uuid,jsonb,timestamptz)','execute') anon, has_function_privilege('service_role','public.allocate_product_run(uuid,jsonb,timestamptz)','execute') service`)
  assert.equal(acl.anon,false);assert.equal(acl.service,false)
  console.log('PASS local allocation: roles/grants, 250/1000 limits, partial/full, invalid payloads, reduction denial, stale PT409, no-op, injected rollback including audit')
} finally { await db.close() }
