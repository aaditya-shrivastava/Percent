import assert from 'node:assert/strict'
import fs from 'node:fs'
const ids=process.argv.slice(2)
assert.ok(ids.length&&ids.every(id=>/^[0-9a-f-]{36}$/.test(id)))
const expected=fs.readFileSync('public/fonts/builtin/lora/lora-latin-wght-normal.woff2'),checks=[]
for(const id of ids){
 const url='https://gijyjdeohvdrnvqfqdha.supabase.co/functions/v1/percent-website-media?font='+id
 const response=await fetch(url,{headers:{Origin:'http://127.0.0.1:5173'}})
 assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'font/woff2');assert.equal(response.headers.get('access-control-allow-origin'),'*')
 assert.equal(response.headers.get('cache-control'),'public, max-age=31536000, immutable');assert.equal(response.headers.get('etag'),'"'+id+'"')
 assert.deepEqual(Buffer.from(await response.arrayBuffer()),expected)
 const headers=Object.fromEntries(response.headers)
 assert.ok(!/storage_path|sha256|storage\/v1|fonts\/|token=|signature=/.test(JSON.stringify(headers)))
 const head=await fetch(url,{method:'HEAD'});assert.equal(head.status,200);assert.equal(Number(head.headers.get('content-length')),expected.length)
 const conditional=await fetch(url,{headers:{'If-None-Match':'"'+id+'"'}});assert.equal(conditional.status,304)
 checks.push({asset_id:id,get:200,head:200,conditional:304,byteMatch:true,headers})
}
fs.writeFileSync('docs/backend/custom-font-real-hosted-delivery.json',JSON.stringify({authentication:'Anonymous public requests; active family uploaded through real Super Admin session',checks},null,2)+'\n')
console.log('PASS real hosted public WOFF2 bytes, opaque IDs, CORS/cache/ETag/HEAD/304; no credentials or Storage URLs')
