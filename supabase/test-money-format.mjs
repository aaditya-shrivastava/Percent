import assert from 'node:assert/strict'
import { formatInrFromPaise } from '../src/data/money.ts'
import { checkoutReservationCopy, isCheckoutReservationExpired } from '../src/data/checkoutReservation.ts'

assert.equal(formatInrFromPaise(0), '₹0')
assert.equal(formatInrFromPaise(100), '₹1')
assert.equal(formatInrFromPaise(149900), '₹1,499')
assert.equal(formatInrFromPaise(149950), '₹1,499.50')
assert.equal(formatInrFromPaise(10000000), '₹1,00,000')

const order = {
  subtotal_paise: 149900,
  shipping_paise: 0,
  discount_paise: 0,
  tax_paise: 0,
  total_paise: 149900,
}
assert.deepEqual({
  subtotal: formatInrFromPaise(order.subtotal_paise),
  shipping: order.shipping_paise === 0 ? 'Free' : formatInrFromPaise(order.shipping_paise),
  discount: formatInrFromPaise(order.discount_paise),
  tax: formatInrFromPaise(order.tax_paise),
  total: formatInrFromPaise(order.total_paise),
}, { subtotal: '₹1,499', shipping: 'Free', discount: '₹0', tax: '₹0', total: '₹1,499' })

assert.throws(() => formatInrFromPaise(1.5), /safe integer/)
const now = Date.parse('2026-09-21T12:00:00Z')
assert.equal(isCheckoutReservationExpired({ reservation_active: true, reservation_expires_at: '2026-09-21T12:01:00Z' }, now), false)
assert.equal(isCheckoutReservationExpired({ reservation_active: true, reservation_expires_at: '2026-09-21T11:59:00Z' }, now), true)
assert.equal(isCheckoutReservationExpired({ reservation_active: false, reservation_expires_at: '2026-09-21T12:01:00Z' }, now), true)
assert.deepEqual(checkoutReservationCopy({ reservation_active: true, reservation_expires_at: '2026-09-21T12:01:00Z' }, now), { expired: false, title: 'Inventory hold', detail: 'Exact pieces reserved', canRetry: false })
assert.deepEqual(checkoutReservationCopy({ reservation_active: true, reservation_expires_at: '2026-09-21T11:59:00Z' }, now), { expired: true, title: 'Reservation expired', detail: 'Pieces released back to inventory', canRetry: true })
console.log('PASS INR/paise display contract and authoritative order summary')
