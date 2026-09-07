import { ArrowRight, Check, LockKeyhole, PackageCheck, ShieldCheck, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { formatInr } from '../data/shop'
import { readOrderConfirmation, type OrderConfirmationSnapshot } from '../data/orderConfirmation'

const formatPlacedAt = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Frontend checkout session'
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function ConfirmationSummary({ order }: { order: OrderConfirmationSnapshot }) {
  return <aside className="confirmation-summary" aria-labelledby="confirmation-summary-heading">
    <p className="confirmation-kicker">Order details</p>
    <h2 id="confirmation-summary-heading">Order Summary</h2>
    <div className="confirmation-summary-items">{order.items.map((item) => <article className="confirmation-summary-item" key={item.variantId}>
      {item.image ? <Link className="confirmation-summary-image" to={`/products/${item.productSlug}`}><img src={item.image.src} alt={item.image.alt} width={item.image.width} height={item.image.height} /></Link> : <div className="confirmation-summary-image confirmation-summary-image-missing" aria-hidden="true">%</div>}
      <div><strong>{item.productName}</strong><span>{item.colour} · {item.size}</span><small>Quantity {item.quantity}</small></div>
      <b>{formatInr(item.unitPrice * item.quantity)}</b>
    </article>)}</div>
    <dl className="confirmation-price-summary"><div><dt>Subtotal</dt><dd>{formatInr(order.subtotal)}</dd></div><div><dt>Shipping</dt><dd>{order.shippingLabel}</dd></div><div><dt>Discount</dt><dd>{formatInr(order.discount)}</dd></div></dl>
    <div className="confirmation-total"><span>Total</span><strong>{formatInr(order.total)}</strong><small>Including all taxes</small></div>
    <div className="confirmation-trust"><div><ShieldCheck /><span><strong>Secure payment via</strong>Razorpay</span></div><div><Truck /><span><strong>Fulfillment</strong>Delhivery</span></div></div>
  </aside>
}

export function OrderConfirmationPage() {
  const location = useLocation()
  const navigationOrder = (location.state as { order?: OrderConfirmationSnapshot } | null)?.order
  const [order] = useState<OrderConfirmationSnapshot | null>(() => navigationOrder ?? readOrderConfirmation())
  const [trackingMessage, setTrackingMessage] = useState('')

  useEffect(() => { const previousTitle = document.title; document.title = order ? 'Order Confirmed | Percent' : 'No Recent Order | Percent'; return () => { document.title = previousTitle } }, [order])

  if (!order) return <main className="confirmation-page confirmation-empty"><section aria-labelledby="confirmation-empty-heading"><p className="confirmation-kicker">Percent Orders</p><h1 id="confirmation-empty-heading">No Recent Order Found.</h1><span>Complete checkout to create a frontend order confirmation.</span><Link to="/shop">Return to Shop <ArrowRight /></Link></section></main>

  const placedAt = formatPlacedAt(order.placedAt)
  return <main className="confirmation-page">
    <header className="confirmation-hero">
      <div><p className="confirmation-kicker">Order Confirmed</p><h1>Thank You.</h1><strong>Your order has been placed successfully.</strong><span>Your order details are ready below.</span></div>
      <div className="confirmation-seal" aria-hidden="true"><strong>%</strong><span>Percent</span><small>Less Ordinary</small></div>
    </header>

    <div className="confirmation-layout">
      <div className="confirmation-details">
        <section className="confirmation-status-card" aria-labelledby="confirmation-status-heading">
          <span className="confirmation-check"><Check /></span>
          <div className="confirmation-status-copy"><p className="confirmation-kicker">Frontend order reference</p><h2 id="confirmation-status-heading">Order #{order.orderReference}</h2><span>Demo reference for this checkout session.</span></div>
          <dl><div><dt>Placed</dt><dd>{placedAt}</dd></div><div><dt>Estimated Delivery</dt><dd>Delivery estimate will be available once shipping is confirmed.</dd></div><div><dt>Fulfillment</dt><dd>Planned through Delhivery</dd></div></dl>
          <p>Thank you for choosing a Percent piece. This confirmation preserves the details of your frontend checkout session.</p>
        </section>

        <div className="confirmation-card-grid">
          <section className="confirmation-info-card" aria-labelledby="confirmation-address-heading"><div className="confirmation-info-heading"><PackageCheck /><div><p className="confirmation-kicker">Delivery</p><h2 id="confirmation-address-heading">Delivery Address</h2></div></div><address><strong>{order.address.fullName}</strong><span>{order.address.addressLine1}</span>{order.address.addressLine2 && <span>{order.address.addressLine2}</span>}<span>{order.address.city}, {order.address.state} {order.address.pinCode}</span><span>{order.address.country}</span><span>+91 {order.address.phone}</span><small>{order.address.email}</small></address></section>
          <section className="confirmation-info-card" aria-labelledby="confirmation-payment-heading"><div className="confirmation-info-heading"><LockKeyhole /><div><p className="confirmation-kicker">Payment details</p><h2 id="confirmation-payment-heading">Razorpay</h2></div></div><dl><div><dt>Status</dt><dd><i /> Payment Confirmed</dd></div><div><dt>Paid</dt><dd>{placedAt}</dd></div></dl><p>Frontend checkout simulation. No payment ID or bank details were generated.</p></section>
        </div>

        <section className="confirmation-actions" aria-labelledby="confirmation-actions-heading"><p className="confirmation-kicker">What happens next</p><h2 id="confirmation-actions-heading">Keep exploring.</h2><div><button type="button" onClick={() => setTrackingMessage('Tracking will be available once your order is shipped.')}>Track Order <ArrowRight /></button><Link to="/shop">Continue Shopping <ArrowRight /></Link><button type="button" disabled title="Order details will be available in a future update">View Order Details <ArrowRight /></button></div><p aria-live="polite">{trackingMessage}</p></section>
      </div>

      <ConfirmationSummary order={order} />
    </div>
  </main>
}
