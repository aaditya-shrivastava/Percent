import { type OrderConfirmationAddress } from './orderConfirmation'
import type { ProductImage } from '../types'

export type AccountOrderStatus = string

export interface AccountAddress extends Omit<OrderConfirmationAddress, 'email'> {
  id: string
  label: string
  isDefault: boolean
}

export interface AccountOrderItem {
  productId: string
  variantId: string
  productSlug: string
  productName: string
  colour: string
  size: string
  quantity: number
  unitPricePaise: number
  image?: ProductImage
}

export interface AccountOrder {
  id: string
  placedAt: string
  status: AccountOrderStatus
  items: AccountOrderItem[]
  address: AccountAddress
  subtotalPaise: number
  shippingLabel: string
  discountPaise: number
  totalPaise: number
  paymentMethod: string
  paymentStatus: string
  trackingNumber?: string
  estimatedDelivery?: string
  deliveredAt?: string
  timeline: Array<{ label: string; detail: string; complete: boolean }>
  isDemo: boolean
}

export const accountStatusFilters = ['All', 'Pending', 'Confirmed', 'Completed', 'Cancelled'] as const
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

export const timelineFor = (status: AccountOrderStatus) => {
  if (status === 'Cancelled') return [
    { label: 'Order Placed', detail: 'Frontend order snapshot recorded.', complete: true },
    { label: 'Cancelled', detail: 'This frontend order is marked as cancelled.', complete: true },
  ]
  const stage = status === 'Completed' ? 3 : status === 'Confirmed' ? 2 : 1
  return [
    { label: 'Order Created', detail: 'Authoritative pending order recorded.', complete: stage >= 1 },
    { label: 'Confirmed', detail: 'Admin confirmed the order lifecycle.', complete: stage >= 2 },
    { label: 'Completed', detail: 'Requires trusted payment and delivery evidence.', complete: stage >= 3 },
  ]
}
