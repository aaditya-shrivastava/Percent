import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../client'
import type { Database } from '../database.types'
import type { InventoryProduct, InventoryVariant } from './inventory-model'
import { adjustmentPreview, type AdjustmentForm } from './adjustment-model'
import { AllocationFailure } from './inventory'
const db:SupabaseClient<Database>=supabase
export async function adjustStock(p:InventoryProduct,v:InventoryVariant,f:AdjustmentForm){
 if(Object.keys(adjustmentPreview(p,v,f).errors).length)throw new AllocationFailure('Review the adjustment fields.')
 const {data,error}=await db.rpc('adjust_variant_inventory',{product_id:p.id,variant_id:v.id,operation:f.operation,quantity:Number(f.quantity),reason:f.reason,internal_note:f.note.trim()||undefined,expected_updated_at:p.updated_at})
 if(error){if(error.code==='PT409')throw new AllocationFailure('Inventory was updated elsewhere.',true);if(error.code==='42501')throw new AllocationFailure('Admin access is required.');throw new AllocationFailure('Adjustment could not be confirmed. Reload Latest before retrying; inventory may have changed.',true)}
 if(!data)throw new AllocationFailure('Adjustment response unavailable. Reload Latest before retrying.',true)
}
export const historyPageSize=25
export async function loadAdjustmentHistory(variantIds:string[],page:number,operation:string){
 if(!variantIds.length)return {rows:[],total:0}
 let request=db.from('inventory_adjustment_operations').select('*',{count:'exact'}).in('variant_id',variantIds).order('created_at',{ascending:false}).order('id',{ascending:false})
 if(operation!=='all')request=request.eq('operation',operation)
 const {data,error,count}=await request.range(page*historyPageSize,(page+1)*historyPageSize-1)
 if(error||!data)throw Error('Unable to load inventory history.')
 const actorIds=[...new Set(data.map(o=>o.actor_id))]
 const profiles=actorIds.length?await db.from('profiles').select('id,display_name').in('id',actorIds):{data:[],error:null}
 const names=new Map(profiles.data?.map(p=>[p.id,p.display_name]))
 return {rows:data.map(o=>({...o,actorName:names.get(o.actor_id)||o.actor_id})),total:count??0}
}
export type AdjustmentHistory=Awaited<ReturnType<typeof loadAdjustmentHistory>>

