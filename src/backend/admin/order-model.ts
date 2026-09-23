import type { Database } from '../database.types'
import { formatInrFromPaise } from '../../data/money'

type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type OrderRow = Row<'orders'>
export type OrderItemRow = Row<'order_items'>
export type OrderAddressRow = Row<'order_addresses'>
export type AdminOrderRaw = OrderRow & {
 items?: unknown
 addresses?: unknown
 order_items?: unknown
 order_addresses?: unknown
}
export type OrderSort = 'newest'|'oldest'|'highest'|'lowest'
export interface OrderFilters { search:string; status:string; payment:string; fulfillment:string; sort:OrderSort }
export interface AdminOrder extends OrderRow { items:OrderItemRow[]; addresses:OrderAddressRow[] }
export const orderPageSize=25
export const emptyOrderFilters:OrderFilters={search:'',status:'all',payment:'all',fulfillment:'all',sort:'newest'}
export const orderStatuses=['pending','confirmed','cancelled','completed'] as const
export const paymentStatuses=['unpaid','pending','paid','failed','partially_refunded','refunded'] as const
export const fulfillmentStatuses=['unfulfilled','processing','shipped','out_for_delivery','delivered','cancelled','returned'] as const
export type LifecycleDimension='order_status'|'fulfillment_status'
export interface LifecycleAction {dimension:LifecycleDimension;next:string;label:string;significant:boolean}
export type OrderHistoryRow=Row<'order_lifecycle_history'> & {actor_name:string}

const rowArray=<T>(preferred:unknown,fallback:unknown):T[]=>{
 const value=Array.isArray(preferred)?preferred:Array.isArray(fallback)?fallback:[]
 return value.filter((row):row is T=>typeof row==='object'&&row!==null)
}

export function normalizeAdminOrder(value:unknown):AdminOrder|null{
 if(!value||typeof value!=='object')return null
 const raw=value as AdminOrderRaw
 if(typeof raw.id!=='string'||typeof raw.order_reference!=='string')return null
 return {
  ...raw,
  items:rowArray<OrderItemRow>(raw.items,raw.order_items),
  addresses:rowArray<OrderAddressRow>(raw.addresses,raw.order_addresses),
 }
}

export function normalizeAdminOrders(value:unknown):AdminOrder[]{
 if(!Array.isArray(value))return []
 return value.map(normalizeAdminOrder).filter((order):order is AdminOrder=>order!==null)
}

export function orderLifecycleActions(order:Pick<OrderRow,'status'|'payment_status'|'fulfillment_status'|'payment_provider'|'payment_reference'|'shipping_provider'|'tracking_number'|'delivered_at'>):LifecycleAction[]{
 if(order.status==='cancelled'||order.status==='completed')return []
 const actions:LifecycleAction[]=[]
 if(order.status==='pending')actions.push({dimension:'order_status',next:'confirmed',label:'Confirm Order',significant:true})
 if(order.status==='confirmed'&&order.fulfillment_status==='unfulfilled')actions.push({dimension:'fulfillment_status',next:'processing',label:'Start Internal Processing',significant:true})
 if(order.status==='confirmed'&&order.payment_status==='paid'&&order.payment_provider&&order.payment_reference&&order.fulfillment_status==='delivered'&&order.shipping_provider&&order.tracking_number&&order.delivered_at)actions.push({dimension:'order_status',next:'completed',label:'Complete Order',significant:true})
 if(['pending','confirmed'].includes(order.status)&&['unpaid','failed'].includes(order.payment_status)&&['unfulfilled','processing'].includes(order.fulfillment_status)&&!order.shipping_provider&&!order.tracking_number)actions.push({dimension:'order_status',next:'cancelled',label:'Cancel Order',significant:true})
 return actions
}

export const money = formatInrFromPaise
export function orderItemCount(order:Pick<AdminOrder,'items'>|{items?:OrderItemRow[]|null}){return (Array.isArray(order.items)?order.items:[]).reduce((sum,item)=>sum+item.quantity,0)}
export function shippingAddress(order:Pick<AdminOrder,'addresses'>|{addresses?:OrderAddressRow[]|null}){const addresses=Array.isArray(order.addresses)?order.addresses:[];return addresses.find(a=>a.kind==='shipping')??addresses[0]??null}
export function orderCustomer(order:Pick<AdminOrder,'addresses'>|{addresses?:OrderAddressRow[]|null}){const a=shippingAddress(order);return {name:a?.full_name??'Customer unavailable',email:a?.email??'',phone:a?.phone??''}}
export function orderMetrics(orders:Pick<OrderRow,'status'|'payment_status'|'fulfillment_status'>[]){return {total:orders.length,open:orders.filter(o=>!['completed','cancelled'].includes(o.status)).length,paid:orders.filter(o=>o.payment_status==='paid').length,fulfilled:orders.filter(o=>o.fulfillment_status==='delivered').length}}
export function validOrderId(value:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)}
export function cleanOrderSearch(value:string){return value.trim().slice(0,120)}

export function lifecycleErrorMessage(error:{code?:string;message?:string}){
 if(error.code==='42501')return error.message==='Order unavailable'?'Order unavailable. Reload and review the current order.':'Admin access required.'
 if(error.message==='Invalid order-status transition'||error.message==='Invalid internal fulfillment transition'||error.message==='Final orders cannot change lifecycle')return 'This transition is not allowed for the current order state.'
 if(error.message==='Cancellation reason is required')return 'A cancellation reason is required.'
 if(error.message==='Cancellation requires external payment or shipping review')return 'Cancellation is not allowed while payment or shipping requires external review.'
 if(error.message==='This lifecycle dimension cannot be changed by Admin')return 'Payment state cannot be manually changed.'
 if(error.message==='Completion requires trusted payment and delivery evidence')return 'Completion requires trusted payment and delivery evidence.'
 if(error.message==='Reason or internal note exceeds its allowed length')return 'Reason or internal note is too long.'
 return 'Lifecycle action unavailable. Reload and review the current order.'
}
