import fs from 'node:fs'
import assert from 'node:assert/strict'
import { loadFontHandler } from './website-font-test-runtime.mjs'
import { FunctionsClient } from '@supabase/functions-js'

const {handler,state}=await loadFontHandler()
const id=crypto.randomUUID(),bytes=fs.readFileSync('public/fonts/builtin/inter/inter-latin-wght-normal.woff2')
const json=async(action,extra={},role='admin')=>handler(new Request('https://test.local',{method:'POST',headers:{Authorization:`Bearer ${role}-test-only`,'Content-Type':'application/json'},body:JSON.stringify({action,...extra})}))
const form=(entries=[{weight:400,style:'normal'},{weight:700,style:'normal'}],extra={})=>{
 const body=new FormData();for(const [key,value]of Object.entries({action:'font_save',family_id:id,family_name:'Legal reversible test',enabled:'true',license_confirmed:'true',expected_updated_at:'',faces:JSON.stringify(entries),...extra}))body.set(key,value)
 entries.forEach((_,i)=>body.set(`file_${i}`,new File([bytes],`legal-${i}.woff2`,{type:'font/woff2'})));return body
}
const upload=async(body,role='admin')=>handler(new Request('https://test.local',{method:'POST',headers:role?{Authorization:`Bearer ${role}-test-only`}:{},body}))
const opaque=value=>{assert.ok(!JSON.stringify(value).match(/storage_path|sha256|byte_size|mime_type|cleanup_paths|fonts\//))}
for(const role of [null,'customer','anonymous'])assert.ok((await upload(form(),role)).status>=401)
assert.equal(state.files.size,0)
assert.equal((await upload(form(undefined,{license_confirmed:'false'}))).status,400)
assert.equal((await upload(form([{weight:400,style:'normal'},{weight:400,style:'normal'}]))).status,400)
const malformed=form();malformed.set('file_0',new File([Buffer.alloc(100)],'bad.woff2',{type:'font/woff2'}));assert.equal((await upload(malformed)).status,400)
const oversized=form();oversized.set('file_0',new File([Buffer.alloc(2097153)],'big.woff2',{type:'font/woff2'}));assert.equal((await upload(oversized)).status,413)
assert.equal(state.files.size,0)
const saved=await upload(form());assert.equal(saved.status,200);opaque(await saved.json());assert.equal(state.families[0].faces.length,2)
const superBody=form([{weight:500,style:'italic'}],{family_id:crypto.randomUUID(),family_name:'Legal Super Admin test'});assert.equal((await upload(superBody,'super_admin')).status,200)
assert.equal((await upload(form(undefined,{family_id:crypto.randomUUID()}))).status,409)
opaque(await(await json('font_catalog')).json())
const family=state.families.find(f=>f.id===id),asset=family.faces[0].asset_id
assert.equal((await json('font_preview',{asset_id:asset})).status,200)
const sdk=new FunctionsClient('https://test.local',{headers:{Authorization:'Bearer admin-test-only'},customFetch:(url,options)=>handler(new Request(url,options))})
const preview=await sdk.invoke('percent-website-media',{body:{action:'font_preview',asset_id:asset}})
assert.equal(preview.error,null);assert.ok(preview.data instanceof Blob)
assert.deepEqual(Buffer.from(await preview.data.arrayBuffer()),bytes)
assert.equal(preview.response.headers.get('cache-control'),'private, no-store')
const get=(search='',options={})=>handler(new Request(`https://test.local?${search}`,options))
assert.equal((await get('font=../../private')).status,400)
assert.equal((await get('font='+crypto.randomUUID())).status,404)
assert.equal((await get('font='+asset)).status,404)
assert.equal((await get('font='+asset+'&path=private')).status,400)
family.in_use=true
const response=await get('font='+asset);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'font/woff2');assert.equal(response.headers.get('access-control-allow-origin'),'*');assert.ok(response.headers.get('cache-control').includes('immutable'));assert.equal(response.headers.get('etag'),`"${asset}"`);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes)
const count=state.downloads;assert.equal((await get('font='+asset)).status,200);assert.equal(state.downloads,count)
assert.equal((await get('font='+asset,{headers:{'If-None-Match':`"${asset}"`}})).status,304)
assert.equal((await get('font='+asset,{method:'HEAD'})).headers.get('content-length'),String(bytes.length))
assert.equal((await handler(new Request('https://test.local',{method:'OPTIONS'}))).headers.get('access-control-allow-origin'),'*')
assert.equal((await json('font_delete',{family_id:id,expected_updated_at:family.updated_at})).status,409)
assert.equal((await json('font_toggle',{family_id:id,expected_updated_at:family.updated_at,enabled:false})).status,409)
family.in_use=false
assert.equal((await json('font_delete',{family_id:id,expected_updated_at:'stale'})).status,409)
const renamed=form(family.faces.map(({asset_id,weight,style})=>({asset_id,weight,style})),{family_name:'Renamed legal test',expected_updated_at:family.updated_at});for(let i=0;i<family.faces.length;i++)renamed.delete(`file_${i}`);assert.equal((await upload(renamed)).status,200)
for(const f of [...state.families]){const result=await json('font_delete',{family_id:f.id,expected_updated_at:f.updated_at});assert.equal(result.status,200);opaque(await result.json())}
assert.equal(state.files.size,0);assert.equal(state.families.length,0);assert.equal((await get('font='+asset)).status,404)
console.log('PASS actual Edge handler: Admin/Super Admin uploads; anonymous/customer denial; decoder/signature/size/license/duplicates; opaque metadata; preview; managed public delivery; CORS/cache/ETag; only cached bytes; active protections/PT409; rename; cleanup with no fixtures')
