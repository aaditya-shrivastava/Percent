import type { ProductImage } from '../types'

export interface OrderConfirmationItem {
  productId: string
  variantId: string
  productSlug: string
  productName: string
  colour: string
  size: string
  quantity: number
  unitPrice: number
  image?: ProductImage
}

export interface OrderConfirmationAddress {
  email: string
  phone: string
  fullName: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  pinCode: string
  country: string
}

export interface OrderConfirmationSnapshot {
  version: 1
  orderReference: string
  placedAt: string
  items: OrderConfirmationItem[]
  address: OrderConfirmationAddress
  subtotal: number
  shippingLabel: string
  discount: number
  total: number
}

const confirmationKey = 'percent-order-confirmation'

export function createTemporaryOrderReference(date = new Date()) {
  const dateStamp = [String(date.getFullYear()).slice(-2), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('')
  const localSuffix = Math.floor(1000 + Math.random() * 9000)
  return `PCT-${dateStamp}-${localSuffix}`
}

export function saveOrderConfirmation(snapshot: OrderConfirmationSnapshot) {
  try {
    sessionStorage.setItem(confirmationKey, JSON.stringify(snapshot))
    return true
  } catch {
    return false
  }
}

export function readOrderConfirmation(): OrderConfirmationSnapshot | null {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(confirmationKey) ?? 'null') as Partial<OrderConfirmationSnapshot> | null
    if (!parsed || parsed.version !== 1 || typeof parsed.orderReference !== 'string' || typeof parsed.placedAt !== 'string' || !Array.isArray(parsed.items) || !parsed.items.length || !parsed.address) return null
    return parsed as OrderConfirmationSnapshot
  } catch {
    return null
  }
}
