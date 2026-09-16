import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../client'
import type { Database } from '../database.types'
import { blankEditor, editorPayload, type EditorForm, type Row } from './editor-model'
const db:SupabaseClient<Database>=supabase
export async function allRows<T>(read:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:unknown}>){const rows:T[]=[];for(let a=0;;a+=500){const r=await read(a,a+499);if(r.error||!r.data)throw Error('Unable to load product data.');rows.push(...r.data);if(r.data.length<500)return rows}}
export async function loadEditor(id?:string){
 const [categories,tags,colours]=await Promise.all([
  allRows((a,b)=>db.from('categories').select('*').order('id').range(a,b)),
  allRows((a,b)=>db.from('tags').select('*').order('id').range(a,b)),
  allRows((a,b)=>db.from('colours').select('*').order('id').range(a,b)),
 ])
 let product:Row<'products'>|null=null,form=blankEditor(),allocated=0,sold=0,available=0,eligible=0
 if(id){
  const p=await db.from('products').select('*').eq('id',id).single();if(p.error||!p.data)throw Error('Product unavailable.');product=p.data
  const [variants,images,links,tagLinks,units,history]=await Promise.all([
   allRows((a,b)=>db.from('product_variants').select('*').eq('product_id',id).order('id').range(a,b)),
   allRows((a,b)=>db.from('product_images').select('id,url,alt,width,height,role,sort_order').eq('product_id',id).order('sort_order').range(a,b)),
   allRows((a,b)=>db.from('variant_images').select('variant_id,image_id,sort_order').eq('product_id',id).order('variant_id').order('image_id').range(a,b)),
   allRows((a,b)=>db.from('product_tags').select('tag_id').eq('product_id',id).order('tag_id').range(a,b)),
   allRows((a,b)=>db.from('inventory_units').select('id,variant_id,sold_at,withdrawn_at').eq('product_id',id).order('id').range(a,b)),
   allRows((a,b)=>db.from('order_items').select('id,variant_id').eq('product_id',id).order('id').range(a,b)),
  ])
  const locked=new Set([...units,...history].map(u=>u.variant_id));allocated=units.length;sold=units.filter(u=>u.sold_at).length
  eligible=units.filter(u=>!u.sold_at&&!u.withdrawn_at&&variants.some(v=>v.id===u.variant_id&&v.enabled)).length
  available=product.status==='active'&&product.is_shop_available?eligible:0
  form={name:product.name,slug:product.slug,design_code:product.design_code,short_description:product.short_description,full_description:product.full_description,price:String(product.price_paise/100),compare:product.compare_at_price_paise===null?'':String(product.compare_at_price_paise/100),category_id:product.category_id??'',fit_type:product.fit_type,production_limit:String(product.production_limit),material:product.material??'',style:product.style??'',care_instructions:product.care_instructions??'',shipping_and_returns:product.shipping_and_returns??'',tags:tagLinks.map(t=>t.tag_id),images,variant_images:links,variants:variants.map(v=>({id:v.id,colour_id:v.colour_id,size:v.size,sku:v.sku,price:String(v.price_paise/100),compare:v.compare_at_price_paise===null?'':String(v.compare_at_price_paise/100),enabled:v.enabled,persisted:true,locked:locked.has(v.id)}))}
 }
 return {product,form,categories,tags,colours,allocated,sold,available,eligible}
}
export type EditorData=Awaited<ReturnType<typeof loadEditor>>
export class EditorFailure extends Error {constructor(message:string,public conflict=false){super(message)}}
export async function saveEditor(form:EditorForm,product:Row<'products'>|null){
 const {data,error}=await db.rpc('save_product_draft',{draft:editorPayload(form),...(product?{product_id:product.id,expected_updated_at:product.updated_at}:{})})
 if(error){if(error.code==='PT409')throw new EditorFailure('This product was updated elsewhere. Reload latest data or stay on this page to keep your changes.',true);if(error.code==='23505')throw new EditorFailure('A slug, design code, SKU or variant combination already exists. Review those values.');throw new EditorFailure('Unable to save. Check the fields and current product eligibility, then retry.')}
 if(!data||typeof data!=='object'||Array.isArray(data)||typeof data.id!=='string')throw new EditorFailure('Save response unavailable. Check Products before retrying a new draft.')
 return data.id
}
export async function publishProduct(productId:string,expectedUpdatedAt:string){
 const {data,error}=await db.rpc('publish_product',{product_id:productId,expected_updated_at:expectedUpdatedAt})
 if(error){if(error.code==='PT409')throw new EditorFailure('This product was updated elsewhere. Reload latest data or stay on this page.',true);throw new EditorFailure(error.message||'Publication requirements changed. Reload and review readiness.')}
 return data
}
export interface MediaResult {images?:{id:string;url:string|null}[];error?:string;orphan_path?:string;cleanup_pending?:boolean;cleaned?:boolean}
export class MediaFailure extends Error {constructor(public result:MediaResult){super(result.error??'Image operation failed. Please retry.')}}
export async function productMedia(body:FormData|Record<string,string>):Promise<MediaResult>{
 const {data,error}=await supabase.functions.invoke('percent-product-media',{body})
 if(error){let result:MediaResult={error:'Image operation failed. Reload and retry.'};if(error.context instanceof Response){try{result=await error.context.json()}catch{/* Keep safe fallback. */}}throw new MediaFailure(result)}
 return data as MediaResult
}
export async function imageDelivery(id:string){return (await productMedia({action:'read',product_id:id})).images??[]}
export async function uploadProductImage(id:string,version:string,file:File,requestId:string){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||!file.size||file.size>10*1024*1024)throw new MediaFailure({error:'Choose a JPG, PNG or WebP image up to 10 MB.'})
 let bitmap:ImageBitmap
 try{bitmap=await createImageBitmap(file)}catch{throw new MediaFailure({error:'This image could not be decoded. Choose a valid image.'})}
 const form=new FormData();Object.entries({action:'upload',product_id:id,expected_updated_at:version,request_id:requestId,alt:file.name,width:String(bitmap.width),height:String(bitmap.height)}).forEach(([k,v])=>form.set(k,v));bitmap.close();form.set('file',file)
 return productMedia(form)
}
