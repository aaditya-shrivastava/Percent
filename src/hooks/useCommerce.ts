import { useCallback, useEffect, useState } from 'react'

export interface CartLine { productId: string; variantId: string; quantity: number }

const readList = <T,>(key: string): T[] => { try { return JSON.parse(localStorage.getItem(key) ?? '[]') as T[] } catch { return [] } }
const cartKey = 'percent-cart'
const readCart = () => readList<CartLine>(cartKey).filter((line) => line.productId && line.variantId && Number.isFinite(line.quantity) && line.quantity > 0)
const saveCart = (lines: CartLine[]) => { localStorage.setItem(cartKey, JSON.stringify(lines)); window.dispatchEvent(new CustomEvent('percent:cart-changed')) }

export function useWishlist() {
  const [items, setItems] = useState<string[]>(() => readList<string>('percent-wishlist'))
  const toggle = (productId: string) => setItems((current) => {
    const next = current.includes(productId) ? current.filter((item) => item !== productId) : [...current, productId]
    localStorage.setItem('percent-wishlist', JSON.stringify(next))
    window.dispatchEvent(new CustomEvent('percent:wishlist-changed'))
    return next
  })
  useEffect(() => { const sync = () => setItems(readList<string>('percent-wishlist')); window.addEventListener('percent:wishlist-changed', sync); return () => window.removeEventListener('percent:wishlist-changed', sync) }, [])
  return { items, toggle }
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
  useEffect(() => { const sync = () => setLines(readCart()); window.addEventListener('percent:cart-changed', sync); window.addEventListener('storage', sync); return () => { window.removeEventListener('percent:cart-changed', sync); window.removeEventListener('storage', sync) } }, [])
  return { lines, updateQuantity, removeItem }
}

export function useCartCount() {
  const count = () => readCart().reduce((total, line) => total + line.quantity, 0)
  const [cartCount, setCartCount] = useState(count)
  useEffect(() => { const sync = () => setCartCount(count()); window.addEventListener('percent:cart-changed', sync); return () => window.removeEventListener('percent:cart-changed', sync) }, [])
  return cartCount
}
