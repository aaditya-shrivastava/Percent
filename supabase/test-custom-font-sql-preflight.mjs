import fs from 'node:fs'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'

const root = new URL('./', import.meta.url)
const read = path => fs.readFileSync(new URL(path, root), 'utf8')
const hosted = JSON.parse(read('fixtures/custom-font-hosted-preflight.json'))
const migration = read('migrations/20261002152812_website_custom_font_library.sql')
const db = new PGlite()
const results = []
const run = async (name, fn) => { await fn(); results.push(name); console.log('PASS ' + name) }
const rows = async (sql, args = []) => (await db.query(sql, args)).rows
const one = async (sql, args = []) => (await rows(sql, args))[0]
const json = async (sql, args = []) => (await one(sql, args)).value
const denied = async (fn, code) => assert.rejects(fn, e => !code || e.code === code)
const auth = async (role = 'admin') => {
  const claims = role === 'anonymous' ? {} : { iss: 'https://securetoken.google.com/percent-63d3e', aud: 'percent-63d3e', role: 'authenticated', sub: 'font-qa-' + (role === 'anonymous-token' ? 'admin' : role), firebase: { sign_in_provider: role === 'anonymous-token' ? 'anonymous' : 'password' } }
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify(claims)])
}
const asCaller = async (role, fn) => {
  await auth(role)
  await db.exec(role === 'anonymous' ? 'set role anon' : 'set role authenticated')
  try { return await fn() } finally { await db.exec('reset role') }
}
const editor = () => asCaller('admin', () => json('select public.get_website_editor() value'))
const settingsContent = s => Object.fromEntries(['navbar_items', 'branding', 'colors', 'typography', 'social_links'].map(k => [k, s[k]]))
const saveGlobal = (content, version, role = 'admin') => asCaller(role, () => json('select public.save_website_global_settings($1,$2) value', [content, version]))
const globalReference = async reference => { const doc = await editor(); const content = settingsContent(doc.settings); content.typography.heading_family = reference; return saveGlobal(content, doc.updated_at) }
const functions = () => rows(`select p.oid,p.oid::regprocedure::text signature, pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.prosecdef,p.provolatile,p.proconfig,pg_get_functiondef(p.oid) definition from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('get_storefront_content','get_website_editor','save_website_global_settings') order by p.proname`)
const deps = ids => rows(`select d.*,pg_describe_object(d.classid,d.objid,d.objsubid) dependent,pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid) referenced from pg_depend d where (d.classid='pg_proc'::regclass and d.objid=any($1::oid[])) or (d.refclassid='pg_proc'::regclass and d.refobjid=any($1::oid[])) order by d.classid,d.objid,d.refclassid,d.refobjid`, [ids])
const tableNames = () => rows("select schemaname,tablename from pg_tables where schemaname in ('public','private','auth','storage') order by schemaname,tablename")
const snapshot = async names => {
  const result = {}
  for (const { schemaname, tablename } of names) result[schemaname + '.' + tablename] = await rows(`select to_jsonb(t) value from "${schemaname}"."${tablename}" t order by to_jsonb(t)::text`)
  return result
}
const familyId = '80000000-0000-4000-a000-000000000001'
const secondId = '80000000-0000-4000-a000-000000000002'
const face = (id, weight = 400, style = 'normal', hash = 'a'.repeat(64)) => ({ weight, style, storage_path: `fonts/${id}/${weight}-${style}-${hash}.woff2`, mime_type: 'font/woff2', byte_size: 1000, sha256: hash })
const f400 = face(familyId), f700 = face(familyId, 700, 'normal', 'b'.repeat(64)), italic = face(familyId, 400, 'italic', 'c'.repeat(64))
const addObjects = async faces => { for (const f of faces) await db.query("insert into storage.objects(bucket_id,name,metadata) values('percent-website-media',$1,$2) on conflict(bucket_id,name) do nothing", [f.storage_path, { mimetype: f.mime_type, size: f.byte_size }]) }
const familyVersion = async id => (await one('select updated_at from public.website_font_families where id=$1', [id]))?.updated_at ?? null
const saveFamily = async ({ id = familyId, name = 'Font QA', enabled = true, license = true, faces = [f400, f700], version, role = 'admin' } = {}) => {
  const expected = version === undefined ? await familyVersion(id) : version
  return asCaller(role, () => json('select public.save_website_font_family($1,$2,$3,$4,$5,$6) value', [id, name, enabled, license, faces, expected]))
}
const deleteFamily = async (id = familyId, version) => asCaller('admin', () => json('select public.delete_website_font_family($1,$2) value', [id, version]))

try {
  await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;
    grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;
    create schema storage;create function storage.allow_any_operation(text[]) returns boolean language sql immutable as $$select true$$;
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb,unique(bucket_id,name));alter table storage.objects enable row level security;
    create table storage.buckets(id text primary key,name text not null,public boolean,file_size_limit bigint,allowed_mime_types text[]);`)
  const history = fs.readdirSync(new URL('migrations', root)).filter(f => f.endsWith('.sql') && f <= '20260930055929_global_website_editor_controls.sql' && !f.includes('username')).sort()
  for (const file of history) {
    try { await db.exec(read('migrations/' + file)) } catch (e) { throw new Error(file + ': ' + e.message) }
    if (file === '20260912112058_percent_foundation.sql') await db.exec("insert into auth.users(id,email) values('10000000-0000-4000-a000-000000000001','preflight@example.test');update private.user_roles set role='super_admin' where user_id='10000000-0000-4000-a000-000000000001';")
  }
  await db.exec(read('migrations/20261002022344_customer_session_anonymous_denial.sql'))
  for (const role of ['admin', 'super_admin', 'customer']) {
    await auth(role)
    const { id } = await one('select public.provision_my_percent_identity() id')
    await db.query('update private.user_roles set role=$1 where user_id=$2', [role, id])
  }
  const s = hosted.audit.settings
  await db.query(`update public.website_settings set footer_tagline=$1,footer_description=$2,navbar_items=$3,branding=$4,colors=$5,typography=$6,social_links=$7 where id='storefront'`, [s.footer_tagline, s.footer_description, s.navbar_items, s.branding, s.colors, s.typography, s.social_links])
  const beforeFunctions = await functions(), beforeDeps = await deps(beforeFunctions.map(f => f.oid)), names = await tableNames(), beforeData = await snapshot(names)
  const beforeOtherRpc = await rows("select oid,proacl::text acl from pg_proc where pronamespace='public'::regnamespace and proname not in ('get_storefront_content','get_website_editor','save_website_global_settings') order by oid")
  const bucketBefore = await one("select * from storage.buckets where id='percent-website-media'")
  const policyBefore = await rows('select * from pg_policies order by schemaname,tablename,policyname')
  await run('Historical migrations produce the exact hosted RPC bodies/properties/ACLs', async () => {
    for (const f of beforeFunctions) {
      const h = hosted.functions.find(x => x.signature === f.signature)
      assert(h)
      assert.equal(f.definition.replaceAll('\r', ''), h.definition.replaceAll('\r', ''))
      assert(migration.includes(crypto.createHash('md5').update(h.definition.replaceAll('\r', '')).digest('hex')))
      assert.equal(f.owner, h.owner);assert.equal(f.acl, h.acl);assert.equal(f.prosecdef, h.security_definer);assert.equal(f.provolatile, h.volatility);assert.deepEqual(f.proconfig, h.config)
    }
    assert(!hosted.audit.font_tables_present)
    assert.equal(hosted.audit.bucket.public, false)
    assert.deepEqual(bucketBefore.allowed_mime_types, hosted.audit.bucket.allowed_mime_types)
    assert.equal(Number(bucketBefore.file_size_limit), hosted.audit.bucket.file_size_limit)
    // The original three-name SQL registry is exercised below. The completed
    // expanded editor is validated separately by test-website-font-ui.mjs.
  })
  await run('Failure after MIME update, RPC moves and final DDL rolls back everything', async () => {
    const markers = ['create table public.website_font_families', 'create function public.get_storefront_content()', 'commit;']
    for (const marker of markers) {
      const broken = migration.replace(marker, 'select 1/0;\n' + marker)
      await denied(() => db.exec(broken))
      await db.exec('rollback')
      assert.deepEqual(await functions(), beforeFunctions)
      assert.deepEqual(await snapshot(names), beforeData)
      assert.equal((await one("select to_regclass('public.website_font_families') value")).value, null)
      assert.equal((await one("select to_regprocedure('private.get_storefront_content_before_fonts()') value")).value, null)
      assert.deepEqual(await tableNames(), names)
      assert.equal((await one("select count(*)::int count from pg_proc where pronamespace='private'::regnamespace and proname like 'website_font_%'")).count, 0)
      assert.deepEqual(await rows('select * from pg_policies order by schemaname,tablename,policyname'), policyBefore)
    }
  })
  await run('Unaudited body, owner, SECURITY DEFINER, volatility, search_path, grants and dependencies fail closed', async () => {
    const edits = [
      "create or replace function public.get_storefront_content() returns jsonb language sql stable security definer set search_path='' as $$ select '{}'::jsonb $$",
      'alter function public.get_website_editor() owner to service_role',
      'alter function public.get_website_editor() security invoker',
      'alter function public.get_website_editor() volatile',
      'alter function public.get_website_editor() set search_path=public',
      'grant execute on function public.get_website_editor() to anon',
      'create view public.font_dependency_probe as select public.get_storefront_content() value',
      'create function public.get_storefront_content(text) returns jsonb language sql as $$select null::jsonb$$',
    ]
    for (const edit of edits) {
      await db.exec('begin;' + edit + ';')
      await denied(() => db.exec(migration.replace(/^begin;/, '')))
      await db.exec('rollback')
      assert.deepEqual(await functions(), beforeFunctions)
    }
  })
  await run('Public bucket, changed size limit and changed MIME allowlist fail closed', async () => {
    for (const edit of ["public=true", "file_size_limit=20971520", "allowed_mime_types=array['image/png']"]) {
      await db.exec("begin;update storage.buckets set " + edit + " where id='percent-website-media';")
      await denied(() => db.exec(migration.replace(/^begin;/, '')))
      await db.exec('rollback')
      assert.deepEqual(await snapshot(names), beforeData)
    }
  })
  await run('Full migration compiles and executes locally', () => db.exec(migration))
  await run('Zero existing content/auth/media changes; only bucket MIME appended; no font seeds', async () => {
    const afterData = await snapshot(names)
    const expected = structuredClone(beforeData)
    expected['storage.buckets'].find(x => x.value.id === 'percent-website-media').value.allowed_mime_types.push('font/woff2')
    assert.deepEqual(afterData, expected)
    assert.equal((await one('select count(*)::int count from public.website_font_families')).count, 0)
    const bucket = await one("select * from storage.buckets where id='percent-website-media'")
    assert.deepEqual(bucket, { ...bucketBefore, allowed_mime_types: [...bucketBefore.allowed_mime_types, 'font/woff2'] })
    assert.deepEqual(await rows('select * from pg_policies order by schemaname,tablename,policyname'), policyBefore)
  })
  await run('Moved functions preserve OIDs/body/properties; new public signatures; no unrelated RPC drift', async () => {
    for (const f of beforeFunctions) {
      const moved = await one('select p.oid,pg_get_userbyid(p.proowner) owner,p.prosecdef,p.provolatile,p.proconfig,p.prosrc,pg_get_function_identity_arguments(p.oid) arguments from pg_proc p where oid=$1', [f.oid])
      assert.equal(moved.owner, f.owner);assert.equal(moved.prosecdef, f.prosecdef);assert.equal(moved.provolatile, f.provolatile);assert.deepEqual(moved.proconfig, f.proconfig)
      assert.equal(moved.prosrc.replaceAll('\r', ''), f.definition.split('$function$')[1].replaceAll('\r', ''))
    }
    const after = await functions()
    assert.deepEqual(after.map(f => f.signature), beforeFunctions.map(f => f.signature))
    const afterDeps = await deps(beforeFunctions.map(f => f.oid))
    const privateOid = (await one("select 'private'::regnamespace::oid value")).value
    const namespaceCatalog = (await one("select 'pg_namespace'::regclass::oid value")).value
    const normalize = list => list.map(({ dependent, referenced, ...d }) => { assert(dependent && referenced); return d })
    const expectedDeps = normalize(beforeDeps).map(d => d.refclassid === namespaceCatalog ? { ...d, refobjid: privateOid } : d)
    assert.deepEqual(normalize(afterDeps), expectedDeps)
    for (const previous of beforeOtherRpc) assert.deepEqual(await one('select oid,proacl::text acl from pg_proc where oid=$1', [previous.oid]), previous)
  })
  await run('Existing Website content save RPC still resolves the recreated editor wrapper', async () => {
    const doc = await editor()
    const content = { settings: { footer_tagline: doc.settings.footer_tagline, footer_description: doc.settings.footer_description }, sections: doc.sections, banners: doc.banners }
    const saved = await asCaller('admin', () => json('select public.save_website_content($1,$2) value', [content, doc.updated_at]))
    assert.deepEqual(saved.settings, doc.settings)
    assert.deepEqual(saved.sections, doc.sections)
    assert.deepEqual(saved.banners, doc.banners)
    assert.deepEqual(saved.font_families, [])
  })
  await run('Existing typography and each original built-in save with non-type settings unchanged; unbundled fonts denied', async () => {
    const initial = await editor()
    const unchanged = await saveGlobal(settingsContent(initial.settings), initial.updated_at)
    assert.deepEqual(unchanged.settings, initial.settings)
    for (const font of ['Inter', 'Georgia', 'system-ui']) {
      const doc = await globalReference(font)
      assert.equal(doc.settings.typography.heading_family, font)
      const { typography: ignored, ...rest } = doc.settings
      const { typography: original, ...initialRest } = initial.settings
      assert(ignored && original);assert.deepEqual(rest, initialRest)
    }
    for (const font of ['Arial','Manrope','DM Sans','Montserrat','Outfit','Space Grotesk','Playfair Display','Cormorant Garamond','Lora','Libre Baskerville']) await denied(() => globalReference(font), '22023')
    await globalReference('Inter')
    await denied(() => globalReference('custom:' + familyId), '22023')
    const doc = await editor()
    await denied(() => saveGlobal(settingsContent(doc.settings), '2000-01-01T00:00:00Z'), 'PT409')
  })
  await addObjects([f400, f700, italic])
  await run('Admin saves multiple weights and italic; exact repeat is idempotent', async () => {
    await saveFamily({ faces: [f400, f700, italic] })
    const original = await rows('select asset_id,storage_path from public.website_font_faces order by storage_path')
    await saveFamily({ faces: [f400, f700, italic] })
    assert.deepEqual(await rows('select asset_id,storage_path from public.website_font_faces order by storage_path'), original)
  })
  await run('Duplicate normalized names including casing and whitespace are denied', async () => {
    const faces = [face(secondId)];await addObjects(faces)
    for (const name of ['Font QA', 'font qa', '  FONT   QA  ']) await denied(() => saveFamily({ id: secondId, name, faces }), '23505')
  })
  await run('All nine allowed weights plus italic persist, and unused faces/families can be removed', async () => {
    const faces = [100,200,300,400,500,600,700,800,900].map(weight => face(secondId, weight, 'normal', String(weight / 100).repeat(64)))
    faces.push(face(secondId, 400, 'italic', 'c'.repeat(64)))
    await addObjects(faces)
    await saveFamily({ id: secondId, name: 'Weight Matrix', faces })
    assert.equal((await one('select count(*)::int count from public.website_font_faces where family_id=$1', [secondId])).count, 10)
    await saveFamily({ id: secondId, name: 'Weight Matrix', faces: [faces[0]] })
    assert.equal((await one('select count(*)::int count from public.website_font_faces where family_id=$1', [secondId])).count, 1)
    const beforeAsset = (await one('select asset_id from public.website_font_faces where family_id=$1', [secondId])).asset_id
    const replacement = face(secondId, 100, 'normal', 'f'.repeat(64))
    await addObjects([replacement])
    await saveFamily({ id: secondId, name: 'Weight Matrix', faces: [replacement] })
    assert.notEqual((await one('select asset_id from public.website_font_faces where family_id=$1', [secondId])).asset_id, beforeAsset)
    await deleteFamily(secondId, await familyVersion(secondId))
  })
  await run('Invalid face types/weights/styles/MIME/size/SHA/path/storage/duplicates/license are denied', async () => {
    const bad = [ { ...f400, weight: 450 }, { ...f400, weight: '400' }, { ...f400, style: 'oblique' }, { ...f400, mime_type: 'image/png' }, { ...f400, byte_size: 2097153 }, { ...f400, byte_size: 0 }, { ...f400, sha256: 'bad' }, { ...f400, storage_path: '../escape.woff2' }, face(familyId, 500, 'normal', 'd'.repeat(64)) ]
    for (const f of bad) await denied(() => saveFamily({ faces: [f] }), '22023')
    await denied(() => saveFamily({ faces: [f400, f400] }), '22023')
    await denied(() => saveFamily({ license: false }), '22023')
    for (const faces of [[], null, {}, [null], [true]]) await denied(() => saveFamily({ faces }), '22023')
    await denied(() => saveFamily({ version: '2000-01-01T00:00:00Z' }), 'PT409')
  })
  await run('Customer/anonymous editor, global save, font save and delete denied; Super Admin allowed', async () => {
    const doc = await editor(), version = await familyVersion(familyId)
    for (const role of ['customer', 'anonymous', 'anonymous-token']) {
      await denied(() => asCaller(role, () => db.query('select public.get_website_editor()')), '42501')
      await denied(() => saveGlobal(settingsContent(doc.settings), doc.updated_at, role), '42501')
      await denied(() => saveFamily({ role }), '42501')
      await denied(() => asCaller(role, () => db.query('select public.delete_website_font_family($1,$2)', [familyId, version])), '42501')
    }
    await saveFamily({ role: 'super_admin', faces: [f400, f700, italic] })
  })
  await run('Active font cannot disable/delete/remove face; stable-ID rename and added face allowed', async () => {
    await globalReference('custom:' + familyId)
    await denied(() => saveFamily({ enabled: false, faces: [f400, f700, italic] }), '22023')
    await denied(async () => deleteFamily(familyId, await familyVersion(familyId)), '22023')
    await denied(() => saveFamily({ faces: [f400] }), '22023')
    const additional = face(familyId, 600, 'normal', 'd'.repeat(64))
    await addObjects([additional])
    await saveFamily({ faces: [f400, f700, italic, additional] })
    assert.equal((await one('select count(*)::int count from public.website_font_faces where family_id=$1', [familyId])).count, 4)
    const replaced = face(familyId, 400, 'normal', 'e'.repeat(64))
    await addObjects([replaced])
    await denied(() => saveFamily({ faces: [replaced, f700, italic, additional] }), '22023')
    const ids = await rows('select asset_id from public.website_font_faces order by asset_id')
    await saveFamily({ name: 'Renamed Font QA', faces: [f400, f700, italic, additional] })
    assert.deepEqual(await rows('select asset_id from public.website_font_faces order by asset_id'), ids)
    assert.equal((await editor()).settings.typography.heading_family, 'custom:' + familyId)
  })
  await run('Public payload has only IDs/name/weight/style; Admin retains management details', async () => {
    const pub = await asCaller('anonymous', () => json('select public.get_storefront_content() value'))
    assert.equal(pub.font_families.length, 1)
    const family = pub.font_families[0]
    assert.deepEqual(Object.keys(family).sort(), ['faces', 'family_name', 'id'])
    for (const f of family.faces) assert.deepEqual(Object.keys(f).sort(), ['asset_id', 'style', 'weight'])
    const admin = (await editor()).font_families[0]
    for (const key of ['enabled', 'in_use', 'created_at', 'updated_at']) assert(Object.hasOwn(admin, key))
    for (const key of ['storage_path', 'mime_type', 'byte_size', 'sha256', 'asset_id']) assert(Object.hasOwn(admin.faces[0], key))
  })
  await run('Missing Storage object blocks typography save; unused families disable/delete safely', async () => {
    await db.query('delete from storage.objects where name=$1', [f700.storage_path])
    await denied(() => globalReference('custom:' + familyId), '22023')
    await addObjects([f700]);await globalReference('Inter')
    await saveFamily({ enabled: false, faces: [f400, f700, italic] })
    await denied(() => globalReference('custom:' + familyId), '22023')
    assert.deepEqual((await asCaller('anonymous', () => json('select public.get_storefront_content() value'))).font_families, [])
    const result = await deleteFamily(familyId, await familyVersion(familyId))
    assert.equal(result.removed, true);assert.equal(result.cleanup_paths.length, 3)
    await denied(() => globalReference('custom:' + familyId), '22023')
  })
  await run('Final grants/RLS prohibit direct browser writes and private helper/legacy execution', async () => {
    const rpcs = await rows(`select n.nspname,p.proname,p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname in ('get_storefront_content','get_website_editor','save_website_global_settings','save_website_font_family','delete_website_font_family')`)
    for (const f of rpcs) {
      const rights = await one("select has_function_privilege('anon',$1,'EXECUTE') anon,has_function_privilege('authenticated',$1,'EXECUTE') authenticated", [f.signature])
      assert.equal(rights.anon, f.proname === 'get_storefront_content');assert(rights.authenticated)
    }
    const privateFunctions = await rows("select oid from pg_proc where pronamespace='private'::regnamespace and (proname like 'website_font_%' or proname like '%_before_fonts')")
    for (const f of privateFunctions) for (const role of ['anon', 'authenticated', 'service_role']) assert.equal((await one('select has_function_privilege($1,$2::oid,\'EXECUTE\') value', [role, f.oid])).value, false)
    for (const table of ['website_font_families', 'website_font_faces']) {
      assert.equal((await one('select relrowsecurity value from pg_class where oid=$1::regclass', ['public.' + table])).value, true)
      for (const role of ['anon', 'authenticated', 'service_role']) for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'SELECT']) assert.equal((await one('select has_table_privilege($1,$2,$3) value', [role, 'public.' + table, privilege])).value, false)
      for (const role of ['customer', 'admin', 'anonymous']) await denied(() => asCaller(role, () => db.query('delete from public.' + table)), '42501')
    }
  })
  await run('Indexes cover normalized-name, family/face and opaque asset lookup without speculative live-reference index', async () => {
    const indexes = await rows("select tablename,indexdef from pg_indexes where tablename in ('website_font_families','website_font_faces')")
    assert(indexes.some(i => i.indexdef.includes('(normalized_name)')))
    assert(indexes.some(i => i.indexdef.includes('(family_id, weight, style)')))
    assert(indexes.some(i => i.indexdef.includes('(asset_id)')))
    assert(indexes.every(i => i.indexdef.includes('UNIQUE INDEX')))
  })
  if (process.env.PERCENT_FONT_REGISTRY_MIGRATION) {
    await run('Expanded registry compiles; only built-in acceptance changes; saved data, custom checks, OIDs and grants preserved', async () => {
      const followup = read('migrations/' + process.env.PERCENT_FONT_REGISTRY_MIGRATION)
      const tables = await tableNames()
      const before = await snapshot(tables)
      const properties = await rows("select oid,proacl::text,prosecdef,provolatile,proconfig from pg_proc where oid='private.website_font_reference_valid(text)'::regprocedure")
      await db.exec(followup)
      assert.deepEqual(await snapshot(tables), before)
      assert.deepEqual(await rows("select oid,proacl::text,prosecdef,provolatile,proconfig from pg_proc where oid='private.website_font_reference_valid(text)'::regprocedure"), properties)
      const registry = JSON.parse(read('../public/fonts/builtin/registry.json'))
      for (const font of registry) {
        assert.equal((await one('select private.website_font_reference_valid($1) value', [font.name])).value, true)
        assert.equal((await globalReference(font.name)).settings.typography.heading_family, font.name)
      }
      for (const invalid of ['Arial', 'Unknown', 'https://example.com/font', 'custom:' + familyId]) await denied(() => globalReference(invalid), '22023')
      await globalReference('Inter')
      await saveFamily()
      await globalReference('custom:' + familyId)
      await denied(async () => deleteFamily(familyId, await familyVersion(familyId)), '22023')
      await globalReference('Inter')
      await deleteFamily(familyId, await familyVersion(familyId))
      await denied(() => db.exec(followup))
      await db.exec('rollback')
    })
  }
  if (process.env.PERCENT_FONT_DELIVERY_MIGRATION) {
    await run('Service-only delivery resolver compiles; active opaque IDs resolve; clients, disabled/unused/missing assets denied; data/grants preserved', async () => {
      const delivery = read('migrations/' + process.env.PERCENT_FONT_DELIVERY_MIGRATION)
      const tables = await tableNames()
      const before = await snapshot(tables)
      const beforeFunctions = await functions()
      const catalogBefore = await rows("select oid,proacl::text,prosecdef,provolatile,proconfig from pg_proc where pronamespace='private'::regnamespace and proname like 'website_font_%' order by oid")
      await db.exec(delivery)
      assert.deepEqual(await snapshot(tables), before)
      assert.deepEqual(await functions(), beforeFunctions)
      assert.deepEqual(await rows("select oid,proacl::text,prosecdef,provolatile,proconfig from pg_proc where pronamespace='private'::regnamespace and proname like 'website_font_%' order by oid"), catalogBefore)
      const rpc = 'public.get_website_font_delivery_asset(uuid)'
      for (const role of ['anon', 'authenticated', 'service_role']) {
        assert.equal((await one('select has_function_privilege($1,$2,\'execute\') value', [role, rpc])).value, role === 'service_role')
        for (const table of ['website_font_families', 'website_font_faces']) assert.equal((await one('select has_table_privilege($1,$2,\'select\') value', [role, 'public.' + table])).value, false)
      }
      const serviceResolve = async assetId => {
        await db.exec('set role service_role')
        try { return await json('select public.get_website_font_delivery_asset($1) value', [assetId]) }
        finally { await db.exec('reset role') }
      }
      await saveFamily()
      const assets = await rows('select asset_id,weight from public.website_font_faces where family_id=$1 order by weight', [familyId])
      const asset = assets[0].asset_id
      assert.equal(await serviceResolve(asset), null, 'Unused families are not public assets')
      await globalReference('custom:' + familyId)
      for (const role of ['anonymous', 'customer', 'admin', 'super_admin', 'anonymous-token']) await denied(() => asCaller(role, () => json('select public.get_website_font_delivery_asset($1) value', [asset])), '42501')
      const resolved = await serviceResolve(asset)
      assert.deepEqual(Object.keys(resolved).sort(), ['asset_id', 'byte_size', 'mime_type', 'sha256', 'storage_path'])
      assert.equal(resolved.storage_path, f400.storage_path)
      assert.equal(resolved.sha256, f400.sha256)
      assert.equal(resolved.mime_type, 'font/woff2')
      assert.equal(resolved.byte_size, f400.byte_size)
      assert.equal((await serviceResolve(assets[1].asset_id)).storage_path, f700.storage_path)
      assert.equal(await serviceResolve(null), null)
      assert.equal(await serviceResolve('90000000-0000-4000-a000-000000000001'), null)
      await db.query('update public.website_font_families set enabled=false where id=$1', [familyId])
      assert.equal(await serviceResolve(asset), null)
      await db.query('update public.website_font_families set enabled=true where id=$1', [familyId])
      await db.query('delete from storage.objects where name=$1', [f400.storage_path])
      assert.equal(await serviceResolve(asset), null)
      await addObjects([f400])
      await db.query("update storage.objects set metadata=jsonb_set(metadata,'{mimetype}','\"image/png\"') where name=$1", [f400.storage_path])
      assert.equal(await serviceResolve(asset), null)
      await db.query("update storage.objects set metadata=jsonb_set(metadata,'{mimetype}','\"font/woff2\"') where name=$1", [f400.storage_path])
      await globalReference('Inter')
      assert.equal(await serviceResolve(asset), null)
      await deleteFamily(familyId, await familyVersion(familyId))
      assert.equal(await serviceResolve(asset), null)
      await denied(() => db.exec(delivery))
      await db.exec('rollback')
      // A failure after CREATE+GRANT is transactional and leaves no resolver.
      await db.exec('drop function public.get_website_font_delivery_asset(uuid)')
      await denied(() => db.exec(delivery.replace("notify pgrst, 'reload schema';", "do $$begin raise exception 'Injected failure';end$$;")))
      await db.exec('rollback')
      assert.equal((await one("select to_regprocedure('public.get_website_font_delivery_asset(uuid)') value")).value, null)
      await db.exec(delivery)
    })
  }
  if (process.env.PERCENT_FONT_PRIVACY_MIGRATION) {
    await run('Admin/browser font metadata minimized; service-only management catalog retains cleanup metadata; authorization, PT409, data and delivery preserved', async () => {
      const privacy = read('migrations/' + process.env.PERCENT_FONT_PRIVACY_MIGRATION)
      const tables = await tableNames(), before = await snapshot(tables)
      const beforeProperties = await rows("select oid,proacl::text,prosecdef,provolatile,proconfig from pg_proc where oid in ('private.website_font_admin_catalog()'::regprocedure,'public.delete_website_font_family(uuid,timestamptz)'::regprocedure) order by oid")
      const beforeDefinitions = await rows("select pg_get_functiondef(oid) definition from pg_proc where oid in ('private.website_font_admin_catalog()'::regprocedure,'public.delete_website_font_family(uuid,timestamptz)'::regprocedure) order by oid")
      await denied(()=>db.exec(privacy.replace("notify pgrst, 'reload schema';", "do $$begin raise exception 'Injected privacy failure';end$$;")))
      await db.exec('rollback')
      assert.deepEqual(await snapshot(tables),before)
      assert.deepEqual(await rows("select pg_get_functiondef(oid) definition from pg_proc where oid in ('private.website_font_admin_catalog()'::regprocedure,'public.delete_website_font_family(uuid,timestamptz)'::regprocedure) order by oid"),beforeDefinitions)
      assert.equal((await one("select to_regprocedure('public.get_website_font_management_catalog()') value")).value,null)
      assert.equal((await one("select to_regprocedure('private.website_font_server_catalog()') value")).value,null)
      await db.exec(privacy)
      assert.deepEqual(await snapshot(tables), before)
      assert.deepEqual(await rows("select oid,proacl::text,prosecdef,provolatile,proconfig from pg_proc where oid in ('private.website_font_admin_catalog()'::regprocedure,'public.delete_website_font_family(uuid,timestamptz)'::regprocedure) order by oid"), beforeProperties)
      const secretKeys = ['storage_path', 'sha256', 'byte_size', 'mime_type', 'cleanup_paths']
      const privateFree = value => {
        if (value && typeof value === 'object') for (const [key,child] of Object.entries(value)) { assert.ok(!secretKeys.includes(key)); privateFree(child) }
      }
      const save = await saveFamily()
      privateFree(save)
      const doc = await editor()
      privateFree(doc.font_families)
      for (const face of doc.font_families[0].faces) assert.deepEqual(Object.keys(face).sort(), ['asset_id','style','weight'])
      for (const role of ['anonymous','anonymous-token','customer','admin','super_admin']) await denied(() => asCaller(role, () => json('select public.get_website_font_management_catalog() value')), '42501')
      await db.exec('set role service_role')
      let server
      try { server = await json('select public.get_website_font_management_catalog() value') } finally { await db.exec('reset role') }
      assert.equal(server[0].faces[0].storage_path, f400.storage_path)
      assert.equal(server[0].faces[0].sha256, f400.sha256)
      assert.equal(server[0].faces[0].byte_size, f400.byte_size)
      // Approved Admin and Super Admin browser flows still receive safe catalogs.
      for (const role of ['admin','super_admin']) privateFree((await asCaller(role, () => json('select public.get_website_editor() value'))).font_families)
      await globalReference('custom:' + familyId)
      const globalDoc = await editor()
      privateFree(globalDoc.font_families)
      privateFree((await asCaller('anonymous', () => json('select public.get_storefront_content() value'))).font_families)
      await denied(() => saveFamily({version:'2000-01-01T00:00:00Z'}), 'PT409')
      await denied(() => deleteFamily(familyId, '2000-01-01T00:00:00Z'), 'PT409')
      await denied(async () => deleteFamily(familyId,await familyVersion(familyId)), '22023')
      await db.exec('set role service_role')
      try { assert.equal((await json('select public.get_website_font_delivery_asset($1) value',[doc.font_families[0].faces[0].asset_id])).storage_path, f400.storage_path) } finally { await db.exec('reset role') }
      await globalReference('Inter')
      const result = await deleteFamily(familyId, await familyVersion(familyId))
      assert.deepEqual(result,{removed:true})
      privateFree(result)
      for (const role of ['anon','authenticated','service_role']) assert.equal((await one("select has_function_privilege($1,'private.website_font_server_catalog()','execute') value",[role])).value,false)
      for (const role of ['anon','authenticated','service_role']) for (const table of ['website_font_families','website_font_faces']) assert.equal((await one('select has_table_privilege($1,$2,\'select\') value',[role,'public.'+table])).value,false)
      await denied(()=>db.exec(privacy))
      await db.exec('rollback')
    })
  }
  fs.mkdirSync(new URL('../docs/backend', root), { recursive: true })
  fs.writeFileSync(new URL('../docs/backend/custom-font-sql-preflight-results.json', root), JSON.stringify({ checkedAt: new Date().toISOString(), environment: 'Disposable PGlite PostgreSQL with Supabase Auth/Storage boundary shims; real historical migrations and internal Percent authorization; no hosted writes', historicalMigrations: history, results, hostedRpcProperties: hosted.functions.map(({ definition, ...properties }) => properties), hostedDependencies: hosted.audit.dependencies, beforeDependencies: beforeDeps, afterDependencies: await deps(beforeFunctions.map(f => f.oid)) }, null, 2) + '\n')
  console.log('CUSTOM FONT SQL PREFLIGHT: ' + results.length + ' groups passed')
} finally { await db.close() }
