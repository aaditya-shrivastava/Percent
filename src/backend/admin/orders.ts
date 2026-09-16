import { supabase } from '../client'
import { getAdminAccess } from './role'
import { cleanOrderSearch, lifecycleErrorMessage, orderPageSize, validOrderId, type AdminOrder, type LifecycleDimension, type OrderFilters, type OrderHistoryRow } from './order-model'

const detailSelect='*,order_items(*),order_addresses(*)'
const fail=()=>new Error('Orders unavailable')

async function assertAdmin(userId:string){if((await getAdminAccess(userId)).status!=='allowed')throw fail()}

export async function loadOrderMetrics(userId:string,signal:AbortSignal){
  await assertAdmin(userId)
  const reads=await Promise.all([
    supabase.from('orders').select('id',{count:'exact',head:true}).abortSignal(signal),
    supabase.from('orders').select('id',{count:'exact',head:true}).in('status',['pending','confirmed']).abortSignal(signal),
    supabase.from('orders').select('id',{count:'exact',head:true}).eq('payment_status','paid').abortSignal(signal),
    supabase.from('orders').select('id',{count:'exact',head:true}).eq('fulfillment_status','delivered').abortSignal(signal),
  ])
  if(reads.some(read=>read.error||read.count===null))throw fail()
  return {total:reads[0].count!,open:reads[1].count!,paid:reads[2].count!,fulfilled:reads[3].count!}
}

export async function listAdminOrders(userId:string,filters:OrderFilters,page:number,signal:AbortSignal){
  await assertAdmin(userId)
  const search=cleanOrderSearch(filters.search)
  let matchedIds:string[]|undefined
  if(search){
    const pattern=`%${search}%`
    const reads=await Promise.all([
      supabase.from('orders').select('id').ilike('order_reference',pattern).limit(500).abortSignal(signal),
      supabase.from('order_addresses').select('order_id').ilike('full_name',pattern).limit(500).abortSignal(signal),
      supabase.from('order_addresses').select('order_id').ilike('email',pattern).limit(500).abortSignal(signal),
      supabase.from('order_addresses').select('order_id').ilike('phone',pattern).limit(500).abortSignal(signal),
    ])
    if(reads.some(read=>read.error))throw fail()
    matchedIds=[...new Set(reads.flatMap((read,index)=>(read.data??[]).map(row=>index?('order_id' in row?row.order_id:''):('id' in row?row.id:'')).filter(Boolean)))]
    if(!matchedIds.length)return {orders:[],count:0}
  }
  let query=supabase.from('orders').select(detailSelect,{count:'exact'})
  if(matchedIds)query=query.in('id',matchedIds)
  if(filters.status!=='all')query=query.eq('status',filters.status)
  if(filters.payment!=='all')query=query.eq('payment_status',filters.payment)
  if(filters.fulfillment!=='all')query=query.eq('fulfillment_status',filters.fulfillment)
  const sort=filters.sort==='oldest'?['created_at',true]:filters.sort==='highest'?['total_paise',false]:filters.sort==='lowest'?['total_paise',true]:['created_at',false]
  const from=(Math.max(1,page)-1)*orderPageSize
  const {data,error,count}=await query.order(sort[0] as 'created_at',{ascending:sort[1] as boolean}).order('id').range(from,from+orderPageSize-1).abortSignal(signal)
  if(error||!data||count===null)throw fail()
  return {orders:data as unknown as AdminOrder[],count}
}

export async function loadAdminOrder(userId:string,id:string,signal:AbortSignal){
  if(!validOrderId(id))return null
  await assertAdmin(userId)
  const {data,error}=await supabase.from('orders').select(detailSelect).eq('id',id).abortSignal(signal).maybeSingle()
  if(error)throw fail()
  return data as unknown as AdminOrder|null
}

export async function loadOrderHistory(userId:string,id:string,signal:AbortSignal):Promise<OrderHistoryRow[]>{
 if(!validOrderId(id))return []
 await assertAdmin(userId)
 const rows:Omit<OrderHistoryRow,'actor_name'>[]=[]
 for(let from=0;;from+=500){
  const {data,error}=await supabase.from('order_lifecycle_history').select('*').eq('order_id',id).order('created_at').order('id').range(from,from+499).abortSignal(signal)
  if(error||!data)throw fail()
  rows.push(...data)
  if(data.length<500)break
 }
 const ids=[...new Set(rows.map(row=>row.actor_id))]
 if(!ids.length)return []
 const {data:profiles,error}=await supabase.from('profiles').select('id,display_name').in('id',ids).abortSignal(signal)
 if(error)throw fail()
 const names=new Map((profiles??[]).map(p=>[p.id,p.display_name]))
 return rows.map(row=>({...row,actor_name:names.get(row.actor_id)??'Former administrator'}))
}

export class OrderConflict extends Error {constructor(){super('Order was updated elsewhere. Reload latest data or stay on this page.')}}
export async function updateOrderLifecycle(userId:string,order:AdminOrder,dimension:LifecycleDimension,next:string,reason:string,internalNote:string){
 await assertAdmin(userId)
 const {error}=await supabase.rpc('update_order_lifecycle',{order_id:order.id,dimension,next_status:next,expected_updated_at:order.updated_at,reason:reason.trim()||undefined,internal_note:internalNote.trim()||undefined})
 if(error){if(error.code==='PT409')throw new OrderConflict();throw new Error(lifecycleErrorMessage(error))}
}
