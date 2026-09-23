export interface ReservationState {
  reservation_active: boolean
  reservation_expires_at: string | null
}

export function isCheckoutReservationExpired(order: ReservationState, now: number) {
  return !order.reservation_active || Boolean(order.reservation_expires_at && new Date(order.reservation_expires_at).getTime() <= now)
}

export function checkoutReservationCopy(order: ReservationState, now: number) {
  const expired = isCheckoutReservationExpired(order, now)
  return expired
    ? { expired, title: 'Reservation expired', detail: 'Pieces released back to inventory', canRetry: true }
    : { expired, title: 'Inventory hold', detail: 'Exact pieces reserved', canRetry: false }
}
