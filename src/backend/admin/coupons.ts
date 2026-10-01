import { supabase } from '../client'

export type CouponKind='fixed'|'percentage'
export type CouponStatus='active'|'scheduled'|'expired'|'disabled'|'exhausted'
export interface AdminCoupon {
  id:string;code:string;description:string;kind:CouponKind
  amount_paise:number|null;percent_bps:number|null
  minimum_subtotal_paise:number;maximum_discount_paise:number|null
  starts_at:string|null;ends_at:string|null;active:boolean
  total_usage_limit:number|null;per_customer_usage_limit:number|null
  created_at:string;updated_at:string;redemption_count:number;effective_status:CouponStatus
}
export interface CouponDraft {
  id?:string;code:string;description:string;kind:CouponKind
  amountPaise:number|null;percentBps:number|null;minimumOrderPaise:number
  maximumDiscountPaise:number|null;startsAt:string|null;endsAt:string|null
  totalUsageLimit:number|null;perCustomerUsageLimit:number|null;enabled:boolean
  expectedUpdatedAt?:string
}
export interface CouponPage {items:AdminCoupon[];total:number;page:number;page_size:number}

const rpcError=(fallback:string,error:{message?:string;code?:string})=>{
  if(error.code==='PT409')return new Error('This coupon changed. Refresh and try again.')
  if(error.message?.includes('already exists'))return new Error('That coupon code already exists.')
  if(error.message?.includes('Admin access'))return new Error('Admin access required.')
  return new Error(error.message||fallback)
}

export async function listCoupons(searchQuery:string,status:string,page=1,pageSize=20){
  const {data,error}=await supabase.rpc('admin_list_coupons',{search_query:searchQuery||undefined,status_filter:status,page_number:page,page_size:pageSize})
  if(error)throw rpcError('Unable to load coupons.',error)
  return data as unknown as CouponPage
}
export async function getCoupon(id:string){
  const {data,error}=await supabase.rpc('admin_get_coupon',{coupon_id:id})
  if(error)throw rpcError('Unable to load coupon.',error)
  return data as unknown as AdminCoupon
}
export async function saveCoupon(draft:CouponDraft){
  const {data,error}=await supabase.rpc('save_coupon',{
    coupon_id:draft.id??null,code:draft.code,description:draft.description,
    discount_type:draft.kind,fixed_amount_paise:draft.kind==='fixed'?draft.amountPaise:null,
    percentage_bps:draft.kind==='percentage'?draft.percentBps:null,
    minimum_order_paise:draft.minimumOrderPaise,
    maximum_discount_paise:draft.kind==='percentage'?draft.maximumDiscountPaise:null,
    valid_from:draft.startsAt,valid_until:draft.endsAt,total_usage_limit:draft.totalUsageLimit,
    per_customer_usage_limit:draft.perCustomerUsageLimit,enabled:draft.enabled,
    expected_updated_at:draft.expectedUpdatedAt??null,
  })
  if(error)throw rpcError('Unable to save coupon.',error)
  return data as unknown as AdminCoupon
}

export function parseInrToPaise(value:string,optional=false){
  const clean=value.trim()
  if(optional&&clean==='')return null
  if(!/^\d+(\.\d{1,2})?$/.test(clean))throw new Error('Enter a valid INR amount with up to two decimal places.')
  const [rupees,paise='']=clean.split('.')
  const result=Number(rupees)*100+Number(paise.padEnd(2,'0'))
  if(!Number.isSafeInteger(result))throw new Error('Amount is too large.')
  return result
}
export const paiseToInput=(value:number|null)=>value===null?'':`${Math.trunc(value/100)}${value%100?`.${String(value%100).padStart(2,'0')}`:''}`
export const percentToInput=(bps:number|null)=>bps===null?'':`${Math.trunc(bps/100)}${bps%100?`.${String(bps%100).padStart(2,'0')}`:''}`
export function parsePercentToBps(value:string){
  const clean=value.trim()
  if(!/^\d+(\.\d{1,2})?$/.test(clean))throw new Error('Enter a percentage with up to two decimal places.')
  const [whole,fraction='']=clean.split('.')
  const bps=Number(whole)*100+Number(fraction.padEnd(2,'0'))
  if(bps<1||bps>10000)throw new Error('Percentage must be greater than 0 and no more than 100.')
  return bps
}
