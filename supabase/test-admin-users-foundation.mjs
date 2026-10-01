import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const migration = await readFile(new URL('./migrations/20260930094650_admin_users_foundation.sql', import.meta.url), 'utf8')
const ids = {
  superAdmin: '00000000-0000-4000-8000-000000000001',
  admin: '00000000-0000-4000-8000-000000000002',
  customer: '00000000-0000-4000-8000-000000000003',
}

await db.exec(`
  create role anon;
  create role authenticated;
  create role service_role;
  create schema private;
  create table private.percent_principals(
    id uuid primary key,
    created_at timestamptz not null default now(),
    email text
  );
  create table public.profiles(
    id uuid primary key references private.percent_principals(id),
    display_name text not null,
    created_at timestamptz not null default now()
  );
  create table private.user_roles(
    user_id uuid primary key references private.percent_principals(id),
    role text not null check (role in ('customer','admin','super_admin')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  create table private.audit_logs(
    id uuid primary key default gen_random_uuid(),
    actor_id uuid,
    table_name text not null,
    operation text not null,
    row_id text,
    created_at timestamptz not null default now()
  );
  create function private.current_user_id() returns uuid
  language sql stable security definer set search_path=''
  as $$select nullif(current_setting('app.actor', true), '')::uuid$$;
  create function private.is_admin() returns boolean
  language sql stable security definer set search_path=''
  as $$select exists(select 1 from private.user_roles where user_id=private.current_user_id() and role in ('admin','super_admin'))$$;
`)
await db.exec(migration)
await db.exec(`
  insert into private.percent_principals(id,email) values
    ('${ids.superAdmin}','owner@percent.test'),
    ('${ids.admin}','staff@percent.test'),
    ('${ids.customer}','customer@percent.test');
  insert into public.profiles(id,display_name) values
    ('${ids.superAdmin}','Owner'),('${ids.admin}','Staff'),('${ids.customer}','Customer');
  insert into private.user_roles(user_id,role) values
    ('${ids.superAdmin}','super_admin'),('${ids.admin}','admin'),('${ids.customer}','customer');
`)

const actor = id => db.exec(`select set_config('app.actor','${id}',false)`)
const rpc = async (name, args = '') => (await db.query(`select public.${name}(${args}) value`)).rows[0].value

await actor(ids.superAdmin)
const all = await rpc('admin_list_staff')
assert.equal(all.count, 2)
assert.equal(all.admin_count, 1)
assert.equal(all.super_admin_count, 1)
assert.equal(all.can_manage_roles, true)
assert.deepEqual(all.items.map(item => item.role), ['super_admin', 'admin'])
assert.equal(all.items.some(item => item.id === ids.customer), false)

const filtered = await rpc('admin_list_staff', "'staff','admin'")
assert.equal(filtered.count, 1)
assert.equal(filtered.items[0].id, ids.admin)

const adminRevision = all.items.find(item => item.id === ids.admin).updated_at
const promoted = await rpc('admin_set_staff_role', `'${ids.admin}','super_admin','${adminRevision}'`)
assert.equal(promoted.role, 'super_admin')
await assert.rejects(
  rpc('admin_set_staff_role', `'${ids.admin}','admin','${adminRevision}'`),
  error => error.code === 'PT409'
)
const restored = await rpc('admin_set_staff_role', `'${ids.admin}','admin','${promoted.updated_at}'`)
assert.equal(restored.role, 'admin')

await assert.rejects(
  rpc('admin_set_staff_role', `'${ids.superAdmin}','admin','${all.items[0].updated_at}'`),
  error => error.code === '22023'
)

await actor(ids.admin)
assert.equal((await rpc('admin_list_staff')).can_manage_roles, false)
await assert.rejects(
  rpc('admin_set_staff_role', `'${ids.superAdmin}','admin','${all.items[0].updated_at}'`),
  error => error.code === '42501'
)

await actor(ids.customer)
await assert.rejects(rpc('admin_list_staff'), error => error.code === '42501')
assert.equal((await db.query('select count(*)::int count from private.audit_logs')).rows[0].count, 2)

console.log('PASS Admin Users foundation: staff-only reads, search/filter, internal Admin guard, Super Admin-only mutation, self-protection, PT409, and audit logging')
