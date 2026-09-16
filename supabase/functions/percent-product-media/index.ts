import { createClient } from 'npm:@supabase/supabase-js@2.99.1'
import type { Database, Json } from '../_shared/database.types.ts'

const bucket='percent-product-images'
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'}
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}})
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
const allowed=(obj:Record<string,unknown>,keys:string[])=>Object.keys(obj).every(k=>keys.includes(k))
const productFields=['name','slug','design_code','short_description','full_description','price_paise','compare_at_price_paise','category_id','fit_type','production_limit','material','style','care_instructions','shipping_and_returns'] as const
type Image=Database['public']['Tables']['product_images']['Row']
async function all<T>(read:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:unknown}>){
 const rows:T[]=[]
 for(let from=0;;from+=500){const result=await read(from,from+499);if(result.error||!result.data)throw new Error('Metadata unavailable');rows.push(...result.data);if(result.data.length<500)return rows}
}
const pathOf=(image:Pick<Image,'url'>,productId:string)=>{
 const prefix=`storage://${bucket}/`
 const path=image.url.startsWith(prefix)?image.url.slice(prefix.length):null
 return path&&new RegExp(`^products/${productId}/[0-9a-f]{64}\\.(jpg|png|webp)$`).test(path)?path:null
}

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
 if(req.method!=='POST')return reply({error:'Method not allowed'},405)
 const url=Deno.env.get('SUPABASE_URL')!
 if(new URL(url).hostname!=='gijyjdeohvdrnvqfqdha.supabase.co')return reply({error:'Project mismatch'},503)
 const token=req.headers.get('Authorization')?.replace(/^Bearer /i,'')
 if(!token)return reply({error:'Authentication required'},401)
 const privileged=createClient<Database>(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}})
 const {data:{user},error:authError}=await privileged.auth.getUser(token)
 if(authError||!user)return reply({error:'Authentication required'},401)
 const caller=createClient<Database>(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false}})
 const {data:role,error:roleError}=await caller.rpc('get_my_role')
 if(roleError||!['admin','super_admin'].includes(role))return reply({error:'Admin access required'},403)
 try{
  let input:Record<string,unknown>,file:File|undefined
  if(req.headers.get('content-type')?.includes('multipart/form-data')){
   if(Number(req.headers.get('content-length')??0)>11*1024*1024)return reply({error:'Image exceeds 10 MB'},413)
   const form=await req.formData();input={}
   for(const [key,value] of form.entries()){if(key in input)return reply({error:'Duplicate request field'},400);input[key]=value}
   if(!allowed(input,['action','product_id','request_id','expected_updated_at','file','alt','width','height']))return reply({error:'Unsupported request field'},400)
   if(input.file instanceof File)file=input.file
  }else{
   const raw:unknown=await req.json()
   if(!raw||typeof raw!=='object'||Array.isArray(raw))return reply({error:'Invalid request'},400)
   input=raw as Record<string,unknown>
   if(!allowed(input,['action','product_id','image_id','expected_updated_at','orphan_path']))return reply({error:'Unsupported request field'},400)
  }
  if(!uuid(input.product_id))return reply({error:'Invalid product'},400)
  const productId=input.product_id
  const {data:product,error:productError}=await caller.from('products').select('*').eq('id',productId).single()
  if(productError||!product)return reply({error:'Product unavailable'},404)
  const images=await all((a,b)=>caller.from('product_images').select('*').eq('product_id',productId).order('sort_order').range(a,b))
  if(input.action==='read'){
   const delivered=[]
   for(const image of images){
    const path=pathOf(image,productId)
    if(!path){delivered.push({id:image.id,url:image.url});continue}
    const {data,error}=await privileged.storage.from(bucket).createSignedUrl(path,300)
    delivered.push({id:image.id,url:error?null:data.signedUrl,missing:!!error})
   }
   return reply({images:delivered,expires_in:300})
  }
  if(product.status!=='draft'||product.sold_out_at)return reply({error:'Editable draft required'},409)
  // Metadata mutations use the same caller-rights transactional RPC as the editor.
  const saveImages=async(next:Image[])=>{
   const [variants,tags,links]=await Promise.all([
    all((a,b)=>caller.from('product_variants').select('id,colour_id,size,sku,price_paise,compare_at_price_paise,enabled').eq('product_id',productId).order('id').range(a,b)),
    all((a,b)=>caller.from('product_tags').select('tag_id').eq('product_id',productId).order('tag_id').range(a,b)),
    all((a,b)=>caller.from('variant_images').select('variant_id,image_id,sort_order').eq('product_id',productId).order('variant_id').order('image_id').range(a,b)),
   ])
   const fields=Object.fromEntries(productFields.map(key=>[key,product[key]]))
   const draft:Json={product:fields,variants,tags:tags.map(t=>t.tag_id),images:next.map(({id,url,alt,width,height,role,sort_order})=>({id,url,alt,width,height,role,sort_order})),variant_images:links.filter(l=>next.some(i=>i.id===l.image_id))}
   const result=await caller.rpc('save_product_draft',{product_id:productId,expected_updated_at:product.updated_at,draft})
   if(result.error)throw result.error
   return result.data
  }
  if(input.action==='cleanup'){
   // Recovery only for a generated object in this product; never arbitrary paths.
   if(typeof input.orphan_path!=='string'||!new RegExp(`^products/${productId}/[0-9a-f]{64}\\.(jpg|png|webp)$`).test(input.orphan_path))return reply({error:'Invalid recovery object'},400)
   if(images.some(i=>i.url===`storage://${bucket}/${input.orphan_path}`))return reply({error:'Image is associated; use image deletion'},409)
   const {error}=await privileged.storage.from(bucket).remove([input.orphan_path])
   return error?reply({error:'Cleanup pending; retry',orphan_path:input.orphan_path},409):reply({cleaned:true})
  }
  if(input.action==='delete'){
   if(!uuid(input.image_id))return reply({error:'Invalid image'},400)
   const image=images.find(i=>i.id===input.image_id)
   if(!image)return reply({deleted:true}) // a retry after completed deletion
   if(input.expected_updated_at!==product.updated_at)return reply({error:'Product changed; reload before deleting'},409)
   const path=pathOf(image,productId)
   if(path){const {error}=await privileged.storage.from(bucket).remove([path]);if(error)return reply({error:'Storage deletion failed; retry'},409)}
   // Keep the known relation if DB save fails, allowing the same delete to retry.
   try{const result=await saveImages(images.filter(i=>i.id!==image.id));return reply({deleted:true,saved:result})}
   catch{return reply({error:'Metadata cleanup pending; reload and retry deletion',image_id:image.id,cleanup_pending:true},409)}
  }
  if(input.action!=='upload'||!file||!uuid(input.request_id))return reply({error:'Invalid upload request'},400)
  if(file.size===0||file.size>10*1024*1024)return reply({error:'Choose a non-empty image up to 10 MB'},413)
  const bytes=new Uint8Array(await file.arrayBuffer())
  const png=bytes.length>=24&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)
  const jpeg=bytes.length>4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes.at(-2)===255&&bytes.at(-1)===217
  const webp=bytes.length>=20&&new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP'
  const mime=png?'image/png':jpeg?'image/jpeg':webp?'image/webp':null
  if(!mime||file.type!==mime)return reply({error:'Invalid image content or MIME'},400)
  const width=Number(input.width),height=Number(input.height)
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<=0||height<=0||width>2147483647||height>2147483647)return reply({error:'Invalid image dimensions'},400)
  const contentHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('')
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${user.id}:${productId}:${input.request_id}:${contentHash}`)))).map(b=>b.toString(16).padStart(2,'0')).join('')
  const ext=mime==='image/jpeg'?'jpg':mime==='image/png'?'png':'webp'
  const path=`products/${productId}/${hash}.${ext}`,storedUrl=`storage://${bucket}/${path}`
  const already=images.find(i=>i.url===storedUrl)
  if(already)return reply({uploaded:true,image_id:already.id,replayed:true})
  if(input.expected_updated_at!==product.updated_at)return reply({error:'Product changed; reload before uploading'},409)
  const {error:uploadError}=await privileged.storage.from(bucket).upload(path,bytes,{contentType:mime,upsert:false})
  if(uploadError)return reply({error:'Upload incomplete or already in progress; reload and retry with the same request',orphan_path:path},409)
  const image:Image={id:crypto.randomUUID(),product_id:productId,url:storedUrl,alt:typeof input.alt==='string'?input.alt:product.name,width,height,role:images.length?'gallery':'primary',sort_order:images.reduce((max,i)=>Math.max(max,i.sort_order),-1)+1,created_at:new Date().toISOString()}
  try{const saved=await saveImages([...images,image]);return reply({uploaded:true,image_id:image.id,saved})}
  catch{
   const {error}=await privileged.storage.from(bucket).remove([path])
   return reply({error:error?'Association failed and object cleanup is pending; retry cleanup':'Association failed; uploaded object was removed',...(error?{orphan_path:path,cleanup_pending:true}:{cleaned:true})},409)
  }
 }catch{return reply({error:'Product media operation failed; retry'},400)}
})
