import {createClient} from '@supabase/supabase-js'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const url='https://gijyjdeohvdrnvqfqdha.supabase.co',key='sb_publishable_QxLwW-LIAjzV-s8YbKMP2Q_-FqY_DXc'
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
const password=await new Promise(resolve=>{process.stdin.setRawMode(true);process.stdin.resume();process.stdin.once('data',data=>{process.stdin.pause();process.stdin.setRawMode(false);resolve(data.toString().trim())});console.log('Waiting for password via masked stdin')})
const id='f6b65a97-1f13-4b77-b760-7a944620f5e7',results=[]
try{
 const login=await client.auth.signInWithPassword({email:process.argv[2],password});assert.equal(login.error,null);assert.equal((await client.rpc('get_my_role')).data,'super_admin')
 const product=async()=>(await client.from('products').select('*').eq('id',id).single()).data
 const p=await product(),[variants,images,tags,links]=await Promise.all([
  client.from('product_variants').select('id,colour_id,size,sku,price_paise,compare_at_price_paise,enabled').eq('product_id',id),
  client.from('product_images').select('id,url,alt,width,height,role,sort_order').eq('product_id',id),
  client.from('product_tags').select('tag_id').eq('product_id',id),
  client.from('variant_images').select('variant_id,image_id,sort_order').eq('product_id',id),
 ]);for(const r of [variants,images,tags,links])assert.equal(r.error,null)
 const fields=['name','slug','design_code','short_description','full_description','price_paise','compare_at_price_paise','category_id','fit_type','production_limit','material','style','care_instructions','shipping_and_returns']
 const original={product:Object.fromEntries(fields.map(k=>[k,p[k]])),variants:variants.data,images:images.data,tags:tags.data.map(t=>t.tag_id),variant_images:links.data}
 const changed=structuredClone(original);changed.product.short_description='HTTP conflict verification: newer version must survive.'
 const saved=await client.rpc('save_product_draft',{product_id:id,expected_updated_at:p.updated_at,draft:changed});assert.equal(saved.error,null)
 const newer=await product(),started=Date.now()
 const response=await fetch(url+'/rest/v1/rpc/save_product_draft',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+login.data.session.access_token,'Content-Type':'application/json'},body:JSON.stringify({product_id:id,expected_updated_at:p.updated_at,draft:original}),signal:AbortSignal.timeout(15000)})
 const body=await response.json(),elapsedMs=Date.now()-started
 assert.equal(response.status,409);assert.equal(body.code,'PT409');assert.ok(elapsedMs<15000)
 const after=await product();assert.equal(after.updated_at,newer.updated_at);assert.equal(after.short_description,changed.product.short_description)
 results.push({test:'single stale HTTP request',status:response.status,code:body.code,elapsedMs,newerDataPreserved:true,automaticClientRetries:0})
 const invalid=structuredClone(original);invalid.product.name='Must roll back';invalid.tags=[crypto.randomUUID()]
 assert.ok((await client.rpc('save_product_draft',{product_id:id,expected_updated_at:newer.updated_at,draft:invalid})).error)
 assert.equal((await product()).name,newer.name);assert.equal((await product()).updated_at,newer.updated_at)
 results.push({test:'relational failure rollback',passed:true})
 const restored=await client.rpc('save_product_draft',{product_id:id,expected_updated_at:newer.updated_at,draft:original});assert.equal(restored.error,null)
 results.push({test:'current-version save succeeds',passed:true})
 const anon=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
 const hidden=await anon.from('products').select('id').in('id',[id,'9d0c1531-7dca-4360-b5b4-6478e5583933']);assert.equal(hidden.error,null);assert.deepEqual(hidden.data,[])
 results.push({test:'verification drafts hidden through anonymous API',passed:true})
 console.log(JSON.stringify(results,null,2))
}finally{await client.auth.signOut({scope:'local'});fs.writeFileSync(new URL('../docs/backend/phase-2b-conflict-http-tests.json',import.meta.url),JSON.stringify(results,null,2)+'\n')}
