import fs from 'node:fs';import assert from 'node:assert/strict';import{PGlite}from'@electric-sql/pglite';
const root=new URL('./',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');const migration=read('migrations/20261002022344_customer_session_anonymous_denial.sql');const hosted=JSON.parse(read('../docs/backend/customer-session-hosted-functions.json'));const db=new PGlite(),results=[];
const run=async(name,fn)=>{await fn();results.push(name);console.log('PASS '+name)};
try{
await run('Migration has exact literal issuer with no escaped colon',async()=>{assert(migration.includes('https://securetoken.google.com/percent-63d3e'));assert(!migration.includes('https\\://'));});
await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;create schema storage;create function storage.allow_any_operation(text[]) returns boolean language sql immutable as $$select true$$;create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;create table storage.buckets(id text primary key,name text not null,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
for(const file of fs.readdirSync(new URL('migrations',root)).filter(f=>f.endsWith('.sql')&&f<'20260930'&&!f.includes('username')).sort()){
console.log('REPLAY '+file);try{await db.exec(read('migrations/'+file))}catch(e){throw new Error(file+': '+e.message)}if(file==='20260912112058_percent_foundation.sql'){await db.exec(`insert into auth.users(id,email) values('10000000-0000-4000-a000-000000000001','fixture@example.test');update private.user_roles set role='super_admin' where user_id='10000000-0000-4000-a000-000000000001';`)}
}
const metadata=async()=> (await db.query(`select p.oid::regprocedure::text signature, pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.prosecdef,p.provolatile,p.proconfig,pg_get_function_identity_arguments(p.oid) arguments,pg_get_function_result(p.oid) result,p.prosrc from pg_proc p where p.oid in ('private.current_user_id()'::regprocedure,'public.provision_my_percent_identity()'::regprocedure) order by p.oid`)).rows;
await run('Hosted bodies match historical replay',async()=>{const rows=await metadata();for(let i=0;i<rows.length;i++){const expected=hosted[i].definition.split('$function$')[1].replace(/\r/g,'').trim();assert.equal(rows[i].prosrc.replace(/\r/g,'').trim(),expected)}});
const before=await metadata();await run('Migration compiles and executes locally',()=>db.exec(migration));const after=await metadata();await run('Owner ACL volatility security definer search_path signatures unchanged',async()=>{const strip=xs=>xs.map(({prosrc,...rest})=>rest);assert.deepEqual(strip(after),strip(before));});
if(fs.existsSync(new URL('../docs/backend/customer-security-deployed-functions.json',root)))await run('Deployed identity functions exactly match the tested replacements',async()=>{const deployed=JSON.parse(read('../docs/backend/customer-security-deployed-functions.json'));for(const row of after){const name=row.signature.replace('public.','');const live=deployed.find(f=>f.signature.replace('public.','')===name);assert(live);assert.equal(row.prosrc.replace(/\r/g,'').trim(),live.definition.split('$function$')[1].replace(/\r/g,'').trim());assert.equal(row.owner,live.owner);assert.equal(row.acl,live.acl);assert.equal(row.prosecdef,live.prosecdef);assert.equal(row.provolatile,live.provolatile);assert.deepEqual(row.proconfig,live.proconfig)}});
await run('Prepared rollback-only SQL test',()=>db.exec(read('tests/customer_session_anonymous_denial.sql')));
const claims=async value=>db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(value)]);
const resolve=async()=> (await db.query('select private.current_user_id() id, private.is_admin() admin,public.get_my_role() role')).rows[0];
const provision=async()=> (await db.query('select public.provision_my_percent_identity() id')).rows[0].id;
const firebase=(subject,provider)=>({iss:'https://securetoken.google.com/percent-63d3e',aud:'percent-63d3e',role:'authenticated',sub:subject,firebase:{sign_in_provider:provider},...(provider==='google.com'?{email:'google-fixture@example.test',email_verified:true}:{})});
await run('Password Google customer admin and super_admin identities unchanged',async()=>{
 for(const role of['customer','admin','super_admin'])for(const provider of['password','google.com']){
  await claims(firebase(role+'-'+provider,provider));const id=await provision();await db.query('update private.user_roles set role=$1 where user_id=$2',[role,id]);const resolved=await resolve();assert.equal(resolved.id,id);assert.equal(resolved.role,role);assert.equal(resolved.admin,role!=='customer');assert.equal(await provision(),id);
  await db.exec('set role authenticated');try{assert.equal((await resolve()).id,id)}finally{await db.exec('reset role')}
 }
});
await run('Normal provisioning preserves role profile mapping and Google contact email',async()=>{
 const counts=async()=> (await db.query('select (select count(*)::int from private.percent_principals) principals,(select count(*)::int from private.external_identities) identities')).rows[0];
 for(const provider of['password','google.com']){await claims(firebase('new-'+provider,provider));const previous=await counts();const id=await provision();const profile=(await db.query('select p.id,r.role,x.email from profiles p join private.user_roles r on r.user_id=p.id join private.percent_principals x on x.id=p.id where p.id=$1',[id])).rows[0];assert.equal(profile.role,'customer');assert.equal(profile.email,provider==='google.com'?'google-fixture@example.test':null);assert.equal((await counts()).principals,previous.principals+1);assert.equal(await provision(),id);assert.equal((await counts()).identities,previous.identities+1)}
 const previous=await counts();for(const value of[firebase('never-provision-anonymous','anonymous'),{iss:'https://gijyjdeohvdrnvqfqdha.supabase.co/auth/v1',aud:'authenticated',role:'authenticated',sub:'10000000-0000-4000-a000-000000000001',is_anonymous:true}]){await claims(value);await assert.rejects(provision(),e=>e.code==='42501');assert.deepEqual(await counts(),previous)}
});
await run('Authenticated checkout identity reaches ordinary validation; anonymous RPCs denied',async()=>{
 await claims(firebase('customer-password','password'));await assert.rejects(db.query("select public.create_checkout_order('[]',null,null,null)"),e=>e.code==='22023');
 await claims({});await db.exec('set role anon');try{for(const sql of["select public.provision_my_percent_identity()","select public.create_checkout_order('[]',null,null,null)","select public.validate_coupon('FIXTURE','[]')"]){await assert.rejects(db.query(sql),e=>e.code==='42501')}}finally{await db.exec('reset role')}
});
await run('Customer A/B profile address wishlist order and review RLS ownership',async()=>{
 const customerIds=[];for(const subject of['ownership-a','ownership-b']){await claims(firebase(subject,'password'));customerIds.push(await provision())}
 const[a,b]=customerIds;
 const addressPayload={label:'Home',full_name:'Fixture',phone:'9999999999',address_line1:'Fixture street',city:'Mumbai',state:'Maharashtra',pin_code:'400001'};
 const addresses=[];
 for(const [i,subject]of['ownership-a','ownership-b'].entries()){await claims(firebase(subject,'password'));await db.exec('set role authenticated');try{addresses[i]=(await db.query('select (public.save_address($1::jsonb)).id id',[JSON.stringify(addressPayload)])).rows[0].id}finally{await db.exec('reset role')}}
 // Bootstrap catalog fixture only; customer RLS remains enabled.
 await db.exec('alter table products disable trigger user');
 const product=(await db.query("insert into products(design_code,slug,name,fit_type,price_paise,status,is_visible) values('SECURITY-FIXTURE','security-fixture','Security Fixture','standard',100,'draft',false) returning id")).rows[0].id;
 await db.exec('alter table products enable trigger user');
 await db.query("update private.percent_principals set email='fixture@example.test' where id=any($1::uuid[])",[customerIds]);
 const colour=(await db.query("insert into colours(slug,label,swatch_value) values('security-black','Black','#000000') returning id")).rows[0].id;
 const variant=(await db.query("insert into product_variants(product_id,colour_id,size,sku,price_paise) values($1,$2,'M','SECURITY-FIXTURE-M',100) returning id",[product,colour])).rows[0].id;
 await db.query('insert into inventory_units(product_id,variant_id,piece_number) values($1,$2,1),($1,$2,2)',[product,variant]);
 await db.exec('alter table products disable trigger user');
 await db.query("update products set status='active',is_visible=true,is_shop_available=true where id=$1",[product]);
 await db.exec('alter table products enable trigger user');
 const cart=JSON.stringify([{variant_id:variant,quantity:1}]);
 const orders=[];for(const[id,index]of customerIds.map((id,index)=>[id,index]))orders[index]=(await db.query("insert into orders(order_reference,user_id,subtotal_paise,total_paise) values($1,$2,0,0) returning id",['SECURITY-ORDER-'+index,id])).rows[0].id;
 await claims(firebase('ownership-a','password'));await db.exec('set role authenticated');
 try{
  assert.equal((await db.query('select id from profiles where id=$1',[a])).rows.length,1);assert.equal((await db.query('select id from profiles where id=$1',[b])).rows.length,0);
  assert.equal((await db.query('select id from addresses where id=$1',[addresses[0]])).rows.length,1);assert.equal((await db.query('select id from addresses where id=$1',[addresses[1]])).rows.length,0);
  assert.equal((await db.query('select id from orders where id=$1',[orders[0]])).rows.length,1);assert.equal((await db.query('select id from orders where id=$1',[orders[1]])).rows.length,0);
  assert.equal((await db.query("update profiles set display_name='Denied' where id=$1 returning id",[b])).rows.length,0);
  assert.equal((await db.query('delete from addresses where id=$1 returning id',[addresses[1]])).rows.length,0);
  await assert.rejects(db.query('select public.save_address($1::jsonb)',[JSON.stringify({...addressPayload,id:addresses[1]})]),e=>e.code==='42501'||e.message.includes('Address unavailable'));
  await db.query('insert into wishlist_items(user_id,product_id) values($1,$2)',[a,product]);await assert.rejects(db.query('insert into wishlist_items(user_id,product_id) values($1,$2)',[b,product]),e=>e.code==='42501');
  await db.query("insert into product_reviews(user_id,product_id,rating,body,customer_name) values($1,$2,5,'Fixture review','Fixture')",[a,product]);await assert.rejects(db.query("insert into product_reviews(user_id,product_id,rating,body,customer_name) values($1,$2,5,'Fixture review','Fixture')",[b,product]),e=>e.code==='42501');
  await assert.rejects(db.query("insert into orders(order_reference,user_id,subtotal_paise,total_paise) values('FORGED',$1,0,0)",[a]),e=>e.code==='42501');
  const key='50000000-0000-4000-a000-000000000001';
  await assert.rejects(db.query('select public.create_checkout_order($1::jsonb,$2::uuid,$3::uuid)',[cart,addresses[1],key]),e=>e.code==='22023');
  const checkout=(await db.query('select public.create_checkout_order($1::jsonb,$2::uuid,$3::uuid) result',[cart,addresses[0],key])).rows[0].result;
  assert.equal(checkout.payment_status,'unpaid');assert.equal(checkout.reservation_active,true);assert.equal(checkout.subtotal_paise,100);
  assert.equal((await db.query('select public.create_checkout_order($1::jsonb,$2::uuid,$3::uuid) result',[cart,addresses[0],key])).rows[0].result.id,checkout.id);
  assert.equal((await db.query('select * from order_items where order_id=$1',[checkout.id])).rows.length,1);
  assert.equal((await db.query('select * from order_addresses where order_id=$1',[checkout.id])).rows.length,1);
  await assert.rejects(db.query('select * from checkout_reservations'),e=>e.code==='42501');
 }finally{await db.exec('reset role')}
 await claims({});await db.exec('set role anon');try{
  for(const table of['profiles','addresses','wishlist_items','orders','order_items','order_addresses','checkout_reservations'])await assert.rejects(db.query('select * from '+table),e=>e.code==='42501');
  for(const sql of["insert into profiles(id) values('10000000-0000-4000-a000-000000000099')","insert into addresses(user_id) values('10000000-0000-4000-a000-000000000099')","insert into wishlist_items(user_id,product_id) values('10000000-0000-4000-a000-000000000099','10000000-0000-4000-a000-000000000099')","insert into product_reviews(user_id,product_id,rating,body,customer_name) values('10000000-0000-4000-a000-000000000099','10000000-0000-4000-a000-000000000099',5,'Fixture','Fixture')","select public.save_address('{}')","select public.create_checkout_order('[]',null,null)"]){await assert.rejects(db.query(sql),e=>e.code==='42501'||e.message==='Authentication required')}
 }finally{await db.exec('reset role')}
 await claims(firebase('ownership-b','password'));await db.exec('set role authenticated');try{assert.equal((await db.query('select * from order_items')).rows.length,0);assert.equal((await db.query('select * from order_addresses')).rows.length,0);assert.equal((await db.query('select id from addresses where id=$1',[addresses[1]])).rows.length,1);assert.equal((await db.query('select id from orders where id=$1',[orders[1]])).rows.length,1);assert.equal((await db.query('select * from wishlist_items where user_id=$1',[a])).rows.length,0);assert.equal((await db.query('select * from product_reviews where user_id=$1',[a])).rows.length,0)}finally{await db.exec('reset role')}
});
const mutations={
 missingAnchor:s=>s.replace('if claims is null','if (claims is null)'),
 duplicateAnchor:s=>s.replace('if claims is null','if claims is null /* if claims is null */'),
 missingJwt:s=>s.replace('auth.jwt()','null::jsonb'),
 wrongIssuer:s=>s.replace('https://securetoken.google.com/percent-63d3e','https://securetoken.google.com/other-project'),
 securityInvoker:s=>s.replace('SECURITY DEFINER','SECURITY INVOKER'),
 wrongSearchPath:s=>s.replace("SET search_path TO ''","SET search_path TO 'public'"),
 unexpectedBody:s=>s.replace('declare','declare -- unexpected drift'),
};
for(const [name,mutate]of Object.entries(mutations))for(const target of hosted){
 await run('Fail closed '+target.signature+' '+name,async()=>{
  for(const original of hosted)await db.exec(original.definition);
  const changed=mutate(target.definition);assert.notEqual(changed,target.definition);await db.exec(changed);const baseline=await metadata();await assert.rejects(db.exec(migration),e=>e.message.includes('Unrecognized identity authorization body'));await db.exec('rollback');assert.deepEqual(await metadata(),baseline);
 });
}
for(const original of hosted)await db.exec(original.definition);await db.exec(migration);
fs.writeFileSync(new URL('../docs/backend/customer-session-preflight-results.json',root),JSON.stringify({checkedAt:new Date().toISOString(),environment:'disposable in-memory PGlite; Supabase Auth shim; relevant historical migrations through coupon foundation; no hosted writes',results,before,after},null,2));
}catch(e){console.error(e.code??'',e.message);process.exitCode=1}finally{await db.close()}
