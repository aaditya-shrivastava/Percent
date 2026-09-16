import {createClient} from '@supabase/supabase-js'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const url='https://gijyjdeohvdrnvqfqdha.supabase.co',key='sb_publishable_QxLwW-LIAjzV-s8YbKMP2Q_-FqY_DXc'
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
const password=await new Promise(resolve=>{if(process.stdin.isTTY)process.stdin.setRawMode(true);process.stdin.resume();process.stdin.once('data',data=>{process.stdin.pause();if(process.stdin.isTTY)process.stdin.setRawMode(false);resolve(data.toString().trim())});process.stdout.write('Waiting for password via stdin (not saved)\n')})
const results=[]
const test=async(name,fn)=>{await fn();results.push({name,status:'passed'});console.log('PASS '+name)}
let productId,role='unknown'
try{
 const login=await client.auth.signInWithPassword({email:process.argv[2],password});assert.equal(login.error,null)
 const token=login.data.session.access_token
 const send=async(body,auth=true)=>{const response=await fetch(url+'/functions/v1/percent-product-media',{method:'POST',headers:{apikey:key,...(auth?{Authorization:'Bearer '+token}:{}),...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body instanceof FormData?body:JSON.stringify(body)});return{status:response.status,body:await response.json()}}
 await test('Anonymous media rejected',async()=>assert.equal((await send({action:'read',product_id:crypto.randomUUID()},false)).status,401))
 role=(await client.rpc('get_my_role')).data
 if(role==='customer'){
  await test('Customer media mutation rejected',async()=>assert.equal((await send({action:'upload',product_id:crypto.randomUUID()})).status,403))
  await test('Customer draft mutation rejected',async()=>assert.ok((await client.rpc('save_product_draft',{draft:{}})).error))
 }else{
  assert.ok(['admin','super_admin'].includes(role))
  const slug='verification-product-editor-media'
  let existing=await client.from('products').select('id,updated_at').eq('slug',slug).maybeSingle()
  if(!existing.data){
   const created=await client.rpc('save_product_draft',{draft:{product:{name:'[Verification] Product Editor Media',slug,design_code:'VERIFY-EDITOR-MEDIA',price_paise:129900,production_limit:250,fit_type:'standard'},variants:[],tags:[],images:[],variant_images:[]}})
   assert.equal(created.error,null);existing={data:created.data}
  }
  productId=existing.data.id
  const version=async()=>(await client.from('products').select('updated_at').eq('id',productId).single()).data.updated_at
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')
  const form=async(bytes=png,mime='image/png',request=crypto.randomUUID())=>{const f=new FormData();f.set('action','upload');f.set('product_id',productId);f.set('request_id',request);f.set('expected_updated_at',await version());f.set('file',new Blob([bytes],{type:mime}),'test.png');f.set('width','1');f.set('height','1');f.set('alt','Verification image');return f}
  await test('Arbitrary bucket/path fields rejected',async()=>assert.equal((await send({action:'read',product_id:productId,bucket:'other',path:'arbitrary'})).status,400))
  await test('Invalid MIME rejected',async()=>assert.equal((await send(await form(png,'text/html'))).status,400))
  await test('Over 10 MB rejected',async()=>assert.equal((await send(await form(Buffer.alloc(10*1024*1024+1)))).status,413))
  await test('Empty upload rejected',async()=>assert.equal((await send(await form(Buffer.alloc(0)))).status,413))
  const requestId=crypto.randomUUID(),uploadForm=await form(png,'image/png',requestId)
  const uploaded=await send(uploadForm)
  await test('Authorized PNG upload and transactional association',async()=>{assert.equal(uploaded.status,200,JSON.stringify(uploaded.body));assert.ok(uploaded.body.image_id)})
  await test('Retry reuses image relation',async()=>{const retry=await send(await form(png,'image/png',requestId));assert.equal(retry.status,200);assert.equal(retry.body.image_id,uploaded.body.image_id);assert.equal(retry.body.replayed,true)})
  await test('Signed authorized delivery returns real bytes',async()=>{const read=await send({action:'read',product_id:productId});assert.equal(read.status,200);const image=read.body.images.find(i=>i.id===uploaded.body.image_id);const response=await fetch(image.url);assert.equal(response.status,200);assert.ok((await response.arrayBuffer()).byteLength>0)})
  for(const [ext,mime] of [['jpg','image/jpeg'],['webp','image/webp']]){
   await test('Authorized '+ext+' upload and deletion',async()=>{const result=await send(await form(fs.readFileSync(new URL('./test-fixtures/pixel.'+ext,import.meta.url)),mime));assert.equal(result.status,200,JSON.stringify(result.body));assert.equal((await send({action:'delete',product_id:productId,image_id:result.body.image_id,expected_updated_at:await version()})).status,200)})
  }
  const changeOrder=async(order)=>{
   const p=(await client.from('products').select('*').eq('id',productId).single()).data
   const fields=Object.fromEntries(['name','slug','design_code','short_description','full_description','price_paise','compare_at_price_paise','category_id','fit_type','production_limit','material','style','care_instructions','shipping_and_returns'].map(k=>[k,p[k]]))
   const images=(await client.from('product_images').select('id,url,alt,width,height,role,sort_order').eq('product_id',productId)).data.map(i=>({...i,sort_order:order}))
   const r=await client.rpc('save_product_draft',{product_id:productId,expected_updated_at:p.updated_at,draft:{product:fields,variants:[],tags:[],images,variant_images:[]}});assert.equal(r.error,null)
  }
  await test('Failed association removes freshly uploaded Storage object',async()=>{await changeOrder(1000000);try{const failed=await send(await form());assert.equal(failed.status,409);assert.equal(failed.body.cleaned,true);assert.equal((await client.from('product_images').select('id').eq('product_id',productId)).data.length,1)}finally{await changeOrder(0)}})
  await test('Cross-product image delete cannot affect target',async()=>{const other=(await client.from('products').select('id,updated_at').neq('id',productId).limit(1).single()).data;await send({action:'delete',product_id:other.id,image_id:uploaded.body.image_id,expected_updated_at:other.updated_at});assert.equal((await client.from('product_images').select('id').eq('id',uploaded.body.image_id).single()).data.id,uploaded.body.image_id)})
  await test('Storage-first deletion and repeated delete',async()=>{const deletion={action:'delete',product_id:productId,image_id:uploaded.body.image_id,expected_updated_at:await version()};assert.equal((await send(deletion)).status,200);assert.equal((await send(deletion)).status,200);assert.equal((await client.from('product_images').select('id').eq('id',uploaded.body.image_id)).data.length,0)})
  await test('All verification products stay invisible drafts',async()=>{const p=(await client.from('products').select('status,is_visible,is_shop_available').eq('id',productId).single()).data;assert.equal(p.status,'draft');assert.equal(p.is_visible,false);assert.equal(p.is_shop_available,false)})
 }
}finally{
 await client.auth.signOut({scope:'local'})
 fs.writeFileSync(new URL('../docs/backend/phase-2b-media-tests-'+role+'.json',import.meta.url),JSON.stringify({projectRef:'gijyjdeohvdrnvqfqdha',role,verificationProductId:productId,results},null,2)+'\n')
}
