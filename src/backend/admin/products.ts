import { supabase } from '../client'
import { getAdminAccess } from './role'
import { imageDelivery } from './editor'
import { canArchive, runMetrics, type AdminProduct } from './product-model'

async function all<T>(read:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:unknown}>) {
  const rows:T[]=[]
  for(let from=0;;from+=500){const result=await read(from,from+499);if(result.error||!result.data)throw new Error('Unable to load products');rows.push(...result.data);if(result.data.length<500)return rows}
}
export async function listAdminProducts(userId:string,signal:AbortSignal):Promise<AdminProduct[]> {
  if((await getAdminAccess(userId)).status!=='allowed')throw new Error('Access denied')
  const [products,variants,images,units,categories,tags,links]=await Promise.all([
    all((a,b)=>supabase.from('products').select('id,name,slug,design_code,status,category_id,fit_type,price_paise,production_limit,is_visible,is_shop_available,created_at,updated_at,sold_out_at').order('id').range(a,b).abortSignal(signal)),
    all((a,b)=>supabase.from('product_variants').select('id,product_id,sku,size,price_paise,enabled').order('id').range(a,b).abortSignal(signal)),
    all((a,b)=>supabase.from('product_images').select('id,product_id,url,alt,role,sort_order').order('id').range(a,b).abortSignal(signal)),
    all((a,b)=>supabase.from('inventory_units').select('id,product_id,variant_id,sold_at,withdrawn_at').order('id').range(a,b).abortSignal(signal)),
    all((a,b)=>supabase.from('categories').select('id,name,active').order('id').range(a,b).abortSignal(signal)),
    all((a,b)=>supabase.from('tags').select('id,name,slug').order('id').range(a,b).abortSignal(signal)),
    all((a,b)=>supabase.from('product_tags').select('product_id,tag_id').order('product_id').order('tag_id').range(a,b).abortSignal(signal)),
  ])
  const delivered=new Map<string,string>()
  await Promise.all(products.filter(p=>images.some(i=>i.product_id===p.id&&i.url.startsWith('storage://'))).map(async p=>{try{for(const image of await imageDelivery(p.id))if(image.url)delivered.set(image.id,image.url)}catch{/* Thumbnail fallback remains available. */}}))
  return products.map(p=>{
    const pv=variants.filter(v=>v.product_id===p.id),enabled=new Set(pv.filter(v=>v.enabled).map(v=>v.id)),pu=units.filter(u=>u.product_id===p.id)
    const sold=pu.filter(u=>u.sold_at).length
    const image=images.filter(i=>i.product_id===p.id).sort((a,b)=>Number(b.role==='primary')-Number(a.role==='primary')||a.sort_order-b.sort_order)[0]
    const eligible=pu.filter(u=>!u.sold_at&&!u.withdrawn_at&&enabled.has(u.variant_id)).length,category=categories.find(c=>c.id===p.category_id)
    return {...p,category:category?.name??'Uncategorized',categoryActive:!!category?.active,primaryImageUrl:image?.url,image:image?{...image,url:delivered.get(image.id)??image.url}:undefined,variants:pv.length,enabledVariants:enabled.size,invalidEnabledVariants:pv.filter(v=>v.enabled&&(!v.sku.trim()||!v.size.trim()||v.price_paise<=0)).length,skus:pv.map(v=>v.sku),tags:links.filter(l=>l.product_id===p.id).flatMap(l=>tags.filter(t=>t.id===l.tag_id).flatMap(t=>[t.name,t.slug])),sold,allocated:pu.length,eligible,
      available:p.status==='active'&&p.is_shop_available?pu.filter(u=>!u.sold_at&&!u.withdrawn_at&&enabled.has(u.variant_id)).length:0,
      remaining:runMetrics(p.production_limit,sold).remaining,displayStatus:sold>=p.production_limit?'sold-out':p.status}
  })
}
export async function archiveAdminProduct(userId:string,product:AdminProduct) {
  if(!canArchive(product)||(await getAdminAccess(userId)).status!=='allowed')throw new Error('Archive unavailable')
  // Existing RLS and deferred run-completeness trigger enforce the write. The
  // timestamp condition refuses stale rows rather than overwriting newer work.
  const {data,error}=await supabase.from('products').update({status:'archived',archived_at:new Date().toISOString(),is_visible:false,is_shop_available:false}).eq('id',product.id).eq('updated_at',product.updated_at).neq('status','archived').select('id')
  if(error||data?.length!==1)throw new Error('Archive unavailable')
}
