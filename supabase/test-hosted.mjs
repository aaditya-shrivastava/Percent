import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
const ref='gijyjdeohvdrnvqfqdha',url=`https://${ref}.supabase.co`,key='sb_publishable_QxLwW-LIAjzV-s8YbKMP2Q_-FqY_DXc'
const config=JSON.parse(fs.readFileSync('.env.hosted-test','utf8'))
const client=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
const anon=client(),one=client(),two=client(),results=[]
const test=async(name,fn)=>{await fn();results.push({name,status:'passed'});console.log('PASS '+name)}
try{
 await test('Hosted Auth password sign-in and profile bootstrap',async()=>{
  for(const [i,c] of [one,two].entries()){
   const {data,error}=await c.auth.signInWithPassword({email:`phase2-${config.users[i]}@example.invalid`,password:config.password});assert.equal(error,null);assert.equal(data.user.id,config.users[i])
   const profile=await c.from('profiles').select('*');assert.equal(profile.error,null);assert.equal(profile.data.length,1);assert.equal(profile.data[0].id,config.users[i])
  }
 })
 await test('Anon catalog excludes all draft products, variants, reviews and blogs',async()=>{
  for(const table of ['products','product_variants','product_images','product_reviews','blog_posts','blog_sections']){const r=await anon.from(table).select('*');assert.equal(r.error,null);assert.equal(r.data.length,0)}
  const stock=await anon.rpc('catalog_stock');assert.equal(stock.error,null);assert.deepEqual(stock.data,[])
 })
 await test('Hosted REST profile ownership and role escalation denied',async()=>{
  const write=await one.from('profiles').update({display_name:'Phase 2 test'}).eq('id',config.users[0]);assert.equal(write.error,null)
  const other=await two.from('profiles').select('*').eq('id',config.users[0]);assert.deepEqual(other.data,[])
  const role=await one.schema('private').from('user_roles').update({role:'super_admin'}).eq('user_id',config.users[0]);assert.ok(role.error)
  const order=await one.from('orders').insert({order_reference:'FORBIDDEN',subtotal_paise:0,total_paise:0});assert.ok(order.error)
 })
 await test('Transactional address defaults and cross-user isolation over REST',async()=>{
  const base={full_name:'Test',phone:'9876543210',address_line1:'Test only',city:'Mumbai',state:'MH',pin_code:'400001',is_default:true}
  const first=await one.rpc('save_address',{address:base});assert.equal(first.error,null)
  const second=await one.rpc('save_address',{address:{...base,label:'Work'}});assert.equal(second.error,null)
  const concurrent=await Promise.all([one.rpc('save_address',{address:{...base,id:first.data.id}}),one.rpc('save_address',{address:{...base,id:second.data.id}})]);concurrent.forEach(r=>assert.equal(r.error,null))
  const addresses=await one.from('addresses').select('*');assert.equal(addresses.data.filter(a=>a.is_default).length,1)
  assert.deepEqual((await two.from('addresses').select('*')).data,[])
  const hijack=await two.rpc('save_address',{address:{...base,id:first.data.id}});assert.ok(hijack.error)
 })
 await test('Customer wishlist is private and invalid products rejected',async()=>{
  assert.deepEqual((await one.from('wishlist_items').select('*')).data,[])
  const r=await one.from('wishlist_items').insert({user_id:config.users[1],product_id:config.users[0]});assert.ok(r.error)
 })
 await test('Private Storage denies anonymous and direct customer upload',async()=>{
  for(const c of [anon,one]){
   for(const bucket of ['percent-product-images','percent-review-images','percent-blog-images']){
    const r=await c.storage.from(bucket).upload(`${config.users[0]}/denied.txt`,new Uint8Array([1,2]),{contentType:'image/png'});assert.ok(r.error)
    const listing=await c.storage.from(bucket).list();assert.ok(listing.error||listing.data.length===0)
   }
  }
  const invoke=await anon.functions.invoke('percent-review-media',{body:new FormData()});assert.ok(invoke.error)
  const form=new FormData();form.set('review_id',config.users[1]);const owned=await one.functions.invoke('percent-review-media',{body:form});assert.ok(owned.error)
 })
 await test('Real Auth settings endpoint reachable',async()=>{const r=await fetch(url+'/auth/v1/settings',{headers:{apikey:key}});assert.equal(r.status,200);const settings=await r.json();assert.equal(settings.external.email,true);results.push({name:'Email confirmation setting',value:!settings.mailer_autoconfirm})})
}finally{
 await one.auth.signOut();await two.auth.signOut()
 fs.writeFileSync('docs/backend/hosted-test-results.json',JSON.stringify({projectRef:ref,results},null,2)+'\n')
}
