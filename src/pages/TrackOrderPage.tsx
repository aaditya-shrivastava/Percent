import { ArrowLeft, ArrowRight, Check, Clock3, MapPin, Package, Truck, X } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { AccountShell } from '../components/account/AccountShell'
import { type AccountOrder } from '../data/account'
import { useAccountOrders } from '../hooks/useAccountOrders'

const formatTrackingDate = (value: string) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const statusClass = (status: AccountOrder['status']) => `is-${status.toLowerCase().replaceAll(' ', '-')}`

function currentStatusMessage(order: AccountOrder) {
  if (order.status === 'Processing') return 'Your order is being prepared.'
  if (order.status === 'Shipped') return 'Tracking updates will appear here once live shipping integration is connected.'
  if (order.status === 'Out for Delivery') return 'Your order is on the way.'
  if (order.status === 'Delivered') return 'This frontend order is marked as delivered.'
  return 'This order was cancelled before delivery.'
}

function estimatedDeliveryMessage(order: AccountOrder) {
  if (order.estimatedDelivery) return formatTrackingDate(order.estimatedDelivery)
  if (order.status === 'Delivered') return 'No delivery estimate is stored in this frontend snapshot.'
  if (order.status === 'Cancelled') return 'Not applicable for a cancelled order.'
  return 'Available once shipping is confirmed.'
}

function trackingNumberMessage(order: AccountOrder) {
  if (order.trackingNumber) return order.trackingNumber
  if (order.status === 'Processing') return 'Tracking number will be available after shipment.'
  if (order.status === 'Cancelled') return 'No tracking number was created for this cancelled order.'
  return 'No tracking number is stored in this frontend order snapshot.'
}

function TrackingTimeline({ order }: { order: AccountOrder }) {
  const currentStepIndex = order.timeline.reduce((latest, step, index) => step.complete ? index : latest, -1)
  return <section className={`tracking-card tracking-timeline ${statusClass(order.status)}`} aria-labelledby="tracking-timeline-heading">
    <header><Truck /><div><p>Order Journey</p><h2 id="tracking-timeline-heading">Tracking Timeline</h2></div></header>
    <ol>{order.timeline.map((step, index) => {
      const isCurrent = index === currentStepIndex
      const isCancelled = order.status === 'Cancelled' && step.label === 'Cancelled'
      const trackingLabel = step.label === 'Confirmed' ? 'Order Confirmed' : step.label
      const trackingDetail = step.label === 'Order Placed' ? 'Your order has been received.' : step.label === 'Confirmed' ? 'Your order is being prepared.' : step.label === 'Shipped' ? 'Marked as handed over in this frontend order state.' : step.label === 'Out for Delivery' ? 'Your order is on the way.' : step.detail
      return <li className={`${step.complete ? 'is-complete' : 'is-upcoming'} ${isCurrent ? 'is-current' : ''} ${isCancelled ? 'is-cancelled' : ''}`} key={step.label} aria-current={isCurrent ? 'step' : undefined}>
        <span aria-hidden="true">{isCancelled ? <X /> : step.complete ? <Check /> : null}</span>
        <div><strong>{trackingLabel}</strong>{index === 0 && <time dateTime={order.placedAt}>{formatTrackingDate(order.placedAt)}</time>}<p>{trackingDetail}</p></div>
      </li>
    })}</ol>
    {order.status === 'Processing' && <div className="tracking-unavailable"><strong>Tracking Not Available Yet</strong><p>Tracking details will appear once your order has been shipped.</p></div>}
    <small>Status details are a deterministic frontend preview. Live Delhivery tracking is not connected.</small>
  </section>
}

function OrderPreview({ order }: { order: AccountOrder }) {
  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0)
  return <section className="tracking-card tracking-preview" aria-labelledby="tracking-preview-heading">
    <header><Package /><div><p>{itemCount} {itemCount === 1 ? 'Item' : 'Items'}</p><h2 id="tracking-preview-heading">Order Preview</h2></div></header>
    <div>{order.items.slice(0, 2).map((item) => <article key={item.variantId}>
      <Link className="tracking-product-image" to={`/products/${item.productSlug}`} aria-label={`View ${item.productName}`}>{item.image ? <img src={item.image.src} alt={item.image.alt} width={item.image.width} height={item.image.height} /> : <Package aria-hidden="true" />}</Link>
      <div><Link to={`/products/${item.productSlug}`}>{item.productName}</Link><span>{item.colour} · Size {item.size}</span><small>Qty {item.quantity}</small></div>
    </article>)}</div>
    {order.items.length > 2 && <small>+{order.items.length - 2} more items in this order</small>}
  </section>
}

export function TrackOrderPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const { orders, loading, error } = useAccountOrders()
  const order = orders.find((item) => item.id === orderId)

  if (loading) return <AccountShell><section className="account-empty" aria-busy="true"><Package /><h2>Loading Tracking…</h2></section></AccountShell>
  if (error) return <AccountShell><section className="account-empty" role="alert"><Package /><h2>{error}</h2></section></AccountShell>
  if (!order) return <AccountShell><section className="account-empty"><Package /><h2>Order Not Found</h2><p>We couldn't find tracking information for this order.</p><Link to="/profile/orders">Back to My Orders <ArrowRight /></Link></section></AccountShell>

  const firstItem = order.items[0]
  return <AccountShell>
    <header className="order-detail-header tracking-page-header">
      <Link className="order-detail-back" to={`/orders/${order.id}`}><ArrowLeft /> Back to Order Details</Link>
      <div><h1>Track Order</h1><p>Order #{order.id}</p></div>
    </header>

    <div className="tracking-layout">
      <section className={`tracking-card tracking-status ${statusClass(order.status)}`} aria-labelledby="tracking-status-heading">
        <div><p>Order Status</p><h2 id="tracking-status-heading">{order.status === 'Cancelled' ? 'Order Cancelled' : order.status}</h2><span>{currentStatusMessage(order)}</span></div>
        <dl><div><dt>Fulfilled By</dt><dd>Delhivery</dd></div><div><dt>Order Date</dt><dd>{formatTrackingDate(order.placedAt)}</dd></div></dl>
      </section>

      <OrderPreview order={order} />
      <TrackingTimeline order={order} />

      <section className="tracking-card tracking-estimate" aria-labelledby="tracking-estimate-heading"><header><Clock3 /><div><p>Estimated Delivery</p><h2 id="tracking-estimate-heading">Delivery Estimate</h2></div></header><strong>{estimatedDeliveryMessage(order)}</strong></section>
      <section className="tracking-card tracking-destination" aria-labelledby="tracking-destination-heading"><header><MapPin /><div><p>Delivering To</p><h2 id="tracking-destination-heading">{order.address.fullName}</h2></div></header><address>{order.address.city}, {order.address.state} {order.address.pinCode}</address><details><summary>View destination</summary><p>{order.address.addressLine1}{order.address.addressLine2 ? `, ${order.address.addressLine2}` : ''}, {order.address.city}, {order.address.state} {order.address.pinCode}, {order.address.country}</p></details></section>
      <section className="tracking-card tracking-partner" aria-labelledby="tracking-partner-heading"><header><Truck /><div><p>Shipping Partner</p><h2 id="tracking-partner-heading">Delhivery</h2></div></header><span>Live courier connection is not active in this frontend preview.</span></section>
      <section className="tracking-card tracking-number" aria-labelledby="tracking-number-heading"><header><Package /><div><p>Tracking Number</p><h2 id="tracking-number-heading">Shipment Reference</h2></div></header><strong>{trackingNumberMessage(order)}</strong></section>
    </div>

    <footer className="order-detail-actions tracking-actions">
      <Link to={`/orders/${order.id}`}>View Order Details <ArrowRight /></Link>
      <Link to="/shop">Continue Shopping <ArrowRight /></Link>
      {order.status === 'Delivered' && firstItem && <Link to={`/products/${firstItem.productSlug}#customer-reviews`}>Write a Review <ArrowRight /></Link>}
    </footer>
  </AccountShell>
}
