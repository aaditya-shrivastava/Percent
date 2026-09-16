import fs from 'node:fs'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'

const db=new PGlite(),root=new URL('./',import.meta.url)
const admin='10000000-0000-4000-a000-000000000001',superAdmin='10000000-0000-4000-a000-000000000002',customer='10000000-0000-4000-a000-000000000003'
const orders=Array.from({length:4},(_,i)=>`20000000-0000-4000-a000-00000000000${i+1}`)
const caller=async(role,uid,run)=>{await db.exec(`set role ${role};select set_config('request.jwt.claim.sub','${uid??''}',false)`);try{return await run()}finally{await db.exec("reset role;select set_config('request.jwt.claim.sub','',false)")}}
const current=async id=>(await db.query('select * from public.orders where id=$1',[id])).rows[0]
const history=async id=>(await db.query('select * from public.order_lifecycle_history where order_id=$1 order by created_at,id',[id])).rows
const change=async(id,dimension,next,version,reason=null,note=null)=>(await db.query('select public.update_order_lifecycle($1,$2,$3,$4::timestamptz,$5,$6) result',[id,dimension,next,version,reason,note])).rows[0].result
try{
 await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key,bucket_id text,name text);alter table storage.objects enable row level security")
 await db.exec("create function storage.allow_any_operation(text[]) returns boolean language sql stable as $$select coalesce(current_setting('storage.operation',true)=any($1),false)$$")
 for(const name of fs.readdirSync(new URL('migrations/',root)).filter(value=>value.endsWith('.sql')).sort())await db.exec(fs.readFileSync(new URL('migrations/'+name,root),'utf8'))
 await db.exec(`insert into auth.users(id)values('${admin}'),('${superAdmin}'),('${customer}');update private.user_roles set role=case user_id when '${admin}' then 'admin' when '${superAdmin}' then 'super_admin' else 'customer' end;insert into public.orders(id,order_reference,user_id,subtotal_paise,total_paise)values ${orders.map((id,i)=>`('${id}','PCT-LOCAL-${i+1}','${customer}',129900,129900)`).join(',')}`)
 const first=await current(orders[0])
 await caller('anon',null,()=>assert.rejects(change(orders[0],'order_status','confirmed',first.updated_at),error=>error.code==='42501'))
 await caller('authenticated',customer,()=>assert.rejects(change(orders[0],'order_status','confirmed',first.updated_at),error=>error.code==='42501'))
 await caller('authenticated',admin,()=>assert.rejects(db.query('update public.orders set status=$1 where id=$2',['confirmed',orders[0]]),error=>error.code==='42501'))
 await caller('authenticated',admin,()=>assert.rejects(change(orders[0],'payment_status','paid',first.updated_at),error=>error.code==='22023'))
 await caller('authenticated',admin,()=>assert.rejects(change(orders[0],'order_status','completed',first.updated_at),error=>error.code==='22023'))
 await caller('authenticated',admin,()=>assert.rejects(change(orders[0],'order_status','cancelled',first.updated_at),error=>error.code==='22023'))
 await caller('authenticated',admin,()=>assert.rejects(change(orders[0],'order_status','confirmed','2000-01-01'),error=>error.code==='PT409'))
 const beforeInventory=(await db.query('select count(*)::int total from public.inventory_units')).rows[0].total
 await caller('authenticated',admin,()=>change(orders[0],'order_status','confirmed',first.updated_at,'Accepted for preparation','Internal review'))
 let state=await current(orders[0]);assert.equal(state.status,'confirmed');assert.equal(state.payment_status,'unpaid');assert.equal(state.fulfillment_status,'unfulfilled')
 let rows=await history(orders[0]);assert.equal(rows.length,1);assert.equal(rows[0].actor_id,admin);assert.equal(rows[0].previous_value,'pending');assert.equal(rows[0].next_value,'confirmed');assert.equal(rows[0].internal_note,'Internal review')
 await caller('authenticated',admin,()=>assert.rejects(change(orders[0],'fulfillment_status','shipped',state.updated_at),error=>error.code==='22023'))
 await caller('authenticated',superAdmin,()=>change(orders[0],'fulfillment_status','processing',state.updated_at,null,'Preparing internally'))
 state=await current(orders[0]);assert.equal(state.fulfillment_status,'processing');rows=await history(orders[0]);assert.equal(rows.length,2);assert.equal(rows.find(row=>row.dimension==='fulfillment_status').actor_id,superAdmin)
 await caller('authenticated',admin,()=>assert.rejects(change(orders[0],'order_status','completed',state.updated_at),error=>error.code==='22023'))
 await caller('authenticated',admin,()=>change(orders[0],'order_status','cancelled',state.updated_at,'Customer requested cancellation','Handle outside integrations'))
 state=await current(orders[0]);assert.equal(state.status,'cancelled');assert.equal(state.fulfillment_status,'cancelled');assert.equal(state.payment_status,'unpaid')
 rows=await history(orders[0]);assert.equal(rows.length,4);assert.equal(rows.filter(row=>row.next_value==='cancelled').length,2);assert.equal(rows.find(row=>row.dimension==='fulfillment_status'&&row.next_value==='cancelled').previous_value,'processing')
 await caller('authenticated',admin,()=>assert.rejects(change(orders[0],'order_status','confirmed',state.updated_at),error=>error.code==='22023'))
 await caller('authenticated',admin,()=>assert.rejects(db.query('update public.order_lifecycle_history set reason=$1 where order_id=$2',['rewritten',orders[0]]),error=>error.code==='42501'))
 await caller('authenticated',admin,()=>assert.rejects(db.query('delete from public.order_lifecycle_history where order_id=$1',[orders[0]]),error=>error.code==='42501'))
 await caller('anon',null,()=>assert.rejects(db.query('select * from public.order_lifecycle_history'),error=>error.code==='42501'))
 await caller('authenticated',customer,async()=>assert.equal((await db.query('select * from public.order_lifecycle_history')).rows.length,0))
 await caller('authenticated',admin,async()=>assert.equal((await db.query('select * from public.order_lifecycle_history')).rows.length,4))
 // A failed history insert must roll back the authoritative status write.
 await db.exec("create function private.reject_lifecycle_fixture() returns trigger language plpgsql as $$begin raise exception 'Injected history failure';end$$;create trigger reject_lifecycle_fixture before insert on public.order_lifecycle_history for each row execute function private.reject_lifecycle_fixture()")
 const second=await current(orders[1])
 await caller('authenticated',admin,()=>assert.rejects(change(orders[1],'order_status','confirmed',second.updated_at),error=>/Injected history failure/.test(error.message)))
 assert.equal((await current(orders[1])).status,'pending');assert.equal((await history(orders[1])).length,0)
 await db.exec('drop trigger reject_lifecycle_fixture on public.order_lifecycle_history;drop function private.reject_lifecycle_fixture()')
 const recovered=await current(orders[1])
 await caller('authenticated',admin,()=>change(orders[1],'order_status','confirmed',recovered.updated_at))
 await db.query("update public.orders set payment_status='paid',payment_provider='trusted_fixture',payment_reference='local_reference',fulfillment_status='delivered',shipping_provider='trusted_fixture',tracking_number='local_tracking',delivered_at=now() where id=$1",[orders[1]])
 const evidenced=await current(orders[1])
 await caller('authenticated',superAdmin,()=>change(orders[1],'order_status','completed',evidenced.updated_at))
 assert.equal((await current(orders[1])).status,'completed')
 assert.equal((await history(orders[1])).at(-1).next_value,'completed')
 const completed=await current(orders[1])
 await caller('authenticated',superAdmin,()=>assert.rejects(change(orders[1],'order_status','confirmed',completed.updated_at),error=>error.code==='22023'))
 // Cancellation with a pending payment cannot pretend to refund or settle it.
 await db.query("update public.orders set payment_status='pending' where id=$1",[orders[2]])
 const third=await current(orders[2])
 await caller('authenticated',admin,()=>assert.rejects(change(orders[2],'order_status','cancelled',third.updated_at,'Reason'),error=>error.code==='22023'))
 assert.equal((await current(orders[2])).status,'pending')
 const fourth=await current(orders[3])
 await caller('authenticated',superAdmin,()=>change(orders[3],'order_status','cancelled',fourth.updated_at,'No longer needed'))
 assert.equal((await current(orders[3])).fulfillment_status,'cancelled')
 assert.equal((await db.query('select count(*)::int total from public.inventory_units')).rows[0].total,beforeInventory)
 console.log('PASS lifecycle: actual transitions and evidence-gated completion, admin/super_admin, anon/customer denial, final locks, reason, stale PT409, payment/fulfillment isolation, append-only history, rollback, no inventory mutation')
}finally{await db.close()}
