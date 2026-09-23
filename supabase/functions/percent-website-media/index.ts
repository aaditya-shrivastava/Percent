/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from 'npm:@supabase/supabase-js@2.99.1'

const PROJECT_HOST='gijyjdeohvdrnvqfqdha.supabase.co'
const BUCKET='percent-website-media'
const MAX_BYTES=10*1024*1024
const sections=new Set(['limited_editions','best_sellers','trending','new_arrivals','oversized_fit','shop_by_design','brand_story'])
const pageKeys=new Set(['shop','product_details','sold_out','about','contact','faq','policy_shipping','policy_returns','policy_privacy','policy_terms'])
const mediaPages=new Set(['about','contact'])
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'}
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}})
const validPath=(path:string)=>/^banners\/[0-9a-f-]{36}\/[0-9a-f]{64}\.(jpg|png|webp)$/.test(path)||/^sections\/(limited_editions|best_sellers|trending|new_arrivals|oversized_fit|shop_by_design|brand_story)\/[0-9a-f]{64}\.(jpg|png|webp)$/.test(path)||/^pages\/(about|contact)\/[0-9a-f]{64}\.(jpg|png|webp)$/.test(path)
const pathsFrom=(content:any)=>[...(content?.banners??[]).flatMap((b:any)=>[b.image_path,b.mobile_image_path]),...(content?.sections??[]).map((s:any)=>s.media_path)].filter((p:unknown):p is string=>typeof p==='string'&&validPath(p))
const pagePathsFrom=(content:any)=>[content?.media_path,...(content?.sections??[]).map((s:any)=>s.media_path)].filter((p:unknown):p is string=>typeof p==='string'&&validPath(p))
const pagePath=(path:string,page:string)=>validPath(path)&&path.startsWith(`pages/${page}/`)

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
 if(req.method!=='POST')return reply({error:'Method not allowed'},405)
 const url=Deno.env.get('SUPABASE_URL')!
 if(new URL(url).hostname!==PROJECT_HOST)return reply({error:'Project mismatch'},503)
 const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
 let json:any=null
 if(req.headers.get('content-type')?.includes('application/json'))try{json=await req.json()}catch{return reply({error:'Invalid request'},400)}
 const action=String(json?.action??'')
 if(action==='public_read'){
  const publicClient=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!)
  const {data:content,error}=await publicClient.rpc('get_storefront_content')
  if(error||!content)return reply({error:'Content unavailable'},503)
  const paths=[...new Set(pathsFrom(content))]
  const {data,error:signError}=paths.length?await service.storage.from(BUCKET).createSignedUrls(paths,300):{data:[],error:null}
  if(signError)return reply({error:'Media unavailable'},503)
  return reply({media:Object.fromEntries((data??[]).filter(item=>item.signedUrl).map(item=>[item.path,item.signedUrl]))})
 }
 if(action==='public_page_read'){
  const page=String(json?.page_key??'')
  if(!pageKeys.has(page))return reply({error:'Invalid page'},400)
  const publicClient=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!)
  const {data:content,error}=await publicClient.rpc('get_storefront_page',{p_page_key:page})
  if(error)return reply({error:'Content unavailable'},503)
  const paths=[...new Set(pagePathsFrom(content).filter(path=>pagePath(path,page)))]
  const {data,error:signError}=paths.length?await service.storage.from(BUCKET).createSignedUrls(paths,300):{data:[],error:null}
  if(signError)return reply({error:'Media unavailable'},503)
  return reply({media:Object.fromEntries((data??[]).filter(item=>item.signedUrl).map(item=>[item.path,item.signedUrl]))})
 }
 const token=req.headers.get('Authorization')?.replace(/^Bearer /i,'')
 if(!token)return reply({error:'Authentication required'},401)
 const {data:{user},error:authError}=await service.auth.getUser(token)
 if(authError||!user)return reply({error:'Authentication required'},401)
 const caller=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:`Bearer ${token}`}}})
 const {data:role,error:roleError}=await caller.rpc('get_my_role')
 if(roleError||!['admin','super_admin'].includes(role??''))return reply({error:'Admin access required'},403)
 if(action==='admin_read'){
  const {data:content,error}=await caller.rpc('get_website_editor')
  if(error)return reply({error:'Content unavailable'},503)
  const requested=Array.isArray(json?.paths)?json.paths.filter((p:unknown):p is string=>typeof p==='string'&&validPath(p)).slice(0,40):[]
  const paths=[...new Set([...pathsFrom(content),...requested])]
  const {data,error:signError}=paths.length?await service.storage.from(BUCKET).createSignedUrls(paths,300):{data:[],error:null}
  if(signError)return reply({error:'Media unavailable'},503)
  return reply({media:Object.fromEntries((data??[]).filter(item=>item.signedUrl).map(item=>[item.path,item.signedUrl]))})
 }
 if(action==='admin_page_read'){
  const page=String(json?.page_key??'')
  if(!pageKeys.has(page))return reply({error:'Invalid page'},400)
  const {data:content,error}=await caller.rpc('get_website_page_editor',{p_page_key:page})
  if(error)return reply({error:'Content unavailable'},503)
  const requested=Array.isArray(json?.paths)?json.paths.filter((path:unknown):path is string=>typeof path==='string'&&pagePath(path,page)).slice(0,30):[]
  const paths=[...new Set([...pagePathsFrom(content).filter(path=>pagePath(path,page)),...requested])]
  const {data,error:signError}=paths.length?await service.storage.from(BUCKET).createSignedUrls(paths,300):{data:[],error:null}
  if(signError)return reply({error:'Media unavailable'},503)
  return reply({media:Object.fromEntries((data??[]).filter(item=>item.signedUrl).map(item=>[item.path,item.signedUrl]))})
 }
 if(action==='cleanup'){
  const path=String(json?.path??'')
  if(!validPath(path))return reply({error:'Invalid media path'},400)
  const [primaryReference,mobileReference,sectionReference,pageReference,pageSectionReference]=await Promise.all([
   service.from('website_banners').select('id',{count:'exact',head:true}).eq('image_path',path),
   service.from('website_banners').select('id',{count:'exact',head:true}).eq('mobile_image_path',path),
   service.from('website_sections').select('section_key',{count:'exact',head:true}).eq('media_path',path),
   service.from('website_pages').select('page_key',{count:'exact',head:true}).eq('media_path',path),
   service.from('website_page_sections').select('section_key',{count:'exact',head:true}).eq('media_path',path),
  ])
  if(primaryReference.error||mobileReference.error||sectionReference.error||pageReference.error||pageSectionReference.error)return reply({error:'Unable to verify media references'},503)
  if((primaryReference.count??0)+(mobileReference.count??0)+(sectionReference.count??0)+(pageReference.count??0)+(pageSectionReference.count??0)>0)return reply({error:'Referenced media cannot be removed'},409)
  const {error}=await service.storage.from(BUCKET).remove([path])
  return error?reply({error:'Cleanup failed'},409):reply({removed:true})
 }
 if(Number(req.headers.get('content-length')??0)>MAX_BYTES+1024*1024)return reply({error:'Upload too large'},413)
 let form:FormData
 try{form=await req.formData()}catch{return reply({error:'Invalid upload'},400)}
 if(String(form.get('action')??'')!=='upload')return reply({error:'Unknown action'},400)
 const files=form.getAll('file').filter((value):value is File=>value instanceof File)
 if(files.length!==1)return reply({error:'Exactly one image is required'},400)
 const file=files[0]
 if(file.size<12||file.size>MAX_BYTES)return reply({error:'Image must be 10 MB or smaller'},400)
 const bytes=new Uint8Array(await file.arrayBuffer())
 const png=bytes.length>24&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n)
 const jpeg=bytes.length>4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes.at(-2)===255&&bytes.at(-1)===217
 const webp=bytes.length>12&&new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP'
 const mime=png?'image/png':jpeg?'image/jpeg':webp?'image/webp':null
 if(!mime||file.type!==mime)return reply({error:'Invalid image content'},400)
 const kind=String(form.get('target_kind')??'')
 const id=String(form.get('target_id')??'')
 const width=Number(form.get('width'))
 const height=Number(form.get('height'))
 if(!Number.isInteger(width)||width<1||width>12000||!Number.isInteger(height)||height<1||height>12000)return reply({error:'Invalid image dimensions'},400)
 if(kind==='banner'&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return reply({error:'Invalid banner id'},400)
 if(kind==='section'&&!sections.has(id))return reply({error:'Invalid section key'},400)
 if(kind==='page'&&!mediaPages.has(id))return reply({error:'Invalid page media target'},400)
 if(!['banner','section','page'].includes(kind))return reply({error:'Invalid media target'},400)
 const requestId=String(form.get('request_id')??crypto.randomUUID()).slice(0,128)
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${user.id}:${kind}:${id}:${requestId}:${await crypto.subtle.digest('SHA-256',bytes).then(b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join(''))}`))
 const hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')
 const ext=mime==='image/jpeg'?'jpg':mime.split('/')[1]
 const path=kind==='banner'?`banners/${id}/${hash}.${ext}`:kind==='section'?`sections/${id}/${hash}.${ext}`:`pages/${id}/${hash}.${ext}`
 const {error}=await service.storage.from(BUCKET).upload(path,bytes,{contentType:mime,upsert:false})
 if(error)return reply({error:'Upload failed'},409)
 const {data:signed,error:signError}=await service.storage.from(BUCKET).createSignedUrl(path,300)
 if(signError){await service.storage.from(BUCKET).remove([path]);return reply({error:'Upload preview failed'},409)}
 return reply({path,preview_url:signed.signedUrl,width,height})
})

