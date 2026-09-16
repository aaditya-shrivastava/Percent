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
  const adjust=async(p,v,op,n,reason='Damage',note='Local audit note')=>(await db.query('select public.adjust_variant_inventory($1,$2,$3,$4::numeric,$5,$6::timestamptz,$7) result',[p.id,v,op,n,reason,p.updated_at,note])).rows[0].result
  const fresh=async id=>(await db.query('select id,updated_at::text from public.products where id=$1',[id])).rows[0]
  await caller('anon',null,()=>assert.rejects(adjust({id:uid,updated_at:'2000-01-01'},uid,'INCREASE',1),e=>e.code==='42501'))
  await caller('authenticated',uid,()=>assert.rejects(adjust({id:uid,updated_at:'2000-01-01'},uid,'INCREASE',1),e=>e.code==='42501'))
  for(const role of ['admin','super_admin']){
    await db.exec(`update private.user_roles set role='${role}' where user_id='${uid}'`)
    await caller('authenticated',uid,async()=>{
      const fixture=await create('adjust-'+role.replace('_','-'),20),v=fixture.values[0].variant_id
      let p=fixture.p
      const one=await adjust(p,v,'INCREASE',10);assert.equal(one.after_quantity,10)
      await assert.rejects(adjust(p,v,'INCREASE',1),e=>e.code==='PT409');p=await fresh(p.id)
      let r=await adjust(p,v,'INCREASE',5);assert.equal(r.historical_produced,15);p=await fresh(p.id)
      await assert.rejects(adjust(p,v,'INCREASE',6),e=>e.code==='22023')
      r=await adjust(p,v,'DECREASE',3);assert.equal(r.after_quantity,12);assert.equal(r.historical_produced,15);p=await fresh(p.id)
      r=await adjust(p,v,'SET_EXACT',10);assert.equal(r.after_quantity,10);p=await fresh(p.id)
      r=await adjust(p,v,'SET_EXACT',13);assert.equal(r.historical_produced,18);p=await fresh(p.id)
      const [record]=await db.query('select * from public.inventory_adjustment_operations where id=$1',[r.operation_id]).then(x=>x.rows)
      assert.equal(record.operation,'SET_EXACT');assert.equal(record.internal_note,'Local audit note');assert.equal(record.actor_id,uid)
      assert.equal((await db.query('select count(*)::int n from public.inventory_adjustments where operation_id=$1',[r.operation_id])).rows[0].n,3)
      assert.deepEqual((await db.query('select piece_number from public.inventory_units where variant_id=$1 and withdrawn_at is not null order by piece_number',[v])).rows.map(x=>x.piece_number),[11,12,13,14,15])
      for(const n of [-1,0,1.5,'NaN','Infinity',2147483648])await assert.rejects(adjust(p,v,'INCREASE',n),e=>e.code==='22023')
      await assert.rejects(adjust(p,v,'INCREASE',1,''),e=>e.code==='22023')
      await assert.rejects(adjust(p,uid,'INCREASE',1),e=>e.code==='22023')
      await assert.rejects(adjust(p,v,'DECREASE',100),e=>e.code==='22023')
      await assert.rejects(db.query('update public.inventory_adjustment_operations set reason=$1 where id=$2',['Other',r.operation_id]),e=>e.code==='42501')
      await assert.rejects(db.query('delete from public.inventory_adjustments where operation_id=$1',[r.operation_id]),e=>e.code==='42501')
      await assert.rejects(db.query('insert into public.inventory_units(product_id,variant_id,piece_number) values($1,$2,19)',[p.id,v]),e=>e.code==='42501')
      await adjust(p,v,'INCREASE',2);p=await fresh(p.id)
      await assert.rejects(adjust(p,v,'SET_EXACT',20),e=>e.code==='22023')
    })
  }
  // Isolated fault injection: ensure parent and first successful piece roll back.
  let fixture
  await caller('authenticated',uid,async()=>{fixture=await create('adjust-rollback',20)})
  const v=fixture.values[0].variant_id
  await db.exec(`create function public.fail_adjustment_test() returns trigger language plpgsql as $$ begin if new.product_id='${fixture.p.id}'::uuid and new.piece_number=3 then raise exception 'Injected adjustment failure'; end if; return new; end $$; create trigger fail_adjustment before insert on public.inventory_units for each row execute function public.fail_adjustment_test();`)
  await caller('authenticated',uid,()=>assert.rejects(adjust(fixture.p,v,'INCREASE',5),/Injected adjustment failure/))
  assert.equal((await db.query('select count(*)::int n from public.inventory_units where product_id=$1',[fixture.p.id])).rows[0].n,0)
  assert.equal((await db.query('select count(*)::int n from public.inventory_adjustment_operations where variant_id=$1',[v])).rows[0].n,0)
  await db.exec('drop trigger fail_adjustment on public.inventory_units')
  await caller('authenticated',uid,()=>adjust(fixture.p,v,'INCREASE',5))
  await db.exec(`update public.inventory_units set sold_at=now() where variant_id='${v}' and piece_number=5`)
  const p=await fresh(fixture.p.id)
  await caller('authenticated',uid,()=>adjust(p,v,'DECREASE',4))
  assert.equal((await db.query('select count(*)::int n from public.inventory_units where variant_id=$1 and sold_at is not null and withdrawn_at is null',[v])).rows[0].n,1)
  await assert.rejects(db.query('update public.inventory_adjustment_operations set reason=$1 where variant_id=$2',['Other',v]),/immutable/)
  await assert.rejects(db.query('update public.inventory_units set withdrawn_at=null where variant_id=$1 and withdrawn_at is not null',[v]),/cannot be reused/)
  let withdrawalFixture
  await caller('authenticated',uid,async()=>{withdrawalFixture=await create('withdrawal-rollback',100);await adjust(withdrawalFixture.p,withdrawalFixture.values[0].variant_id,'INCREASE',6)})
  const wv=withdrawalFixture.values[0].variant_id,wp=await fresh(withdrawalFixture.p.id)
  const snapshot=async()=>({units:(await db.query('select * from public.inventory_units where product_id=$1 order by piece_number',[wp.id])).rows,operations:(await db.query('select * from public.inventory_adjustment_operations where variant_id=$1 order by id',[wv])).rows,events:(await db.query('select a.* from public.inventory_adjustments a join public.inventory_units u on u.id=a.unit_id where u.product_id=$1 order by a.id',[wp.id])).rows})
  const before=await snapshot()
  await db.exec(`create function public.fail_withdrawal_test() returns trigger language plpgsql as $$ begin if new.product_id='${wp.id}'::uuid and new.piece_number=4 then raise exception 'Injected withdrawal failure'; end if; return new; end $$; create trigger fail_withdrawal before update on public.inventory_units for each row execute function public.fail_withdrawal_test();`)
  await caller('authenticated',uid,()=>assert.rejects(adjust(wp,wv,'DECREASE',6),/Injected withdrawal failure/))
  assert.deepEqual(await snapshot(),before)
  await db.exec('drop trigger fail_withdrawal on public.inventory_units')
  for(let n=0;n<26;n++)await caller('authenticated',uid,async()=>{await adjust(await fresh(wp.id),wv,'INCREASE',1)})
  const page1=(await db.query('select id from public.inventory_adjustment_operations where variant_id=$1 order by created_at desc,id desc limit 25 offset 0',[wv])).rows
  const page2=(await db.query('select id from public.inventory_adjustment_operations where variant_id=$1 order by created_at desc,id desc limit 25 offset 25',[wv])).rows
  assert.equal(page1.length,25);assert.equal(page2.length,2);assert.equal(new Set([...page1,...page2].map(o=>o.id)).size,27)
  await db.exec(`update private.user_roles set role='customer' where user_id='${uid}'`)
  await caller('authenticated',uid,async()=>{assert.equal((await query('select * from public.inventory_adjustment_operations')).length,0);assert.equal((await query('select * from public.inventory_adjustments')).length,0);await assert.rejects(adjust(wp,wv,'DECREASE',1),e=>e.code==='42501')})
  console.log('PASS withdrawal atomic rollback, history 25-row pagination, customer history RLS')
  console.log('PASS adjustments: admin/super_admin, anon/customer denial, increase/decrease/set exact, limits, deterministic withdrawal, sold protection, immutable history, audit linkage, notes, stale PT409, injected rollback')
} finally {await db.close()}

