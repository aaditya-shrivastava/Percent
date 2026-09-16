import { supabase, checkError } from '../backend/client'
import { usePercentSession } from './usePercentSession'
import { useCallback, useEffect, useState } from 'react'

export interface CartLine { productId: string; variantId: string; quantity: number }

const readList = <T,>(key: string): T[] => { try { return JSON.parse(localStorage.getItem(key) ?? '[]') as T[] } catch { return [] } }
const cartKey = 'percent-cart'
const readCart = () => readList<CartLine>(cartKey).filter((line) => line.productId && line.variantId && Number.isFinite(line.quantity) && line.quantity > 0)
const saveCart = (lines: CartLine[]) => { localStorage.setItem(cartKey, JSON.stringify(lines)); window.dispatchEvent(new CustomEvent('percent:cart-changed')) }

export function useWishlist() {
 const {user}=usePercentSession()
 const [state,setState]=useState<{owner?:string;items:string[]}>({items:[]})
 const [error,setError]=useState('')
 const refresh=useCallback(async()=>{
  if(!user)return
  const {data,error}=await supabase.from('wishlist_items').select('product_id').eq('user_id',user.id)
  checkError(error);setState({owner:user.id,items:(data??[]).map(i=>i.product_id)})
 },[user])
 useEffect(()=>{void Promise.resolve().then(refresh).catch(e=>setError(e.message));const sync=()=>void refresh().catch(e=>setError(e.message));window.addEventListener('percent:wishlist-changed',sync);return()=>window.removeEventListener('percent:wishlist-changed',sync)},[refresh])
 const items=state.owner===user?.id?state.items:[]
 const toggle=async(productId:string)=>{
  if(!user){window.location.assign('/login?returnTo='+encodeURIComponent(window.location.pathname));return}
  try {const result=items.includes(productId)?await supabase.from('wishlist_items').delete().eq('user_id',user.id).eq('product_id',productId):await supabase.from('wishlist_items').upsert({user_id:user.id,product_id:productId},{onConflict:'user_id,product_id',ignoreDuplicates:true});checkError(result.error);await refresh();window.dispatchEvent(new CustomEvent('percent:wishlist-changed'))}catch(e){setError(e instanceof Error?e.message:'Unable to save wishlist')}
 }
 return {items,toggle,error}
}

export function addCartItem(productId: string, variantId: string, maxQuantity = Number.POSITIVE_INFINITY) {
  const lines = readCart()
  const existing = lines.find((line) => line.variantId === variantId)
  const nextQuantity = Math.min((existing?.quantity ?? 0) + 1, Math.max(0, maxQuantity))
  if (nextQuantity < 1) return
  const next = existing ? lines.map((line) => line.variantId === variantId ? { ...line, quantity: nextQuantity } : line) : [...lines, { productId, variantId, quantity: 1 }]
  saveCart(next)
}

export function useCart() {
  const [lines, setLines] = useState<CartLine[]>(readCart)
  const commit = useCallback((next: CartLine[]) => { saveCart(next); setLines(next) }, [])
  const updateQuantity = useCallback((variantId: string, quantity: number, maxQuantity = Number.POSITIVE_INFINITY) => {
    const safeQuantity = Math.max(1, Math.min(Math.floor(quantity), Math.max(1, maxQuantity)))
    commit(readCart().map((line) => line.variantId === variantId ? { ...line, quantity: safeQuantity } : line))
  }, [commit])
  const removeItem = useCallback((variantId: string) => commit(readCart().filter((line) => line.variantId !== variantId)), [commit])
  const clearCart = useCallback(() => commit([]), [commit])
  useEffect(() => { const sync = () => setLines(readCart()); window.addEventListener('percent:cart-changed', sync); window.addEventListener('storage', sync); return () => { window.removeEventListener('percent:cart-changed', sync); window.removeEventListener('storage', sync) } }, [])
  return { lines, updateQuantity, removeItem, clearCart }
}

export function useCartCount() {
  const count = () => readCart().reduce((total, line) => total + line.quantity, 0)
  const [cartCount, setCartCount] = useState(count)
  useEffect(() => { const sync = () => setCartCount(count()); window.addEventListener('percent:cart-changed', sync); return () => window.removeEventListener('percent:cart-changed', sync) }, [])
  return cartCount
}
