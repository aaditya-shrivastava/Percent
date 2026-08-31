import { useEffect, useState } from 'react'

interface CartLine { productId: string; variantId: string; quantity: number }

const readList = <T,>(key: string): T[] => { try { return JSON.parse(localStorage.getItem(key) ?? '[]') as T[] } catch { return [] } }

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

export function addCartItem(productId: string, variantId: string) {
  const lines = readList<CartLine>('percent-cart')
  const existing = lines.find((line) => line.variantId === variantId)
  const next = existing ? lines.map((line) => line.variantId === variantId ? { ...line, quantity: line.quantity + 1 } : line) : [...lines, { productId, variantId, quantity: 1 }]
  localStorage.setItem('percent-cart', JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('percent:cart-changed'))
}

export function useCartCount() {
  const count = () => readList<CartLine>('percent-cart').reduce((total, line) => total + Math.max(0, line.quantity), 0)
  const [cartCount, setCartCount] = useState(count)
  useEffect(() => { const sync = () => setCartCount(count()); window.addEventListener('percent:cart-changed', sync); return () => window.removeEventListener('percent:cart-changed', sync) }, [])
  return cartCount
}
