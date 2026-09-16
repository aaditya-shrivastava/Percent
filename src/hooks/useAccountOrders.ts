import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../backend/client'
import { timelineFor, type AccountAddress, type AccountOrder } from '../data/account'
import { usePercentSession } from './usePercentSession'
const title=(value:string)=>value.split('_').map(v=>(v[0]??'').toUpperCase()+v.slice(1)).join(' ')
export function useAccountOrders(){
 const {user}=usePercentSession()
 const [orders,setOrders]=useState<AccountOrder[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('')
 const refresh=useCallback(async()=>{
  if(!user){setOrders([]);setLoading(false);return}
  setLoading(true)
  const result=await supabase.from('orders').select('*,order_items(*),order_addresses(*)').eq('user_id',user.id).order('created_at',{ascending:false})
  if(result.error){setError('Unable to load your orders.');setLoading(false);return}
  setOrders((result.data??[]).map(raw=>{
   const row=raw as typeof raw & {order_items:Array<Record<string,unknown>>;order_addresses:Array<Record<string,unknown>>}
   const a=row.order_addresses[0]??{}
   const address:AccountAddress={id:String(a.id??''),label:'Order address',isDefault:false,fullName:String(a.full_name??''),phone:String(a.phone??''),addressLine1:String(a.address_line1??''),addressLine2:String(a.address_line2??''),city:String(a.city??''),state:String(a.state??''),pinCode:String(a.pin_code??''),country:String(a.country??'IN')}
   const status=title(row.status)
   return {id:row.order_reference,placedAt:row.created_at,status,items:row.order_items.map((i:Record<string,unknown>)=>({productId:String(i.product_id??''),variantId:String(i.variant_id??i.id),productSlug:String(i.product_slug??''),productName:String(i.product_name??''),colour:String(i.colour??''),size:String(i.size??''),quantity:Number(i.quantity),unitPrice:Number(i.unit_price_paise)})),address,subtotal:Number(row.subtotal_paise),shippingLabel:Number(row.shipping_paise)===0?'Free':'₹'+Number(row.shipping_paise)/100,discount:Number(row.discount_paise),total:Number(row.total_paise),paymentMethod:row.payment_provider??'Payment not started',paymentStatus:title(row.payment_status),trackingNumber:row.tracking_number??undefined,estimatedDelivery:row.estimated_delivery??undefined,deliveredAt:row.delivered_at??undefined,timeline:timelineFor(status),isDemo:false} satisfies AccountOrder
  }))
  setError('');setLoading(false)
 },[user])
 useEffect(()=>{void refresh()},[refresh])
 return {orders,loading,error,refresh}
}
