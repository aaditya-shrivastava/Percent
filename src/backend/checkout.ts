import { supabase } from './client'
import type { CartLine } from '../hooks/useCommerce'

export interface CheckoutOrder {
 id:string;order_reference:string;status:string;payment_status:string;fulfillment_status:string
 subtotal_paise:number;shipping_paise:number;discount_paise:number;tax_paise:number;total_paise:number
 coupon_code_snapshot:string|null
 reservation_expires_at:string|null;reservation_active:boolean
}
export interface CouponValidation {valid:boolean;code:string|null;discount_type?:'fixed'|'percentage';discount_paise?:number;subtotal_paise:number;reason?:string;message:string;minimum_order_paise?:number}
const attemptKey='percent-checkout-attempt'
const fingerprint=(lines:CartLine[],addressId:string,couponCode?:string)=>JSON.stringify({addressId,couponCode:couponCode||null,lines:lines.map(l=>({variantId:l.variantId,quantity:l.quantity})).sort((a,b)=>a.variantId.localeCompare(b.variantId))})
export function checkoutAttempt(lines:CartLine[],addressId:string,couponCode?:string){
 const current=fingerprint(lines,addressId,couponCode)
 try{const saved=JSON.parse(sessionStorage.getItem(attemptKey)??'null') as {key?:string;fingerprint?:string}|null;if(saved?.key&&saved.fingerprint===current)return saved.key}catch{/* new attempt */}
 const key=crypto.randomUUID();sessionStorage.setItem(attemptKey,JSON.stringify({key,fingerprint:current}));return key
}
export function resetCheckoutAttempt(){sessionStorage.removeItem(attemptKey)}
export function checkoutMessage(error:{code?:string;message?:string}){
 const message=error.message??''
 if(message.includes('Sign in'))return 'Sign in to continue.'
 if(message.includes('valid address'))return 'Choose a valid address from your account.'
 if(message.includes('no longer available'))return 'This item is no longer available.'
 if(message.includes('items changed'))return 'One of your items changed. Review your cart.'
 if(message.startsWith('Only '))return message+'.'
 if(message.includes('Checkout key was reused'))return 'Your cart, address or coupon changed. Start a new checkout attempt.'
 if(message.includes('Invalid coupon')||message.includes('Coupon is disabled')||message.includes('Coupon expired')||message.includes('Coupon is not active yet')||message.includes('Minimum order')||message.includes('usage limit')||message.includes('maximum number of times'))return message+'.'
 if(error.code==='PT409')return 'Stock changed while you checked out. Review your cart and try again.'
 return 'Order could not be created. Nothing was charged.'
}
const rpcLines=(lines:CartLine[])=>lines.map(line=>({variant_id:line.variantId,quantity:line.quantity}))
export async function validateCoupon(code:string,lines:CartLine[]){
 const {data,error}=await supabase.rpc('validate_coupon',{code,cart_lines:rpcLines(lines)})
 if(error)throw new Error(checkoutMessage(error))
 return data as unknown as CouponValidation
}
export async function createCheckoutOrder(lines:CartLine[],addressId:string,key:string,couponCode?:string){
 const {data,error}=await supabase.rpc('create_checkout_order',{cart_lines:rpcLines(lines),shipping_address_id:addressId,idempotency_key:key,coupon_code:couponCode??null})
 if(error)throw new Error(checkoutMessage(error))
 return data as unknown as CheckoutOrder
}
