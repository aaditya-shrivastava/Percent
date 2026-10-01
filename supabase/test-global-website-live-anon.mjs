import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const env=Object.fromEntries((await readFile(new URL('../.env.local',import.meta.url),'utf8')).split(/\r?\n/).filter(line=>line&&!line.startsWith('#')&&line.includes('=')).map(line=>{const i=line.indexOf('=');return[line.slice(0,i),line.slice(i+1).replace(/^['"]|['"]$/g,'')]}))
const url=env.VITE_SUPABASE_URL,key=env.VITE_SUPABASE_PUBLISHABLE_KEY
assert.ok(url&&key,'Supabase public environment is required')
const headers={apikey:key,'content-type':'application/json'}
const contentResponse=await fetch(`${url}/rest/v1/rpc/get_storefront_content`,{method:'POST',headers,body:'{}'})
assert.equal(contentResponse.status,200)
const content=await contentResponse.json()
for(const field of ['navbar_items','branding','colors','typography','social_links'])assert.ok(Object.hasOwn(content.settings,field),`missing ${field}`)
const fn=`${url}/functions/v1/percent-website-media`
const publicResponse=await fetch(fn,{method:'POST',headers,body:JSON.stringify({action:'public_read'})})
assert.equal(publicResponse.status,200)
const publicMedia=await publicResponse.json();assert.equal(typeof publicMedia.media,'object')
for(const action of ['library_list','cleanup']){const response=await fetch(fn,{method:'POST',headers,body:JSON.stringify({action,path:'library/'+`${'a'.repeat(64)}.png`})});assert.equal(response.status,401,`${action} should require authentication`)}
console.log('PASS anonymous global settings read, public media signing, and Admin media-action denial')
