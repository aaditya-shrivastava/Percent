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
  const ids = ['customer','admin','super_admin'].map((_,i)=>`10000000-0000-4000-a000-00000000000${i+1}`)
  for (const [i,role] of ['customer','admin','super_admin'].entries()) {
    await db.exec(`insert into auth.users(id) values('${ids[i]}'); update private.user_roles set role='${role}' where user_id='${ids[i]}'`)
  }
  for (const [i,role] of ['customer','admin','super_admin'].entries()) {
    await caller('authenticated',ids[i],async()=>{
      assert.equal((await query('select public.get_my_role() as role'))[0].role,role)
      await assert.rejects(()=>db.exec(`select public.get_my_role('${ids[(i+1)%3]}'::uuid)`),e=>e.code==='42883')
      await assert.rejects(()=>db.exec(`update private.user_roles set role='super_admin' where user_id='${ids[i]}'`),e=>e.code==='42501')
    })
  }
  for (const uid of [null,ids[1]]) await caller('anon',uid,async()=>await assert.rejects(()=>db.exec('select public.get_my_role()'),e=>e.code==='42501'))
  for (const uid of [null,'10000000-0000-4000-a000-000000000099']) await caller('authenticated',uid,async()=>assert.equal((await query('select public.get_my_role() as role'))[0].role,null))
  const [meta]=await query("select prosecdef,pronargs,proconfig from pg_proc where oid='public.get_my_role()'::regprocedure")
  assert.equal(meta.prosecdef,false);assert.equal(meta.pronargs,0);assert.ok(meta.proconfig.includes('search_path=""'))
  console.log('PASS role RPC: all three roles, null/no role, anon denial even with UID, no identity parameter, no role writes, invoker and fixed search path')
} finally { await db.close() }
