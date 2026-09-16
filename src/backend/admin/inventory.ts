import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../client'
import type { Database } from '../database.types'
import { allRows } from './editor'
import { getAdminAccess } from './role'
import { validateAllocation, type InventoryProduct } from './inventory-model'
const db:SupabaseClient<Database>=supabase
export async function loadInventory(userId:string):Promise<InventoryProduct[]>{
 if((await getAdminAccess(userId)).status!=='allowed')throw Error('Admin access required.')
 const [products,variants,units,colours,orders,images]=await Promise.all([
 allRows((a,b)=>db.from('products').select('*').order('id').range(a,b)),
 allRows((a,b)=>db.from('product_variants').select('*').order('id').range(a,b)),
 allRows((a,b)=>db.from('inventory_units').select('id,product_id,variant_id,sold_at,withdrawn_at').order('id').range(a,b)),
 allRows((a,b)=>db.from('colours').select('id,label').order('id').range(a,b)),
 allRows((a,b)=>db.from('order_items').select('id,product_id').order('id').range(a,b)),
 allRows((a,b)=>db.from('product_images').select('id,product_id,url,role,sort_order').order('id').range(a,b)),
 ])
 const colourMap=new Map(colours.map(c=>[c.id,c.label])),history=new Set(orders.map(o=>o.product_id))
 const counts=new Map<string,{allocated:number;sold:number;physical:number;withdrawn:number}>()
 for(const u of units){const c=counts.get(u.variant_id)??{allocated:0,sold:0,physical:0,withdrawn:0};c.allocated++;if(u.sold_at)c.sold++;if(u.withdrawn_at)c.withdrawn++;if(!u.sold_at&&!u.withdrawn_at)c.physical++;counts.set(u.variant_id,c)}
 return products.map(p=>{const pv=variants.filter(v=>v.product_id===p.id).map(v=>{const c=counts.get(v.id)??{allocated:0,sold:0,physical:0,withdrawn:0};return {...v,...c,colour:colourMap.get(v.colour_id)??'Unknown colour',available:p.status==='active'&&p.is_shop_available&&v.enabled?c.physical:0}});const sum=(key:'allocated'|'sold'|'physical'|'available')=>pv.reduce((n,v)=>n+v[key],0);const image=images.filter(i=>i.product_id===p.id&&!i.url.startsWith('storage://')).sort((a,b)=>Number(b.role==='primary')-Number(a.role==='primary')||a.sort_order-b.sort_order)[0];return {...p,variants:pv,allocated:sum('allocated'),sold:sum('sold'),physical:sum('physical'),available:sum('available'),remaining:p.production_limit-sum('allocated'),history:history.has(p.id),image:image?.url}})
}
export class AllocationFailure extends Error{constructor(message:string,public conflict=false){super(message)}}
export async function saveAllocation(p:InventoryProduct,values:Record<string,string>){
 if(Object.keys(validateAllocation(p,values).errors).length)throw new AllocationFailure('Review the allocation quantities.')
 const {error}=await supabase.rpc('allocate_product_run',{product_id:p.id,expected_updated_at:p.updated_at,allocations:p.variants.map(v=>({variant_id:v.id,quantity:Number(values[v.id])}))})
 if(error)throw new AllocationFailure(error.code==='PT409'?'Inventory was updated elsewhere.':'Allocation could not be saved. Reload to verify the latest inventory before retrying.',error.code==='PT409')
}
