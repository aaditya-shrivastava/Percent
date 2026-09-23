import fs from 'node:fs'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'

const db=new PGlite()
const ids={customer:'10000000-0000-4000-a000-000000000001',admin:'10000000-0000-4000-a000-000000000002',superAdmin:'10000000-0000-4000-a000-000000000003',banner:'20000000-0000-4000-a000-000000000001',hiddenBanner:'20000000-0000-4000-a000-000000000002'}
const as=async(role,uid,fn)=>{await db.exec(`set role ${role};select set_config('request.jwt.claim.sub','${uid??''}',false)`);try{return await fn()}finally{await db.exec("reset role;select set_config('request.jwt.claim.sub','',false)")}}
const rpc=(uid,name,args=[])=>as('authenticated',uid,async()=>(await db.query(`select public.${name}(${args.map((_,index)=>`$${index+1}`).join(',')}) result`,args)).rows[0].result)

try{
 await db.exec(`
  create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
  create schema auth;create schema private;create schema storage;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
  create table private.user_roles(user_id uuid primary key,role text not null);
  create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from private.user_roles where user_id=auth.uid() and role in ('admin','super_admin'))$$;
  create function private.touch_updated_at() returns trigger language plpgsql set search_path='' as $$begin new.updated_at=clock_timestamp();return new;end$$;
  grant usage on schema private to authenticated;grant execute on function private.is_admin() to authenticated;
  create table storage.buckets(id text primary key,name text not null,public boolean not null,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null,name text not null,unique(bucket_id,name));
  alter table storage.objects enable row level security;
 `)
 for(const [role,id] of Object.entries({customer:ids.customer,admin:ids.admin,super_admin:ids.superAdmin})){await db.query('insert into auth.users(id) values($1)',[id]);await db.query('insert into private.user_roles(user_id,role) values($1,$2)',[id,role])}
 await db.exec(fs.readFileSync(new URL('migrations/20260921190000_admin_website_editor.sql',import.meta.url),'utf8'))
 await db.exec(fs.readFileSync(new URL('migrations/20260922113000_website_editor_save_delete_fix.sql',import.meta.url),'utf8'))

 const publicInitial=await as('anon',null,async()=>(await db.query('select public.get_storefront_content() result')).rows[0].result)
 assert.deepEqual(publicInitial.sections,[]);assert.deepEqual(publicInitial.banners,[])
 await assert.rejects(rpc(ids.customer,'get_website_editor'),error=>error.code==='42501')
 await as('anon',null,()=>assert.rejects(db.query('select * from public.website_banners'),error=>error.code==='42501'))
 await as('authenticated',ids.admin,()=>assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('percent-website-media','browser-write.webp')"),error=>error.code==='42501'))

 const editor=await rpc(ids.admin,'get_website_editor')
 const path=`banners/${ids.banner}/${'a'.repeat(64)}.webp`,hiddenPath=`banners/${ids.hiddenBanner}/${'b'.repeat(64)}.jpg`
 await db.query("insert into storage.objects(bucket_id,name) values('percent-website-media',$1),('percent-website-media',$2)",[path,hiddenPath])
 const content={settings:{footer_tagline:'Less Ordinary. More You.',footer_description:'Limited pieces, made to be remembered.'},sections:[
  {section_key:'limited_editions',heading:'Limited Editions',subheading:'Creator collaborations.',body:null,cta_label:'View All',cta_path:'/shop?tags=limited-edition',enabled:true,sort_order:1},
  {section_key:'trending',heading:'Trending',subheading:'Styles getting noticed.',body:null,cta_label:'View All',cta_path:'/shop?tags=trending',enabled:false,sort_order:2},
 ],banners:[
  {id:ids.banner,image_path:path,mobile_image_path:null,alt:'Percent campaign',width:1800,height:1000,mobile_width:null,mobile_height:null,eyebrow:'New Drop',heading:'Redefined Basics.',description:'Every piece tells a story.',cta_label:'Shop the Drop',cta_path:'/shop',enabled:true,sort_order:1},
  {id:ids.hiddenBanner,image_path:hiddenPath,mobile_image_path:null,alt:'Hidden campaign',width:1800,height:1000,mobile_width:null,mobile_height:null,eyebrow:null,heading:'Hidden Banner',description:null,cta_label:null,cta_path:null,enabled:false,sort_order:2},
 ]}
 const saved=await rpc(ids.admin,'save_website_content',[content,editor.updated_at]);assert.equal(saved.banners.length,2)
 const publicSaved=await as('anon',null,async()=>(await db.query('select public.get_storefront_content() result')).rows[0].result)
 assert.equal(publicSaved.banners.length,1);assert.equal(publicSaved.banners[0].heading,'Redefined Basics.')
 assert.equal(publicSaved.sections.length,1);assert.equal(publicSaved.sections[0].key,'limited_editions')
 assert.deepEqual(publicSaved.settings,content.settings)

 const replacement=structuredClone(content)
 replacement.settings.footer_tagline='Replacement document'
 replacement.banners=replacement.banners.slice(0,1)
 replacement.sections=replacement.sections.reverse().map((section,index)=>({...section,sort_order:index+1}))
 const replaced=await rpc(ids.admin,'save_website_content',[replacement,saved.updated_at])
 assert.equal(replaced.banners.length,1);assert.equal(replaced.sections[0].section_key,'trending');assert.equal(replaced.settings.footer_tagline,'Replacement document')
 const withoutBanners={...replacement,banners:[]}
 const emptied=await rpc(ids.superAdmin,'save_website_content',[withoutBanners,replaced.updated_at])
 assert.equal(emptied.banners.length,0);assert.equal(emptied.sections.length,2)
 const restored=await rpc(ids.superAdmin,'save_website_content',[content,emptied.updated_at])
 assert.equal(restored.banners.length,2);assert.equal(restored.sections.length,2)
 await assert.rejects(rpc(ids.admin,'save_website_content',[content,editor.updated_at]),error=>error.code==='PT409')
 await assert.rejects(rpc(ids.customer,'save_website_content',[content,restored.updated_at]),error=>error.code==='42501')
 await as('anon',null,()=>assert.rejects(db.query('select public.save_website_content($1,$2)',[content,restored.updated_at]),error=>error.code==='42501'))

 const invalid=structuredClone(content);invalid.banners[0].cta_path='https://evil.invalid'
 await assert.rejects(rpc(ids.superAdmin,'save_website_content',[invalid,restored.updated_at]),error=>error.code==='23514')
 const afterRollback=await rpc(ids.superAdmin,'get_website_editor');assert.equal(afterRollback.banners[0].cta_path,'/shop');assert.equal(afterRollback.sections.length,2);assert.deepEqual(afterRollback.settings,content.settings)
 const missing=structuredClone(content);missing.banners[0].image_path=`banners/${ids.banner}/${'c'.repeat(64)}.webp`
 await assert.rejects(rpc(ids.superAdmin,'save_website_content',[missing,afterRollback.updated_at]),error=>error.code==='22023')
 const afterMissing=await rpc(ids.superAdmin,'get_website_editor');assert.equal(afterMissing.banners.length,2);assert.equal(afterMissing.sections.length,2);assert.deepEqual(afterMissing.settings,content.settings)

 const grants=(await db.query("select has_function_privilege('anon','public.get_storefront_content()','execute') public_read,has_function_privilege('anon','public.save_website_content(jsonb,timestamptz)','execute') anon_write,has_function_privilege('authenticated','public.save_website_content(jsonb,timestamptz)','execute') authenticated_write")).rows[0]
 assert.deepEqual(grants,{public_read:true,anon_write:false,authenticated_write:true})
 assert.equal((await db.query("select public from storage.buckets where id='percent-website-media'")).rows[0].public,false)
 console.log('PASS Website Editor backend: public live-only batch read, admin/super_admin save, customer/anon denial, PT409, validation, rollback, private bucket, and no browser media write verified')
}finally{await db.close()}
