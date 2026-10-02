import { supabase, checkError } from '../backend/client'
import { usePercentSession } from './usePercentSession'
import { customerSessionId, requireCustomerAction } from '../backend/customerAccess'
import { useCallback, useEffect, useState } from 'react'

export interface CartLine { productId: string; variantId: string; quantity: number }

const readList = <T,>(key: string): T[] => { try {const value:unknown=JSON.parse(localStorage.getItem(key) ?? '[]');return Array.isArray(value)?value as T[]:[]} catch { return [] } }
const cartKey = () => {const owner=customerSessionId();return owner?`percent-cart:${owner}`:null}
const readCart = () => {
  // The legacy global cart has no verifiable owner and must not cross accounts.
  localStorage.removeItem('percent-cart')
  const key=cartKey()
  return key?readList<CartLine>(key).filter((line) => line && typeof line.productId==='string' && typeof line.variantId==='string' && Number.isInteger(line.quantity) && line.quantity > 0):[]
}
const saveCart = (lines: CartLine[]) => { const key=cartKey();if(!key)return false;localStorage.setItem(key, JSON.stringify(lines)); window.dispatchEvent(new CustomEvent('percent:cart-changed'));return true }

export function useWishlist() {
 const {user,loading:sessionLoading,isCustomer,isAuthenticated}=usePercentSession()
 const owner=!sessionLoading&&isAuthenticated&&isCustomer?user?.id:undefined
 const [state,setState]=useState<{owner?:string;items:string[]}>({items:[]})
 const [error,setError]=useState('')
 const [loading,setLoading]=useState(true)
 const refresh=useCallback(async()=>{
  if(!owner){setState({items:[]});setError('');setLoading(false);return}
  setLoading(true)
  const {data,error}=await supabase.from('wishlist_items').select('product_id').eq('user_id',owner)
  checkError(error);setState({owner,items:(data??[]).map(i=>i.product_id)});setError('');setLoading(false)
 },[owner])
 useEffect(()=>{const failed=()=>{setError('Unable to load your wishlist.');setLoading(false)};void Promise.resolve().then(refresh).catch(failed);const sync=()=>void refresh().catch(failed);window.addEventListener('percent:wishlist-changed',sync);return()=>window.removeEventListener('percent:wishlist-changed',sync)},[refresh])
 const items=owner&&state.owner===owner?state.items:[]
 const toggle=async(productId:string)=>{
  if(!requireCustomerAction())return
  const userId=customerSessionId()!
  try {const result=items.includes(productId)?await supabase.from('wishlist_items').delete().eq('user_id',userId).eq('product_id',productId):await supabase.from('wishlist_items').upsert({user_id:userId,product_id:productId},{onConflict:'user_id,product_id',ignoreDuplicates:true});checkError(result.error);await refresh();window.dispatchEvent(new CustomEvent('percent:wishlist-changed'))}catch{setError('Unable to update your wishlist. Please try again.')}
 }
 return {items,toggle,error,loading:loading||sessionLoading}
}

export function addCartItem(productId: string, variantId: string, maxQuantity = Number.POSITIVE_INFINITY) {
  if(!requireCustomerAction())return false
  const lines = readCart()
  const existing = lines.find((line) => line.variantId === variantId)
  const nextQuantity = Math.min((existing?.quantity ?? 0) + 1, Math.max(0, maxQuantity))
  if (nextQuantity < 1) return false
  const next = existing ? lines.map((line) => line.variantId === variantId ? { ...line, quantity: nextQuantity } : line) : [...lines, { productId, variantId, quantity: 1 }]
  return saveCart(next)
}

export function useCart() {
  const session=usePercentSession()
  const owner=customerSessionId()
  const [state, setState] = useState<{owner:string|null;lines:CartLine[]}>(()=>({owner,lines:readCart()}))
  const commit = useCallback((next: CartLine[]) => { if(saveCart(next))setState({owner:customerSessionId(),lines:next}) }, [])
  const updateQuantity = useCallback((variantId: string, quantity: number, maxQuantity = Number.POSITIVE_INFINITY) => {
    const safeQuantity = Math.max(1, Math.min(Math.floor(quantity), Math.max(1, maxQuantity)))
    commit(readCart().map((line) => line.variantId === variantId ? { ...line, quantity: safeQuantity } : line))
  }, [commit])
  const removeItem = useCallback((variantId: string) => commit(readCart().filter((line) => line.variantId !== variantId)), [commit])
  const clearCart = useCallback(() => commit([]), [commit])
  useEffect(() => { const sync = () => setState({owner:customerSessionId(),lines:readCart()});void Promise.resolve().then(sync);window.addEventListener('percent:cart-changed', sync); window.addEventListener('storage', sync); return () => { window.removeEventListener('percent:cart-changed', sync); window.removeEventListener('storage', sync) } }, [session.loading,owner])
  return { lines:owner&&state.owner===owner?state.lines:[], updateQuantity, removeItem, clearCart }
}

export function useCartCount() {
  const {lines}=useCart()
  return lines.reduce((total,line)=>total+line.quantity,0)
}
