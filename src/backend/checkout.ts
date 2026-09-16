import { supabase } from './client'
import type { CartLine } from '../hooks/useCommerce'

export interface CheckoutOrder {
 id:string;order_reference:string;status:string;payment_status:string;fulfillment_status:string
 subtotal_paise:number;shipping_paise:number;discount_paise:number;tax_paise:number;total_paise:number
 reservation_expires_at:string|null;reservation_active:boolean
}
const attemptKey='percent-checkout-attempt'
const fingerprint=(lines:CartLine[],addressId:string)=>JSON.stringify({addressId,lines:lines.map(l=>({variantId:l.variantId,quantity:l.quantity})).sort((a,b)=>a.variantId.localeCompare(b.variantId))})
export function checkoutAttempt(lines:CartLine[],addressId:string){
 const current=fingerprint(lines,addressId)
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
 if(message.includes('Checkout key was reused'))return 'Your cart or address changed. Start a new checkout attempt.'
 if(error.code==='PT409')return 'Stock changed while you checked out. Review your cart and try again.'
 return 'Order could not be created. Nothing was charged.'
}
export async function createCheckoutOrder(lines:CartLine[],addressId:string,key:string){
 const {data,error}=await supabase.rpc('create_checkout_order',{cart_lines:lines.map(line=>({variant_id:line.variantId,quantity:line.quantity})),shipping_address_id:addressId,idempotency_key:key})
 if(error)throw new Error(checkoutMessage(error))
 return data as unknown as CheckoutOrder
}
