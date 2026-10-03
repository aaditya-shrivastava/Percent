/* eslint-disable @typescript-eslint/no-explicit-any */
import { fontUuid, FONT_LIMIT, isCanonicalFontFace, validateFontUpload, type ManagedFontFace } from './font-validation.ts'
import { decodeWoff2 } from './font-decoder.ts'

const BUCKET='percent-website-media'
export const fontCors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, if-none-match','Access-Control-Allow-Methods':'GET, HEAD, POST, OPTIONS','Access-Control-Expose-Headers':'ETag, Cache-Control, Content-Type, Content-Length'}
const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{...fontCors,'Content-Type':'application/json','Cache-Control':'no-store'}})
class FontError extends Error{constructor(message:string,public status=400,public code='FONT_INVALID'){super(message)}}
function rpcError(error:any):never{
  if(error?.code==='PT409')throw new FontError('This font changed elsewhere. Reload before saving again.',409,'PT409')
  if(error?.code==='23505')throw new FontError('A family with this name already exists.',409,'FONT_DUPLICATE')
  if(error?.code==='42501')throw new FontError('Admin access required.',403)
  if(String(error?.message).includes('currently used')||String(error?.message).includes('live')||String(error?.message).includes('in use'))throw new FontError('This font is in use. Choose another storefront font before changing its faces, disabling or deleting it.',409)
  throw new FontError('The font could not be saved. Check its name, faces and license confirmation.',400)
}
async function catalog(service:any){const {data,error}=await service.rpc('get_website_font_management_catalog');if(error||!Array.isArray(data))throw new FontError('Font library unavailable. Try again later.',503);return data as any[]}
const safeCatalog=(families:any[])=>families.map(f=>({id:f.id,family_name:f.family_name,enabled:f.enabled,created_at:f.created_at,updated_at:f.updated_at,in_use:f.in_use,faces:f.faces.map((x:any)=>({asset_id:x.asset_id,weight:x.weight,style:x.style}))}))
const sha=async(bytes:Uint8Array)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes)))].map(v=>v.toString(16).padStart(2,'0')).join('')
function validStored(face:any){const match=/^fonts\/([0-9a-f-]{36})\//.exec(String(face.storage_path));return !!match&&isCanonicalFontFace(match[1],face)}
async function download(service:any,face:any){
  if(!validStored(face))throw new FontError('Font unavailable.',404)
  const {data,error}=await service.storage.from(BUCKET).download(face.storage_path)
  if(error||!data)throw new FontError('Font unavailable.',404)
  const bytes=new Uint8Array(await data.arrayBuffer())
  if(bytes.length!==face.byte_size||await sha(bytes)!==face.sha256)throw new FontError('Font unavailable.',503)
  return bytes
}
const cache=new Map<string,{bytes:Uint8Array;used:number}>()
function cacheBytes(id:string,bytes:Uint8Array){
  cache.set(id,{bytes,used:Date.now()})
  let size=[...cache.values()].reduce((sum,x)=>sum+x.bytes.length,0)
  while(size>8*1024*1024||cache.size>16){const oldest=[...cache].sort((a,b)=>a[1].used-b[1].used)[0];if(!oldest)break;cache.delete(oldest[0]);size-=oldest[1].bytes.length}
}
export async function fontDelivery(req:Request,service:any){
  try{
    const url=new URL(req.url),id=url.searchParams.get('font')??''
    if([...url.searchParams.keys()].length!==1||!fontUuid.test(id))return reply({error:'Provide one valid font asset ID.'},400)
    const {data:asset,error}=await service.rpc('get_website_font_delivery_asset',{p_asset_id:id})
    if(error)return reply({error:'Font delivery temporarily unavailable.'},503)
    if(!asset||asset.asset_id!==id)return reply({error:'Font not found.'},404)
    // The resolver intentionally returns only server metadata; parse family/face
    // from its authoritative canonical path, never from request parameters.
    const match=/^fonts\/([0-9a-f-]{36})\/(\d+)-(normal|italic)-[0-9a-f]{64}\.woff2$/.exec(asset.storage_path)
    if(!match||!validStored({...asset,weight:Number(match[2]),style:match[3]}))return reply({error:'Font unavailable.'},404)
    const headers={...fontCors,'Content-Type':'font/woff2','Cache-Control':'public, max-age=31536000, immutable','ETag':`"${id}"`,'X-Content-Type-Options':'nosniff'}
    if(req.headers.get('if-none-match')===headers.ETag)return new Response(null,{status:304,headers})
    if(req.method==='HEAD')return new Response(null,{headers:{...headers,'Content-Length':String(asset.byte_size)}})
    const cached=cache.get(id)
    if(cached)cached.used=Date.now()
    const bytes=cached?.bytes??await download(service,{...asset,weight:Number(match[2]),style:match[3]})
    if(!cached)cacheBytes(id,bytes)
    return new Response(bytes,{headers:{...headers,'Content-Length':String(bytes.length)}})
  }catch(error){return reply({error:error instanceof FontError?error.message:'Font delivery temporarily unavailable.'},error instanceof FontError?error.status:503)}
}
async function cleanup(service:any,familyId:string,paths?:string[]){
  if(!fontUuid.test(familyId))throw new FontError('Invalid font family.')
  const families=await catalog(service),used=new Set(families.flatMap(f=>f.faces.map((x:any)=>x.storage_path)))
  let candidates=paths??[]
  if(!paths){
    const found:string[]=[]
    for(let offset=0;offset<5000;offset+=1000){const {data,error}=await service.storage.from(BUCKET).list(`fonts/${familyId}`,{limit:1000,offset});if(error)throw new FontError('Unused font files could not be removed. Try cleanup again.',503);for(const x of data??[])if(x.id)found.push(`fonts/${familyId}/${x.name}`);if((data??[]).length<1000)break}
    candidates=found
  }
  candidates=candidates.filter(path=>new RegExp(`^fonts/${familyId}/[1-9]00-(normal|italic)-[0-9a-f]{64}\\.woff2$`).test(path)&&!used.has(path))
  for(let i=0;i<candidates.length;i+=100){const {error}=await service.storage.from(BUCKET).remove(candidates.slice(i,i+100));if(error)throw new FontError('Unused font files could not be removed. Try cleanup again.',503)}
  return candidates.length
}
export async function fontAction(json:any,service:any,caller:any){
  try{
    const families=await catalog(service)
    if(json.action==='font_catalog')return reply({font_families:safeCatalog(families)})
    if(json.action==='font_preview'){
      const id=String(json.asset_id??'');if(!fontUuid.test(id))throw new FontError('Invalid font asset ID.')
      const face=families.flatMap(f=>f.faces).find(x=>x.asset_id===id)
      if(!face)throw new FontError('Font not found.',404)
      // Supabase FunctionsClient decodes octet-stream as Blob; font/woff2 would
      // be parsed as text and corrupt the authorized preview's binary bytes.
      return new Response(await download(service,face),{headers:{...fontCors,'Content-Type':'application/octet-stream','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
    }
    const id=String(json.family_id??'');if(!fontUuid.test(id))throw new FontError('Invalid font family.')
    if(json.action==='font_cleanup')return reply({removed:await cleanup(service,id)})
    const family=families.find(f=>f.id===id)
    if(!family)throw new FontError('Font family not found.',404)
    if(json.expected_updated_at!==family.updated_at)throw new FontError('This font changed elsewhere. Reload before saving again.',409,'PT409')
    if(json.action==='font_delete'){
      const {error}=await caller.rpc('delete_website_font_family',{p_family_id:id,p_expected_updated_at:json.expected_updated_at})
      if(error)rpcError(error)
      cache.clear()
      try{await cleanup(service,id)}catch{return reply({removed:true,warning:'Family deleted. Use Clean up unused files to retry removing its files.'})}
      return reply({removed:true,font_families:safeCatalog(await catalog(service))})
    }
    if(json.action==='font_toggle'){
      if(typeof json.enabled!=='boolean')throw new FontError('Choose enable or disable.')
      const faces=family.faces.map(({weight,style,storage_path,mime_type,byte_size,sha256}:any)=>({weight,style,storage_path,mime_type,byte_size,sha256}))
      const {error}=await caller.rpc('save_website_font_family',{p_family_id:id,p_family_name:family.family_name,p_enabled:json.enabled,p_license_confirmed:true,p_faces:faces,p_expected_updated_at:json.expected_updated_at})
      if(error)rpcError(error)
      return reply({font_families:safeCatalog(await catalog(service))})
    }
    throw new FontError('Unknown font action.')
  }catch(error){return reply({error:error instanceof FontError?error.message:'Font request failed. Try again.',code:error instanceof FontError?error.code:'FONT_ERROR'},error instanceof FontError?error.status:503)}
}
export async function fontSave(form:FormData,service:any,caller:any){
  const created:string[]=[],id=String(form.get('family_id')??'')
  try{
    const name=String(form.get('family_name')??'').trim().replace(/\s+/g,' '),expected=String(form.get('expected_updated_at')??'')||null
    if(!fontUuid.test(id)||name.length<1||name.length>80||[...name].some(character=>character.charCodeAt(0)<32||character.charCodeAt(0)===127))throw new FontError('Enter a family name between 1 and 80 characters.')
    if(form.get('license_confirmed')!=='true')throw new FontError('Confirm permission to use this font as a webfont.')
    if(!['true','false'].includes(String(form.get('enabled'))))throw new FontError('Choose an enabled state.')
    const families=await catalog(service),current=families.find(f=>f.id===id)
    if((current?.updated_at??null)!==expected)throw new FontError('This font changed elsewhere. Reload before saving again.',409,'PT409')
    if(families.some(f=>f.id!==id&&f.family_name.trim().replace(/\s+/g,' ').toLowerCase()===name.toLowerCase()))throw new FontError('A family with this name already exists.',409)
    let entries:any[]
    try{entries=JSON.parse(String(form.get('faces')??''))}catch{throw new FontError('Add valid font files.')}
    if(!Array.isArray(entries)||entries.length<1||entries.length>18)throw new FontError('Add between 1 and 18 font faces.')
    const pairs=new Set<string>(),faces:ManagedFontFace[]=[],uploads:{face:ManagedFontFace;file:File}[]=[]
    for(let i=0;i<entries.length;i++){
      const item=entries[i],pair=`${item.weight}:${item.style}`
      if(pairs.has(pair))throw new FontError('Each weight and style can appear only once.');pairs.add(pair)
      const file=form.get(`file_${i}`)
      if(file instanceof File){
        if(current?.in_use&&current.faces.some((x:any)=>x.weight===item.weight&&x.style===item.style))throw new FontError('This face is in use. Choose another storefront font before replacing it.',409)
        if(file.size>FONT_LIMIT)throw new FontError('Font files must be 2 MB or smaller.',413)
        const face=await validateFontUpload(file,id,Number(item.weight),String(item.style),decodeWoff2)
        faces.push(face);uploads.push({face,file})
      }else{
        const old=current?.faces.find((x:any)=>x.asset_id===item.asset_id&&x.weight===item.weight&&x.style===item.style)
        if(!old)throw new FontError('Choose a file for each new face.')
        faces.push({weight:old.weight,style:old.style,storage_path:old.storage_path,mime_type:old.mime_type,byte_size:old.byte_size,sha256:old.sha256})
      }
    }
    if([...form.keys()].some(key=>key.startsWith('file_')&&!uploads.some(x=>form.get(key)===x.file)))throw new FontError('Unexpected font file.')
    // Validate every face before uploading any bytes; canonical objects are immutable.
    for(const {face,file} of uploads){
      const {error}=await service.storage.from(BUCKET).upload(face.storage_path,file,{contentType:'font/woff2',upsert:false,cacheControl:'31536000'})
      if(error){const existing=await download(service,face);if(existing.length!==face.byte_size)throw new FontError('Font upload failed.',503)}else created.push(face.storage_path)
    }
    const {error}=await caller.rpc('save_website_font_family',{p_family_id:id,p_family_name:name,p_enabled:form.get('enabled')==='true',p_license_confirmed:true,p_faces:faces,p_expected_updated_at:expected})
    if(error)rpcError(error)
    let warning:string|undefined
    try{await cleanup(service,id)}catch{warning='Font saved. Clean up unused files to retry removing older files.'}
    return reply({font_families:safeCatalog(await catalog(service)),warning})
  }catch(error){
    if(created.length)try{await cleanup(service,id,created)}catch{/* Never delete a now-referenced object; cleanup can be retried. */}
    return reply({error:error instanceof FontError?error.message:error instanceof Error&&/WOFF2|Font files|webfont|family, weight/.test(error.message)?error.message:'Font upload failed. Try again.',code:error instanceof FontError?error.code:'FONT_INVALID'},error instanceof FontError?error.status:400)
  }
}
