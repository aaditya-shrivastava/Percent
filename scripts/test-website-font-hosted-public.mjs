import assert from 'node:assert/strict'
import fs from 'node:fs'
import {loadEnv} from 'vite'
import {isDeepStrictEqual} from 'node:util'

// Read-only hosted requests; no sessions, fixtures, Storage writes or SQL.
const env=loadEnv('development',process.cwd(),'VITE_')
const base=env.VITE_SUPABASE_URL,headers={apikey:env.VITE_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'}
const endpoint=base+'/functions/v1/percent-website-media'
const result=[]
for(const [label,url,method,body,status] of [
 ['Malformed asset ID',endpoint+'?font=bad','GET',null,400],
 ['Unknown asset ID',endpoint+'?font=11111111-1111-4111-8111-111111111111','GET',null,404],
 ['Arbitrary path parameter',endpoint+'?font=11111111-1111-4111-8111-111111111111&path=fonts/anything','GET',null,400],
 ['Anonymous font management',endpoint,'POST',{action:'font_catalog'},401],
 ['Anonymous font preview',endpoint,'POST',{action:'font_preview',asset_id:'11111111-1111-4111-8111-111111111111'},401],
 ['Anonymous service-only catalog RPC',base+'/rest/v1/rpc/get_website_font_management_catalog','POST',{},401],
 ['Anonymous service-only delivery RPC',base+'/rest/v1/rpc/get_website_font_delivery_asset','POST',{p_asset_id:'11111111-1111-4111-8111-111111111111'},401],
]){
 const response=await fetch(url,{method,headers,...(body?{body:JSON.stringify(body)}:{})})
 assert.equal(response.status,status,label)
 const data=await response.json()
 if(url.includes('/functions/'))assert.equal(response.headers.get('access-control-allow-origin'),'*')
 assert.ok(!/storage_path|sha256|cleanup_paths|fonts\//.test(JSON.stringify(data)))
 result.push({label,status:response.status})
}
const form=new FormData();form.set('action','font_save');form.set('file_0',new Blob(['not a font'],{type:'font/woff2'}),'test.woff2')
const denied=await fetch(endpoint,{method:'POST',headers:{apikey:headers.apikey},body:form});assert.equal(denied.status,401);result.push({label:'Anonymous multipart upload',status:denied.status})
const options=await fetch(endpoint,{method:'OPTIONS',headers:{Origin:'http://127.0.0.1:5173','Access-Control-Request-Method':'GET'}})
assert.equal(options.status,200);assert.equal(options.headers.get('access-control-allow-origin'),'*');assert.ok(options.headers.get('access-control-allow-methods').includes('GET'))
const content=await fetch(base+'/rest/v1/rpc/get_storefront_content',{method:'POST',headers,body:'{}'});assert.equal(content.status,200)
const data=await content.json();assert.ok(!/storage_path|sha256|mime_type|byte_size/.test(JSON.stringify(data.font_families)));result.push({label:'Minimal public storefront font payload',families:data.font_families.length})
const baseline=JSON.parse(fs.readFileSync('docs/backend/custom-font-privacy-hosted-verification.json')).content
const comparable=value=>({...value,updated_at:undefined})
assert.ok(isDeepStrictEqual(comparable(data),comparable(baseline)),'Hosted Website Editor content differs from the original snapshot')
result.push({label:'Exact original typography and otherwise unchanged Website Editor content',passed:true,ignored:'Monotonic top-level updated_at only'})
fs.writeFileSync('docs/backend/custom-font-hosted-public-results.json',JSON.stringify({edgeVersion:15,checks:result,cors:'PASS',authenticatedHostedAcceptance:'Super Admin lifecycle passed; ordinary Admin deferred; Customer session pending'},null,2)+'\n')
console.log('PASS hosted read-only public font delivery/security/CORS checks; no fixtures created')
