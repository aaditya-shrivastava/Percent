import { getPublicShopProducts } from './shop'
import { readOrderConfirmation, type OrderConfirmationAddress, type OrderConfirmationItem } from './orderConfirmation'
import type { ProductImage } from '../types'

export type AccountOrderStatus = 'Processing' | 'Shipped' | 'Out for Delivery' | 'Delivered' | 'Cancelled'

export interface AccountAddress extends Omit<OrderConfirmationAddress, 'email'> {
  id: string
  label: string
  isDefault: boolean
}

export interface AccountOrderItem extends OrderConfirmationItem {
  image?: ProductImage
}

export interface AccountOrder {
  id: string
  placedAt: string
  status: AccountOrderStatus
  items: AccountOrderItem[]
  address: AccountAddress
  subtotal: number
  shippingLabel: string
  discount: number
  total: number
  paymentMethod: 'Razorpay'
  paymentStatus: 'Paid / Confirmed'
  trackingNumber?: string
  estimatedDelivery?: string
  deliveredAt?: string
  timeline: Array<{ label: string; detail: string; complete: boolean }>
  isDemo: boolean
}

export const accountStatusFilters = ['All', 'Processing', 'Shipped', 'Delivered', 'Cancelled'] as const
export const demoMemberSince = 'Mar 2026'

export const demoAccountAddress: AccountAddress = {
  id: 'demo-address-home',
  label: 'Home',
  isDefault: true,
  fullName: 'User Name',
  addressLine1: '12 Studio Lane',
  addressLine2: 'Indiranagar',
  city: 'Bengaluru',
  state: 'Karnataka',
  pinCode: '560038',
  country: 'India',
  phone: '9876543210',
}

const timelineFor = (status: AccountOrderStatus) => {
  if (status === 'Cancelled') return [
    { label: 'Order Placed', detail: 'Frontend order snapshot recorded.', complete: true },
    { label: 'Cancelled', detail: 'This frontend order is marked as cancelled.', complete: true },
  ]
  const stage = status === 'Delivered' ? 5 : status === 'Out for Delivery' ? 4 : status === 'Shipped' ? 3 : 2
  return [
    { label: 'Order Placed', detail: 'Frontend order snapshot recorded.', complete: stage >= 1 },
    { label: 'Confirmed', detail: 'Payment and order details confirmed.', complete: stage >= 2 },
    { label: 'Shipped', detail: 'Marked shipped in the frontend order state.', complete: stage >= 3 },
    { label: 'Out for Delivery', detail: 'Awaiting a future courier status connection.', complete: stage >= 4 },
    { label: 'Delivered', detail: 'Order marked as delivered.', complete: stage >= 5 },
  ]
}

const products = getPublicShopProducts()

const orderItem = (productIndex: number, quantity: number, size: string): AccountOrderItem | null => {
  const product = products[productIndex]
  if (!product) return null
  return { productId: product.id, variantId: `${product.id}-demo-${size.toLowerCase()}`, productSlug: product.slug, productName: product.name, colour: product.colors[0]?.label ?? 'Stone', size, quantity, unitPrice: product.price, image: product.images[0] }
}

const buildDemoOrder = (id: string, placedAt: string, status: AccountOrderStatus, selections: Array<[number, number, string]>): AccountOrder | null => {
  const items = selections.map(([productIndex, quantity, size]) => orderItem(productIndex, quantity, size)).filter((item): item is AccountOrderItem => Boolean(item))
  if (!items.length) return null
  const subtotal = items.reduce((total, item) => total + item.unitPrice * item.quantity, 0)
  return { id, placedAt, status, items, address: demoAccountAddress, subtotal, shippingLabel: 'Calculated at checkout', discount: 0, total: subtotal, paymentMethod: 'Razorpay', paymentStatus: 'Paid / Confirmed', timeline: timelineFor(status), isDemo: true }
}

const demoOrders = [
  buildDemoOrder('PCT-DEMO-1042', '2026-08-24T10:30:00.000Z', 'Delivered', [[0, 1, 'M'], [1, 1, 'L']]),
  buildDemoOrder('PCT-DEMO-0987', '2026-08-15T13:15:00.000Z', 'Shipped', [[2, 1, 'S']]),
  buildDemoOrder('PCT-DEMO-0831', '2026-08-03T08:45:00.000Z', 'Cancelled', [[3, 1, 'M']]),
].filter((order): order is AccountOrder => Boolean(order))

const fromRecentConfirmation = (): AccountOrder | null => {
  const snapshot = readOrderConfirmation()
  if (!snapshot) return null
  const address: AccountAddress = { id: 'recent-checkout-address', label: 'Checkout', isDefault: true, fullName: snapshot.address.fullName, addressLine1: snapshot.address.addressLine1, addressLine2: snapshot.address.addressLine2, city: snapshot.address.city, state: snapshot.address.state, pinCode: snapshot.address.pinCode, country: snapshot.address.country, phone: snapshot.address.phone }
  return { id: snapshot.orderReference, placedAt: snapshot.placedAt, status: 'Processing', items: snapshot.items, address, subtotal: snapshot.subtotal, shippingLabel: snapshot.shippingLabel, discount: snapshot.discount, total: snapshot.total, paymentMethod: 'Razorpay', paymentStatus: 'Paid / Confirmed', timeline: timelineFor('Processing'), isDemo: true }
}

export function getAccountOrders() {
  const recent = fromRecentConfirmation()
  return recent ? [recent, ...demoOrders.filter((order) => order.id !== recent.id)] : demoOrders
}

export function getAccountOrder(orderId: string | undefined) {
  return getAccountOrders().find((order) => order.id === orderId)
}
