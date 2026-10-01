import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const modulePath = process.env.PGLITE_MODULE_PATH
const { PGlite } = modulePath ? await import(pathToFileURL(modulePath).href) : await import('@electric-sql/pglite')

const migrationUrl = new URL('./migrations/20260930113030_product_options_foundation.sql', import.meta.url)
const migration = await readFile(migrationUrl, 'utf8')
// Replay only the relevant historical DDL, without executing unrelated systems.
const history = await readFile(new URL('./migrations/20260912112058_percent_foundation.sql', import.meta.url), 'utf8')
const historicalColours = history.match(/create table public\.colours \([\s\S]*?\n\);/)?.[0]
const historicalTouch = history.match(/create function private\.touch_updated_at\(\)[\s\S]*?end \$\$;/)?.[0]
if (!historicalColours || !historicalTouch) throw new Error('Required historical Product Options DDL not found')
const initialMigration = migration
let assertions = 0
let rejectionChecks = 0
const db = new PGlite()

const customer = '10000000-0000-4000-8000-000000000001'
const admin = '10000000-0000-4000-8000-000000000002'
const superAdmin = '10000000-0000-4000-8000-000000000003'
const colourIds = {
  stone: 'f185a422-499e-4c28-aec9-1a4d43cbf785',
  ivory: 'b7a948d8-5eb7-43ae-a10a-f50019c949fc',
  charcoal: 'bc3aa00e-a426-4586-a010-77e4efc9d408',
  burgundy: '2c703fc0-94c4-41c7-a7d4-74e9c1161ce6',
  taupe: 'fec79034-eba3-44fc-a9f4-c71ca0dd2403',
}

const assert = (condition, message) => {
  assertions++
  if (!condition) throw new Error(message)
}
const rows = async (sql, params = []) => (await db.query(sql, params)).rows
const scalar = async (sql, params = []) => Object.values((await rows(sql, params))[0])[0]
const expectCode = async (code, action, label) => {
  try {
    await action()
  } catch (error) {
    assert(error?.code === code, `${label}: expected ${code}, received ${error?.code ?? error}`)
    rejectionChecks++
    return
  }
  throw new Error(`${label}: expected ${code}`)
}
const setActor = async (id) => {
  await db.query("select set_config('percent.test_actor', $1, false)", [id ?? ''])
}

await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema private;

  create table private.user_roles (
    user_id uuid primary key,
    role text not null check (role in ('customer', 'admin', 'super_admin'))
  );
  insert into private.user_roles(user_id, role) values
    ('${customer}', 'customer'),
    ('${admin}', 'admin'),
    ('${superAdmin}', 'super_admin');

  create function private.current_user_id()
  returns uuid language sql stable security definer set search_path = '' as $$
    select nullif(current_setting('percent.test_actor', true), '')::uuid
  $$;
  create function private.is_admin()
  returns boolean language sql stable security definer set search_path = '' as $$
    select exists (
      select 1 from private.user_roles
      where user_id = private.current_user_id()
        and role in ('admin', 'super_admin')
    )
  $$;
  ${historicalTouch}
  ${historicalColours}
  create trigger touch_updated_at before update on public.colours
    for each row execute function private.touch_updated_at();
  alter table public.colours enable row level security;
  grant select on public.colours to anon, authenticated;
  grant insert, update, delete on public.colours to authenticated;
  grant all on public.colours to service_role;
  create policy public_colours on public.colours for select to anon, authenticated using (true);
  create policy admin_manage on public.colours for all to authenticated
    using ((select private.is_admin())) with check ((select private.is_admin()));

  insert into public.colours(id, slug, label, swatch_value) values
    ('${colourIds.stone}', 'stone', 'Stone', '#d8d0c8'),
    ('${colourIds.ivory}', 'ivory', 'Soft Ivory', '#f5f3ee'),
    ('${colourIds.charcoal}', 'charcoal', 'Charcoal', '#171717'),
    ('${colourIds.burgundy}', 'burgundy', 'Burgundy', '#6b2737'),
    ('${colourIds.taupe}', 'taupe', 'Taupe Grey', '#77736d');

  create table public.product_variants (
    id uuid primary key default gen_random_uuid(),
    product_id uuid not null,
    colour_id uuid not null references public.colours(id) on delete restrict,
    size text not null check (length(size) between 1 and 20),
    sku text not null unique,
    price_paise integer not null default 10000,
    enabled boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(product_id, colour_id, size)
  );
  create trigger touch_updated_at before update on public.product_variants
    for each row execute function private.touch_updated_at();
  alter table public.product_variants enable row level security;
  grant all on public.product_variants to service_role;

  insert into public.product_variants(product_id, colour_id, size, sku)
  select
    gen_random_uuid(),
    (array[
      '${colourIds.stone}'::uuid,
      '${colourIds.ivory}'::uuid,
      '${colourIds.charcoal}'::uuid,
      '${colourIds.burgundy}'::uuid,
      '${colourIds.taupe}'::uuid
    ])[1 + ((series - 1) % 5)],
    (array['S', 'M', 'L', 'XL'])[1 + ((series - 1) % 4)],
    'EXISTING-' || series
  from generate_series(1, 221) as series;
`)

const beforeVariants = await rows('select id, colour_id, size, sku, price_paise, enabled from public.product_variants order by id')
const beforeColours = await rows('select id, slug, label, swatch_value from public.colours order by id')

// This is the actual migration file, compiled and committed by PGlite's
// PostgreSQL engine against the hosted-shaped prerequisite schema above.
await db.exec(migration)
assert(await scalar("select count(*)::int from pg_trigger where tgrelid='public.colours'::regclass and tgname='touch_updated_at' and tgenabled='O'") === 1, 'missing or duplicate colour touch trigger')

assert(await scalar('select count(*)::int from public.product_variants') === 221, 'variant count changed')
assert(JSON.stringify(await rows('select id, colour_id, size, sku, price_paise, enabled from public.product_variants order by id')) === JSON.stringify(beforeVariants), 'variant rows changed')
assert(JSON.stringify(await rows('select id, slug, label, swatch_value from public.colours order by id')) === JSON.stringify(beforeColours), 'existing color identities changed')
assert(await scalar('select count(*)::int from public.colours where enabled') === 5, 'expected five enabled colors')
assert(await scalar('select count(*)::int from public.product_size_options where enabled') === 4, 'expected four enabled sizes')
assert(JSON.stringify((await rows('select distinct size from public.product_variants order by size')).map(row => row.size)) === JSON.stringify(['L', 'M', 'S', 'XL']), 'historical sizes changed')

for (const role of ['anon', 'authenticated']) {
  for (const privilege of ['INSERT', 'UPDATE', 'DELETE']) {
    assert(await scalar('select has_table_privilege($1, $2, $3)', [role, 'public.colours', privilege]) === false, `${role} retains ${privilege} on colors`)
    assert(await scalar('select has_table_privilege($1, $2, $3)', [role, 'public.product_size_options', privilege]) === false, `${role} retains ${privilege} on sizes`)
  }
}
for (const table of ['public.colours', 'public.product_size_options']) {
  assert(await scalar(`
    select not exists (
      select 1
      from pg_class as relation,
           aclexplode(coalesce(relation.relacl, acldefault('r', relation.relowner))) as privilege
      where relation.oid = $1::regclass
        and privilege.grantee = 0
        and privilege.privilege_type in ('INSERT', 'UPDATE', 'DELETE')
    )
  `, [table]) === true, `PUBLIC retains direct writes on ${table}`)
}
assert(await scalar("select has_table_privilege('anon', 'public.colours', 'SELECT')") === true, 'storefront color SELECT was removed')
assert(await scalar("select has_table_privilege('service_role', 'public.product_size_options', 'SELECT,INSERT,UPDATE,DELETE')") === true, 'service role size access missing')
assert(await scalar("select relrowsecurity from pg_class where oid = 'public.product_size_options'::regclass") === true, 'size RLS is disabled')

await setActor(null)
await expectCode('42501', () => db.exec('select public.admin_list_product_options()'), 'logged-out list')
await setActor(customer)
await expectCode('42501', () => db.exec('select public.admin_list_product_options()'), 'customer list')
await expectCode('42501', () => db.exec("select public.save_product_size_option(null, 'Denied', true, 9, null)"), 'customer mutation')
for (const actor of [admin, superAdmin]) {
  await setActor(actor)
  const document = await scalar('select public.admin_list_product_options()')
  assert(document.colors.length === 5 && document.sizes.length === 4, 'Admin list shape invalid')
}

// Each RPC is checked both at its internal authorization boundary (owner role)
// and through real anon/authenticated SQL privileges. Identity is a local shim;
// no external provider or browser state supplies authority in this test.
const rpcCalls = [
  'select public.admin_list_product_options()',
  "select public.save_product_color_option(null, 'AUTH PROBE', '#112233', true, 9, null)",
  "select public.save_product_size_option(null, 'AUTH PROBE', true, 9, null)",
  `select public.admin_reorder_product_options('color',
    (select array_agg(id order by id) from public.colours),
    (select array_agg(updated_at order by id) from public.colours))`,
]
for (const actor of [null, customer]) {
  await setActor(actor)
  for (const call of rpcCalls) await expectCode('42501', () => db.exec(call), `internal denial ${actor ?? 'logged out'}`)
}
await db.exec('set role anon')
for (const call of rpcCalls) await expectCode('42501', () => db.exec(call), 'anon privilege denial')
await db.exec('reset role; set role authenticated')
for (const actor of [null, customer]) {
  await setActor(actor)
  for (const call of rpcCalls) await expectCode('42501', () => db.exec(call), 'authenticated non-admin denial')
}
for (const actor of [admin, superAdmin]) {
  await setActor(actor)
  // Roll back probe changes so the compatibility fixture stays unchanged.
  await db.exec('begin')
  for (const call of rpcCalls) await db.exec(call)
  await db.exec('rollback')
}
await db.exec('reset role')
for (const name of ['admin_list_product_options','save_product_color_option','save_product_size_option','admin_reorder_product_options']) {
  const definition = await scalar('select pg_get_functiondef(oid) from pg_proc where pronamespace=\'public\'::regnamespace and proname=$1', [name])
  assert(definition.includes('private.current_user_id()') && definition.includes('private.is_admin()'), `${name}: internal authorization missing`)
  assert(!/localStorage|firebase|email/i.test(definition), `${name}: unexpected identity authority`)
}

await setActor(admin)
const color = await scalar("select public.save_product_color_option(null, 'TEST COLOR', '#112233', true, 5, null)")
const size = await scalar("select public.save_product_size_option(null, 'TEST SIZE', true, 4, null)")
await expectCode('23505', () => db.exec("select public.save_product_color_option(null, '  test color  ', '#112233', true, 6, null)"), 'color normalized uniqueness')
await expectCode('23505', () => db.exec("select public.save_product_size_option(null, '  test size  ', true, 5, null)"), 'size normalized uniqueness')
await expectCode('23505', () => db.exec("select public.save_product_color_option(null, 'BURGUNDY', '#112233', true, 6, null)"), 'existing color normalized uniqueness')
await expectCode('23505', () => db.exec("select public.save_product_size_option(null, ' m ', true, 5, null)"), 'existing size normalized uniqueness')

await db.exec(`insert into public.product_variants(product_id, colour_id, size, sku) values(gen_random_uuid(), '${color.id}', '${size.label}', 'NEW-ENABLED')`)
const preservedVariant = (await rows("select id, colour_id, size from public.product_variants where sku = 'NEW-ENABLED'"))[0]

let currentColor = await scalar('select public.save_product_color_option($1, $2, $3, $4, $5, $6)', [color.id, color.name, color.hex_code, false, color.sort_order, color.updated_at])
assert(currentColor.updated_at !== color.updated_at, 'colour save did not advance updated_at')
let currentSize = await scalar('select public.save_product_size_option($1, $2, $3, $4, $5)', [size.id, size.label, false, size.sort_order, size.updated_at])
await expectCode('22023', () => db.exec(`insert into public.product_variants(product_id, colour_id, size, sku) values(gen_random_uuid(), '${color.id}', 'S', 'NEW-DISABLED-COLOR')`), 'new disabled color')
await expectCode('22023', () => db.exec(`insert into public.product_variants(product_id, colour_id, size, sku) values(gen_random_uuid(), '${colourIds.stone}', '${size.label}', 'NEW-DISABLED-SIZE')`), 'new disabled size')
await expectCode('22023', () => db.exec(`insert into public.product_variants(product_id, colour_id, size, sku) values(gen_random_uuid(), '${colourIds.stone}', 'LEGACY', 'NEW-LEGACY-SIZE')`), 'new unmanaged size')
await db.exec("update public.product_variants set price_paise = price_paise + 1, colour_id = colour_id, size = size where sku = 'NEW-ENABLED'")
assert((await rows("select colour_id, size from public.product_variants where sku = 'NEW-ENABLED'"))[0].colour_id === preservedVariant.colour_id, 'unchanged disabled identity failed')

await expectCode('22023', () => db.exec(`update public.product_variants set colour_id = '${color.id}' where sku = 'EXISTING-1'`), 'change to disabled color')
await expectCode('22023', () => db.exec(`update public.product_variants set size = '${size.label}' where sku = 'EXISTING-1'`), 'change to disabled size')

const usedColor = await scalar(`select public.save_product_color_option('${colourIds.burgundy}', 'Burgundy', '#6B2737', true, 0, (select updated_at from public.colours where id='${colourIds.burgundy}'))`)
await expectCode('22023', () => db.exec(`select public.save_product_color_option('${colourIds.burgundy}', 'Wine', '#6B2737', true, 0, '${usedColor.updated_at}')`), 'used color rename')
const swatchChanged = await scalar(`select public.save_product_color_option('${colourIds.burgundy}', 'Burgundy', '#711D32', true, 0, '${usedColor.updated_at}')`)
assert(swatchChanged.hex_code === '#711D32', 'used color swatch edit failed')
assert(new Date(swatchChanged.updated_at) > new Date(usedColor.updated_at), 'color save did not advance updated_at')
const disabledUsed = await scalar(`select public.save_product_color_option('${colourIds.burgundy}', 'Burgundy', '#711D32', false, 0, '${swatchChanged.updated_at}')`)
assert(disabledUsed.enabled === false, 'used color disable failed')
await db.exec("update public.product_variants set price_paise = price_paise + 1, colour_id = colour_id where sku = 'EXISTING-4'")

const renamedSize = await scalar('select public.save_product_size_option($1, $2, $3, $4, $5)', [size.id, 'TEST SIZE RENAMED', false, size.sort_order, currentSize.updated_at])
assert(renamedSize.label === 'TEST SIZE RENAMED', 'unused size rename failed')
assert((await rows("select size from public.product_variants where sku = 'NEW-ENABLED'"))[0].size === 'TEST SIZE', 'size snapshot was rewritten')
await db.exec("update public.product_variants set price_paise=price_paise+1, size=size where sku='NEW-ENABLED'")
assert((await rows("select size from public.product_variants where sku='NEW-ENABLED'"))[0].size === 'TEST SIZE', 'unchanged legacy size rejected or rewritten')

const unusedColor = await scalar("select public.save_product_color_option(null, 'UNUSED COLOR', '#445566', true, 6, null)")
const renamedColor = await scalar('select public.save_product_color_option($1, $2, $3, $4, $5, $6)', [unusedColor.id, 'UNUSED RENAMED', unusedColor.hex_code, true, unusedColor.sort_order, unusedColor.updated_at])
assert(renamedColor.name === 'UNUSED RENAMED', 'unused color rename failed')

const optionDocument = await scalar('select public.admin_list_product_options()')
const colorIds = optionDocument.colors.map(item => item.id)
const colorVersions = optionDocument.colors.map(item => item.updated_at)
const sizeIds = optionDocument.sizes.map(item => item.id)
const sizeVersions = optionDocument.sizes.map(item => item.updated_at)
const reverse = values => [...values].reverse()

await expectCode('22023', () => db.query('select public.admin_reorder_product_options($1, $2::uuid[], $3::timestamptz[])', ['color', [colorIds[0], colorIds[0], ...colorIds.slice(2)], colorVersions]), 'duplicate reorder IDs')
await expectCode('PT409', () => db.query('select public.admin_reorder_product_options($1, $2::uuid[], $3::timestamptz[])', ['color', colorIds.slice(1), colorVersions.slice(1)]), 'missing reorder ID')
const staleVersions = [...colorVersions]
staleVersions[0] = '2000-01-01T00:00:00.000Z'
await expectCode('PT409', () => db.query('select public.admin_reorder_product_options($1, $2::uuid[], $3::timestamptz[])', ['color', colorIds, staleVersions]), 'stale reorder version')
await expectCode('22023', () => db.query('select public.admin_reorder_product_options($1, $2::uuid[], $3::timestamptz[])', ['size', [sizeIds[0], sizeIds[0], ...sizeIds.slice(2)], sizeVersions]), 'size duplicate reorder IDs')
await expectCode('PT409', () => db.query('select public.admin_reorder_product_options($1, $2::uuid[], $3::timestamptz[])', ['size', sizeIds.slice(1), sizeVersions.slice(1)]), 'size missing reorder ID')
await expectCode('PT409', () => db.query('select public.admin_reorder_product_options($1, $2::uuid[], $3::timestamptz[])', ['size', sizeIds, ['2000-01-01T00:00:00Z', ...sizeVersions.slice(1)]]), 'size stale reorder version')
await db.query('select public.admin_reorder_product_options($1, $2::uuid[], $3::timestamptz[])', ['color', reverse(colorIds), reverse(colorVersions)])
await db.query('select public.admin_reorder_product_options($1, $2::uuid[], $3::timestamptz[])', ['size', reverse(sizeIds), reverse(sizeVersions)])
assert((await rows('select id from public.colours order by sort_order')).map(row => row.id).join() === reverse(colorIds).join(), 'color reorder failed')
assert((await rows('select id from public.product_size_options order by sort_order')).map(row => row.id).join() === reverse(sizeIds).join(), 'size reorder failed')
for (let index = 0; index < colorIds.length; index += 1) {
  assert(await scalar('select updated_at > $2::timestamptz from public.colours where id = $1', [colorIds[index], colorVersions[index]]) === true, 'color reorder did not advance updated_at')
}
for (let index = 0; index < sizeIds.length; index += 1) {
  assert(await scalar('select updated_at > $2::timestamptz from public.product_size_options where id = $1', [sizeIds[index], sizeVersions[index]]) === true, 'size reorder did not advance updated_at')
}
assert(await scalar('select bool_and(updated_at > created_at) from public.product_size_options') === true, 'size reorder did not advance updated_at')
const reordered = await scalar('select public.admin_list_product_options()')
for (const [key, before] of [['colors', optionDocument.colors], ['sizes', optionDocument.sizes]]) {
  for (const item of reordered[key]) {
    const old = before.find(row => row.id === item.id)
    assert(item.updated_at !== old.updated_at, `${key}: reorder did not advance updated_at for ${item.id}`)
  }
}
for (const label of [' burgundy', 'BURGUNDY']) await expectCode('23505', () => db.query("select public.save_product_color_option(null,$1,'#112233',true,9,null)",[label]), 'Burgundy normalization')
for (const label of ['M', ' m']) await expectCode('23505', () => db.query('select public.save_product_size_option(null,$1,true,9,null)',[label]), 'M normalization')
const usedBeforeEnable = reordered.colors.find(row => row.id === colourIds.burgundy)
await db.query('select public.save_product_color_option($1,$2,$3,true,$4,$5)', [usedBeforeEnable.id,usedBeforeEnable.name,usedBeforeEnable.hex_code,usedBeforeEnable.sort_order,usedBeforeEnable.updated_at])
const afterVariants = await rows("select id,colour_id,size from product_variants where sku like 'EXISTING-%' order by id")
assert(JSON.stringify(afterVariants) === JSON.stringify(beforeVariants.map(({id,colour_id,size})=>({id,colour_id,size}))), 'existing variant references/snapshots rewritten by option mutations')

await expectCode('PT409', () => db.query('select public.save_product_color_option($1, $2, $3, $4, $5, $6)', [color.id, currentColor.name, currentColor.hex_code, currentColor.enabled, currentColor.sort_order, currentColor.updated_at]), 'stale color save')
await expectCode('PT409', () => db.query('select public.save_product_size_option($1, $2, $3, $4, $5)', [size.id, renamedSize.label, renamedSize.enabled, renamedSize.sort_order, renamedSize.updated_at]), 'stale size save')

assert(await scalar("select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like '%delete%product%option%'") === 0, 'delete option RPC exists')

assert(migration === initialMigration, 'migration changed during test')
const result = {
  migration_compiled: true,
  colors_after_migration: 5,
  sizes_after_migration: 4,
  existing_variants_preserved: 221,
  authorization: 'logged-out/customer denied; admin/super_admin allowed',
  guards: 'passed',
  concurrency: 'passed',
  direct_write_grants: 'revoked',
  colour_touch_trigger: 'existing historical now() trigger reused; save and reorder advance timestamp',
  assertions,
  rejection_checks: rejectionChecks,
  scope: 'Disposable PGlite; relevant historical colours/touch DDL and hosted-shaped variant prerequisites; no hosted writes',
}
console.log(JSON.stringify(result, null, 2))
await writeFile(new URL('../docs/backend/product-options-preflight-results.json', import.meta.url), JSON.stringify(result,null,2)+'\n')

await db.close()
