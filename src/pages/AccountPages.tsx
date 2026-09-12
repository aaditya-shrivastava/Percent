import { ArrowLeft, ArrowRight, Check, MapPin, Package, Plus, ShieldCheck, Truck } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AccountShell } from '../components/account/AccountShell'
import { ShopProductCard } from '../components/product/ShopProductCard'
import { accountStatusFilters, demoMemberSince, getAccountOrder, getAccountOrders, type AccountAddress, type AccountOrder } from '../data/account'
import { getProductDetailsById } from '../data/productDetails'
import { formatInr } from '../data/shop'
import { useAccountAddresses } from '../hooks/useAccountAddresses'
import { usePercentSession } from '../hooks/usePercentSession'
import { useWishlist } from '../hooks/useCommerce'

const formatAccountDate = (value: string) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value))

function AccountHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <header className="account-heading"><div><p>{eyebrow}</p><h1>{title}</h1><span>{description}</span></div>{action}</header>
}

export function ProfilePage() {
  return <AccountShell><ProfileContent /></AccountShell>
}

function ProfileContent() {
  const { user } = usePercentSession()
  const { addresses } = useAccountAddresses()
  const displayName = user?.displayName ?? 'Demo Member'
  const nameParts = displayName.trim().split(/\s+/)
  const initialProfile = { firstName: user?.firstName ?? nameParts[0] ?? '', lastName: user?.lastName ?? nameParts.slice(1).join(' '), phone: user?.phone ?? '', email: user?.email ?? (user?.id.includes('@') ? user.id : '') }
  const [profile, setProfile] = useState(initialProfile)
  const [draft, setDraft] = useState(initialProfile)
  const [editing, setEditing] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [preferredSize, setPreferredSize] = useState('')
  const [editingSize, setEditingSize] = useState(false)
  const defaultAddress = addresses.find((address) => address.isDefault) ?? addresses[0]

  const saveProfile = () => {
    const nextErrors: Record<string, string> = {}
    if (!draft.firstName.trim()) nextErrors.firstName = 'First name is required.'
    if (!draft.lastName.trim()) nextErrors.lastName = 'Last name is required.'
    if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) nextErrors.email = 'Enter a valid email address.'
    const normalizedPhone = draft.phone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '')
    if (draft.phone && !/^[6-9]\d{9}$/.test(normalizedPhone)) nextErrors.phone = 'Enter a valid 10-digit phone number.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setProfile(draft)
    setEditing(false)
  }

  return <>
    <AccountHeading eyebrow="Account" title="Profile" description="Manage your personal information and account details." action={!editing ? <button className="account-primary-action" type="button" onClick={() => setEditing(true)}>Edit Profile</button> : undefined} />
    <section className="profile-information" aria-labelledby="personal-information-heading"><div className="account-section-title"><span>01</span><h2 id="personal-information-heading">Personal Information</h2></div><div className="profile-field-grid">
      {(['firstName', 'lastName', 'phone', 'email'] as const).map((field) => { const labels = { firstName: 'First Name', lastName: 'Last Name', phone: 'Phone Number', email: 'Email ID' }; return <label key={field}>{labels[field]}<input type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'} readOnly={!editing} value={(editing ? draft : profile)[field]} placeholder={field === 'phone' || field === 'email' ? 'Not added yet' : ''} aria-invalid={Boolean(errors[field])} onChange={(event) => setDraft((current) => ({ ...current, [field]: field === 'phone' ? event.target.value.replace(/\D/g, '').slice(0, 10) : event.target.value }))} />{errors[field] && <small>{errors[field]}</small>}</label> })}
    </div>{editing && <div className="profile-edit-actions"><button type="button" onClick={saveProfile}>Save</button><button type="button" onClick={() => { setDraft(profile); setErrors({}); setEditing(false) }}>Cancel</button></div>}</section>
    <section className="profile-account-information" aria-labelledby="account-information-heading"><div className="account-section-title"><span>02</span><h2 id="account-information-heading">Account Information</h2></div><dl><div><dt>Member Since</dt><dd>{user?.memberSince ?? demoMemberSince}</dd></div><div><dt>Default Address</dt><dd>{defaultAddress ? `${defaultAddress.city}, ${defaultAddress.state}` : 'Not added yet'}<Link to="/profile/address">{defaultAddress ? 'View Address' : 'Add Address'} <ArrowRight /></Link></dd></div><div><dt>Preferred Size</dt><dd>{editingSize ? <select autoFocus value={preferredSize} onChange={(event) => { setPreferredSize(event.target.value); setEditingSize(false) }}><option value="">Select size</option><option>S</option><option>M</option><option>L</option><option>XL</option></select> : preferredSize || 'Not set'}{!editingSize && <button type="button" onClick={() => setEditingSize(true)}>{preferredSize ? 'Change Size' : 'Add Size'} <ArrowRight /></button>}</dd></div></dl></section>
  </>
}

export function ProfileOrdersPage() {
  const orders = useMemo(() => getAccountOrders(), [])
  const [filter, setFilter] = useState<(typeof accountStatusFilters)[number]>('All')
  const visibleOrders = filter === 'All' ? orders : orders.filter((order) => order.status === filter)
  return <AccountShell>
    <AccountHeading eyebrow="Account" title="My Orders" description="Track and view your recent purchases." />
    <div className="order-filters" aria-label="Order status filters">{accountStatusFilters.map((status) => <button key={status} type="button" className={filter === status ? 'is-active' : ''} aria-pressed={filter === status} onClick={() => setFilter(status)}>{status}</button>)}</div>
    {visibleOrders.length ? <div className="account-order-list">{visibleOrders.map((order) => <article className="account-order-row" key={order.id}>
      {order.items[0]?.image && <Link className="account-order-image" to={`/orders/${order.id}`}><img src={order.items[0].image.src} alt={order.items[0].image.alt} width={order.items[0].image.width} height={order.items[0].image.height} /></Link>}
      <div className="account-order-copy"><span>#{order.id}</span><strong>{formatAccountDate(order.placedAt)}</strong><small>{order.items.reduce((total, item) => total + item.quantity, 0)} {order.items.length === 1 && order.items[0].quantity === 1 ? 'Item' : 'Items'}</small></div>
      <strong className="account-order-total">{formatInr(order.total)}</strong><span className={`account-order-status is-${order.status.toLowerCase()}`}>{order.status}</span><Link className="account-order-view" to={`/orders/${order.id}`}>View Order <ArrowRight /></Link>
    </article>)}</div> : <section className="account-empty"><Package /><h2>No Orders Yet</h2><p>Your first Percent piece is waiting.</p><Link to="/shop">Discover Products <ArrowRight /></Link></section>}
  </AccountShell>
}

const emptyAddress = (): AccountAddress => ({ id: `address-${Date.now()}`, label: 'Home', isDefault: false, fullName: '', addressLine1: '', addressLine2: '', city: '', state: '', pinCode: '', country: 'India', phone: '' })

export function ProfileAddressPage() {
  const { addresses, saveAddress, removeAddress } = useAccountAddresses()
  const [draft, setDraft] = useState<AccountAddress | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const submitAddress = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft) return
    const nextErrors: Record<string, string> = {}
    for (const field of ['fullName', 'addressLine1', 'city', 'state', 'country'] as const) if (!draft[field].trim()) nextErrors[field] = 'Required.'
    if (!/^\d{6}$/.test(draft.pinCode)) nextErrors.pinCode = 'Enter a valid 6-digit PIN code.'
    if (!/^[6-9]\d{9}$/.test(draft.phone)) nextErrors.phone = 'Enter a valid 10-digit phone number.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    saveAddress(draft)
    setDraft(null)
  }

  return <AccountShell>
    <AccountHeading eyebrow="Account" title="My Address" description="Manage your shipping addresses." action={<button className="account-primary-action" type="button" onClick={() => { setDraft(emptyAddress()); setErrors({}) }}><Plus /> Add New Address</button>} />
    {draft && <form className="account-address-form" onSubmit={submitAddress} noValidate><div className="account-section-title"><span>{addresses.some((address) => address.id === draft.id) ? 'Edit' : 'New'}</span><h2>{addresses.some((address) => address.id === draft.id) ? 'Edit Address' : 'Add Address'}</h2></div><div className="account-address-fields">
      {(['fullName', 'addressLine1', 'addressLine2', 'city', 'state', 'pinCode', 'country', 'phone'] as const).map((field) => { const labels = { fullName: 'Full Name', addressLine1: 'Address Line 1', addressLine2: 'Address Line 2', city: 'City', state: 'State', pinCode: 'PIN Code', country: 'Country', phone: 'Phone Number' }; return <label key={field} className={field.startsWith('addressLine') || field === 'fullName' ? 'is-full' : ''}>{labels[field]}<input type={field === 'phone' ? 'tel' : 'text'} value={draft[field]} aria-invalid={Boolean(errors[field])} onChange={(event) => setDraft((current) => current ? { ...current, [field]: field === 'pinCode' ? event.target.value.replace(/\D/g, '').slice(0, 6) : field === 'phone' ? event.target.value.replace(/\D/g, '').slice(0, 10) : event.target.value } : current)} />{errors[field] && <small>{errors[field]}</small>}</label> })}
      <label className="account-default-address"><input type="checkbox" checked={draft.isDefault} onChange={(event) => setDraft((current) => current ? { ...current, isDefault: event.target.checked } : current)} /> Set as default address</label>
    </div><div className="account-form-actions"><button type="submit">Save Address</button><button type="button" onClick={() => setDraft(null)}>Cancel</button></div></form>}
    {addresses.length ? <div className="account-address-list">{addresses.map((address) => <article className="account-address-card" key={address.id}><header><span>{address.isDefault ? 'Default' : address.label}</span><MapPin /></header><address><strong>{address.fullName}</strong><span>{address.addressLine1}</span>{address.addressLine2 && <span>{address.addressLine2}</span>}<span>{address.city}, {address.state} {address.pinCode}</span><span>{address.country}</span><small>+91 {address.phone}</small></address>{pendingDelete === address.id ? <div className="account-delete-confirmation"><p>Remove this address?</p><button type="button" onClick={() => setPendingDelete(null)}>Cancel</button><button type="button" onClick={() => { removeAddress(address.id); setPendingDelete(null) }}>Remove</button></div> : <footer><button type="button" onClick={() => { setDraft(address); setErrors({}) }}>Edit</button><button type="button" onClick={() => setPendingDelete(address.id)}>Delete</button></footer>}</article>)}</div> : !draft && <section className="account-empty"><MapPin /><h2>No Address Added</h2><p>Add a delivery address to make checkout faster.</p><button type="button" onClick={() => setDraft(emptyAddress())}>Add Address <ArrowRight /></button></section>}
  </AccountShell>
}

export function ProfileWishlistPage() {
  const wishlist = useWishlist()
  const products = wishlist.items.map(getProductDetailsById).filter((product): product is NonNullable<ReturnType<typeof getProductDetailsById>> => Boolean(product))
  return <AccountShell>
    <AccountHeading eyebrow="Account" title="Wishlist" description="Your saved pieces." />
    {products.length ? <div className="shop-product-grid account-wishlist-grid">{products.map((product) => <ShopProductCard key={product.id} product={product} wished onWishlist={() => wishlist.toggle(product.id)} />)}</div> : <section className="account-empty"><ShieldCheck /><h2>Your Wishlist Is Empty</h2><p>Save the pieces you want to come back to.</p><Link to="/shop">Explore Products <ArrowRight /></Link></section>}
  </AccountShell>
}

const getOrderItemCount = (order: AccountOrder) => order.items.reduce((total, item) => total + item.quantity, 0)

function OrderOverview({ order }: { order: AccountOrder }) {
  const itemCount = getOrderItemCount(order)
  return <section className="account-order-detail-card order-detail-overview" aria-labelledby="order-overview-heading">
    <div className="account-section-title"><Package /><h2 id="order-overview-heading">Order Overview</h2></div>
    <dl>
      <div><dt>Order Number</dt><dd>#{order.id}</dd></div>
      <div><dt>Order Date</dt><dd>{formatAccountDate(order.placedAt)}</dd></div>
      <div><dt>Current Status</dt><dd><span className={`account-order-status is-${order.status.toLowerCase()}`}>{order.status}</span></dd></div>
      <div><dt>Item Count</dt><dd>{itemCount} {itemCount === 1 ? 'Item' : 'Items'}</dd></div>
      <div><dt>Order Total</dt><dd>{formatInr(order.total)}</dd></div>
    </dl>
  </section>
}

function OrderTimeline({ order }: { order: AccountOrder }) {
  const currentStepIndex = order.timeline.reduce((latest, step, index) => step.complete ? index : latest, -1)
  return <section className={`account-order-detail-card order-detail-timeline is-${order.status.toLowerCase()}`} aria-labelledby="order-timeline-heading">
    <div className="account-section-title"><Truck /><h2 id="order-timeline-heading">Order Timeline</h2></div>
    <ol className="account-order-timeline">
      {order.timeline.map((step, index) => <li className={step.complete ? 'is-complete' : ''} key={step.label} aria-current={index === currentStepIndex ? 'step' : undefined}>
        <span aria-hidden="true">{step.complete && <Check />}</span>
        <div><strong>{step.label}</strong><small>{step.detail}</small></div>
      </li>)}
    </ol>
    <p className="order-detail-preview-note">Status information is shown from this frontend order snapshot.</p>
  </section>
}

function OrderItems({ order }: { order: AccountOrder }) {
  return <section className="account-order-detail-card order-detail-items" aria-labelledby="order-items-heading">
    <div className="account-section-title"><Package /><h2 id="order-items-heading">Items in This Order</h2></div>
    <div className="order-detail-item-list">{order.items.map((item) => {
      const productHref = `/products/${item.productSlug}`
      return <article key={item.variantId}>
        {item.image && <Link className="order-detail-item-image" to={productHref} aria-label={`View ${item.productName}`}><img src={item.image.src} alt={item.image.alt} width={item.image.width} height={item.image.height} /></Link>}
        <div className="order-detail-item-copy"><Link to={productHref}>{item.productName}</Link><span>{item.colour}</span><span>Size {item.size}</span><span>Qty: {item.quantity}</span></div>
        <dl><div><dt>Unit Price</dt><dd>{formatInr(item.unitPrice)}</dd></div><div><dt>Line Total</dt><dd>{formatInr(item.unitPrice * item.quantity)}</dd></div></dl>
      </article>
    })}</div>
  </section>
}

export function OrderDetailsPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const order = getAccountOrder(orderId)

  if (!order) return <AccountShell><section className="account-empty"><Package /><h2>Order Not Found</h2><p>We couldn't find this order.</p><Link to="/profile/orders">Back to My Orders <ArrowRight /></Link></section></AccountShell>

  const firstItem = order.items[0]

  return <AccountShell>
    <header className="order-detail-header">
      <Link className="order-detail-back" to="/profile/orders"><ArrowLeft /> Back to My Orders</Link>
      <div><h1>Order Details</h1><p>Order #{order.id}</p></div>
    </header>

    <div className="account-order-detail-layout">
      <div className="account-order-detail-main">
        <OrderOverview order={order} />
        <OrderTimeline order={order} />
        <OrderItems order={order} />
      </div>

      <aside className="account-order-detail-aside">
        <section className="account-order-detail-card order-detail-address" aria-labelledby="order-address-heading">
          <div className="account-section-title"><MapPin /><h2 id="order-address-heading">Delivery Address</h2></div>
          <address><strong>{order.address.fullName}</strong><span>{order.address.addressLine1}</span>{order.address.addressLine2 && <span>{order.address.addressLine2}</span>}<span>{order.address.city}, {order.address.state} {order.address.pinCode}</span><span>{order.address.country}</span><small>+91 {order.address.phone}</small></address>
        </section>

        <section className="account-order-detail-card order-detail-payment" aria-labelledby="order-payment-heading">
          <div className="account-section-title"><ShieldCheck /><h2 id="order-payment-heading">Payment Details</h2></div>
          <dl><div><dt>Payment Method</dt><dd>{order.paymentMethod}</dd></div><div><dt>Payment Status</dt><dd>{order.paymentStatus}</dd></div><div><dt>Amount Paid</dt><dd>{formatInr(order.total)}</dd></div></dl>
        </section>

        <section className="account-order-detail-summary" aria-labelledby="order-summary-heading">
          <p>Order Summary</p><h2 id="order-summary-heading">{formatInr(order.total)}</h2>
          <dl><div><dt>Subtotal</dt><dd>{formatInr(order.subtotal)}</dd></div><div><dt>Shipping</dt><dd>{order.shippingLabel}</dd></div><div><dt>Discount</dt><dd>{formatInr(order.discount)}</dd></div><div><dt>Total</dt><dd>{formatInr(order.total)}</dd></div></dl>
          <small>Including all taxes</small>
        </section>

        {order.status !== 'Cancelled' && <section className="account-order-detail-card order-detail-fulfillment" aria-labelledby="order-fulfillment-heading">
          <div className="account-section-title"><Truck /><h2 id="order-fulfillment-heading">Fulfilled By</h2></div>
          <strong>Delhivery</strong>
          {order.status === 'Processing' && <p>Tracking details will appear once your order has been shipped.</p>}
          {order.status === 'Shipped' && <p>This order is marked shipped in the frontend preview.</p>}
          {order.status === 'Out for Delivery' && <p>Your order is on the way.</p>}
          {order.status === 'Delivered' && <p>This frontend order is marked as delivered.</p>}
          <Link className="account-track-order" to={`/orders/${order.id}/track`}>Track Order <ArrowRight /></Link>
        </section>}
      </aside>
    </div>

    <footer className="order-detail-actions">
      <Link to="/shop">Continue Shopping <ArrowRight /></Link>
      {order.status === 'Delivered' && firstItem && <><Link to={`/products/${firstItem.productSlug}`}>View Product <ArrowRight /></Link><Link to={`/products/${firstItem.productSlug}#customer-reviews`}>Write a Review <ArrowRight /></Link></>}
    </footer>
  </AccountShell>
}
