import fs from 'node:fs'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const ids = {
  customer: '10000000-0000-4000-a000-000000000001',
  admin: '10000000-0000-4000-a000-000000000002',
  superAdmin: '10000000-0000-4000-a000-000000000003',
  product: '20000000-0000-4000-a000-000000000001',
}

const as = async (role, uid, fn) => {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${uid ?? ''}',false)`)
  try { return await fn() }
  finally { await db.exec("reset role; select set_config('request.jwt.claim.sub','',false)") }
}

const setVisibility = (uid, reviewId, visible, expected) =>
  as('authenticated', uid, async () =>
    (await db.query(
      'select public.set_product_review_visibility($1,$2,$3) result',
      [reviewId, visible, expected],
    )).rows[0].result)

const publicReviewCount = (reviewId) => as('anon', null, async () =>
  Number((await db.query('select count(*) count from public.product_reviews where id=$1', [reviewId])).rows[0].count))

try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    create schema auth;
    create schema private;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable
      as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;

    create table private.user_roles(user_id uuid primary key, role text not null);
    create function private.is_admin() returns boolean language sql stable security definer set search_path=''
      as $$select exists(select 1 from private.user_roles where user_id=auth.uid() and role in ('admin','super_admin'))$$;
    grant usage on schema private to authenticated;
    grant execute on function private.is_admin() to authenticated;

    create table public.product_reviews(
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null,
      product_id uuid not null,
      rating smallint not null,
      title text,
      body text not null,
      customer_name text not null,
      status text not null default 'pending' check(status in ('pending','approved','rejected')),
      created_at timestamptz not null default clock_timestamp(),
      updated_at timestamptz not null default clock_timestamp()
    );
    create function private.touch_updated_at() returns trigger language plpgsql set search_path=''
      as $$begin new.updated_at=clock_timestamp(); return new; end$$;
    create trigger touch_updated_at before update on public.product_reviews
      for each row execute function private.touch_updated_at();
    alter table public.product_reviews enable row level security;
    grant select on public.product_reviews to anon, authenticated;
    create policy public_shown on public.product_reviews for select to anon using(status='approved');
    create policy admin_read on public.product_reviews for select to authenticated using((select private.is_admin()));
  `)

  for (const [role, id] of Object.entries({ customer: ids.customer, admin: ids.admin, super_admin: ids.superAdmin })) {
    await db.query('insert into auth.users(id) values($1)', [id])
    await db.query('insert into private.user_roles(user_id,role) values($1,$2)', [id, role])
  }

  await db.exec(fs.readFileSync(new URL('migrations/20260921170000_admin_review_moderation.sql', import.meta.url), 'utf8'))
  await db.exec(fs.readFileSync(new URL('migrations/20260921180000_admin_review_visibility.sql', import.meta.url), 'utf8'))

  const original = (await db.query(`
    insert into public.product_reviews(user_id,product_id,rating,title,body,customer_name)
    values($1,$2,4,'Original title','Original body','Original customer') returning *
  `, [ids.customer, ids.product])).rows[0]

  assert.equal(await publicReviewCount(original.id), 0, 'pending review must be public-invisible')
  const pendingHidden = await setVisibility(ids.admin, original.id, false, original.updated_at)
  assert.deepEqual({ status: pendingHidden.status, visible: pendingHidden.visible, changed: pendingHidden.changed },
    { status: 'pending', visible: false, changed: false })

  await assert.rejects(setVisibility(ids.customer, original.id, true, original.updated_at), error => error.code === '42501')
  await as('anon', null, () => assert.rejects(
    db.query('select public.set_product_review_visibility($1,$2,$3)', [original.id, true, original.updated_at]),
    error => error.code === '42501',
  ))

  const shown = await setVisibility(ids.admin, original.id, true, original.updated_at)
  assert.deepEqual({ status: shown.status, visible: shown.visible, changed: shown.changed },
    { status: 'approved', visible: true, changed: true })
  assert.equal(await publicReviewCount(original.id), 1, 'shown review must be publicly visible')

  const alreadyShown = await setVisibility(ids.admin, original.id, true, shown.updated_at)
  assert.equal(alreadyShown.changed, false, 'same-state show must be a no-op')
  await assert.rejects(setVisibility(ids.admin, original.id, false, original.updated_at), error => error.code === 'PT409')

  const hidden = await setVisibility(ids.superAdmin, original.id, false, shown.updated_at)
  assert.deepEqual({ status: hidden.status, visible: hidden.visible, changed: hidden.changed },
    { status: 'rejected', visible: false, changed: true })
  assert.equal(await publicReviewCount(original.id), 0, 'hidden review must be public-invisible')

  const reshown = await setVisibility(ids.superAdmin, original.id, true, hidden.updated_at)
  assert.deepEqual({ status: reshown.status, visible: reshown.visible, changed: reshown.changed },
    { status: 'approved', visible: true, changed: true })
  assert.equal(await publicReviewCount(original.id), 1, 're-shown review must be publicly visible')

  await as('authenticated', ids.customer, () => assert.rejects(
    db.query("update public.product_reviews set status='pending' where id=$1", [original.id]),
    error => error.code === '42501',
  ))
  const oldRpc = (await db.query("select to_regprocedure('public.moderate_product_review(uuid,text,timestamptz)') rpc")).rows[0].rpc
  assert.equal(oldRpc, null, 'old generic status RPC must be removed')

  const final = (await db.query('select * from public.product_reviews where id=$1', [original.id])).rows[0]
  for (const field of ['user_id', 'product_id', 'rating', 'title', 'body', 'customer_name', 'created_at']) {
    assert.deepEqual(final[field], original[field], `${field} must remain unchanged`)
  }

  const history = (await db.query(`
    select actor_id,previous_status,next_status from private.review_moderation_history
    where review_id=$1 order by created_at,id
  `, [original.id])).rows
  assert.deepEqual(history.map(row => [row.actor_id, row.previous_status, row.next_status]), [
    [ids.admin, 'pending', 'approved'],
    [ids.superAdmin, 'approved', 'rejected'],
    [ids.superAdmin, 'rejected', 'approved'],
  ])
  await assert.rejects(db.query("update private.review_moderation_history set next_status='rejected' where review_id=$1", [original.id]), error => error.code === '42501')
  await assert.rejects(db.query('delete from private.review_moderation_history where review_id=$1', [original.id]), error => error.code === '42501')

  const grants = (await db.query(`
    select
      has_function_privilege('anon','public.set_product_review_visibility(uuid,boolean,timestamptz)','execute') anon,
      has_function_privilege('authenticated','public.set_product_review_visibility(uuid,boolean,timestamptz)','execute') authenticated,
      has_function_privilege('public','public.set_product_review_visibility(uuid,boolean,timestamptz)','execute') public
  `)).rows[0]
  assert.deepEqual(grants, { anon: false, authenticated: true, public: false })

  console.log('PASS Phase 6 visibility: pending→show, shown→hide, hidden→show, no-op history, PT409, role denial, public visibility, protected content, and immutable history verified')
} finally {
  await db.close()
}
