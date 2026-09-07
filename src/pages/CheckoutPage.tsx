import { ArrowRight, Headphones, LockKeyhole, ShieldCheck, Truck } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createTemporaryOrderReference, saveOrderConfirmation, type OrderConfirmationSnapshot } from '../data/orderConfirmation'
import { getProductDetailsById } from '../data/productDetails'
import { formatInr } from '../data/shop'
import { useCart, type CartLine } from '../hooks/useCommerce'
import { usePercentSession } from '../hooks/usePercentSession'

interface CheckoutFormData {
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

type CheckoutFieldName = keyof CheckoutFormData
type CheckoutErrors = Partial<Record<CheckoutFieldName | 'form', string>>
type ProductRecord = NonNullable<ReturnType<typeof getProductDetailsById>>

interface CheckoutLine {
  line: CartLine
  product: ReturnType<typeof getProductDetailsById>
  variant: ProductRecord['variants'][number] | undefined
}

const savedAddressKey = 'percent-checkout-address'
const emptyForm: CheckoutFormData = { email: '', phone: '', fullName: '', addressLine1: '', addressLine2: '', city: '', state: '', pinCode: '', country: 'India' }

const resolveLine = (line: CartLine): CheckoutLine => {
  const product = getProductDetailsById(line.productId)
  return { line, product, variant: product?.variants.find((variant) => variant.id === line.variantId) }
}

const readSavedAddress = (): CheckoutFormData | null => {
  try {
    const parsed = JSON.parse(localStorage.getItem(savedAddressKey) ?? 'null') as Partial<CheckoutFormData> | null
    if (!parsed || typeof parsed !== 'object') return null
    return { ...emptyForm, ...parsed, country: parsed.country || 'India' }
  } catch {
    return null
  }
}

const validateCheckout = (values: CheckoutFormData): CheckoutErrors => {
  const errors: CheckoutErrors = {}
  if (!values.email.trim()) errors.email = 'Email address is required.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Enter a valid email address.'
  const phoneDigits = values.phone.replace(/\D/g, '')
  if (!phoneDigits) errors.phone = 'Phone number is required.'
  else if (!/^[6-9]\d{9}$/.test(phoneDigits)) errors.phone = 'Enter a valid 10-digit Indian phone number.'
  if (!values.fullName.trim()) errors.fullName = 'Full name is required.'
  if (!values.addressLine1.trim()) errors.addressLine1 = 'Address Line 1 is required.'
  if (!values.city.trim()) errors.city = 'City is required.'
  if (!values.state.trim()) errors.state = 'State is required.'
  if (!values.pinCode.trim()) errors.pinCode = 'PIN code is required.'
  else if (!/^\d{6}$/.test(values.pinCode.trim())) errors.pinCode = 'Enter a valid 6-digit Indian PIN code.'
  if (!values.country.trim()) errors.country = 'Country is required.'
  return errors
}

function CheckoutField({ id, label, required = false, error, children, className = '' }: { id: string; label: string; required?: boolean; error?: string; children: ReactNode; className?: string }) {
  return <div className={`checkout-field ${className}`}><label htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</label>{children}{error && <p id={`${id}-error`} className="checkout-field-error">{error}</p>}</div>
}

function CheckoutSummary({ items, subtotal, discount, hasUnavailableItem }: { items: CheckoutLine[]; subtotal: number; discount: number; hasUnavailableItem: boolean }) {
  const total = Math.max(0, subtotal - discount)
  return <aside className="checkout-order-summary" aria-labelledby="checkout-summary-heading">
    <p className="checkout-kicker">Order details</p>
    <h2 id="checkout-summary-heading">Order Summary</h2>
    <div className="checkout-summary-items">{items.map(({ line, product, variant }) => {
      const image = variant?.images?.[0] ?? product?.images[0]
      const unavailable = !product || !variant || product.isSoldOut || !variant.isAvailable || variant.stock < line.quantity
      const price = variant?.price ?? product?.price ?? 0
      return <article className={`checkout-summary-item ${unavailable ? 'is-unavailable' : ''}`} key={line.variantId}>
        {product && image ? <Link to={`/products/${product.slug}`} className="checkout-summary-image"><img src={image.src} alt={image.alt} width={image.width} height={image.height} /></Link> : <div className="checkout-summary-image checkout-summary-image-missing" aria-hidden="true">%</div>}
        <div><strong>{product?.name ?? 'Unavailable design'}</strong><span>{variant?.colour.label ?? 'Unavailable'} · {variant?.size ?? 'Unavailable'}</span><small>Quantity {line.quantity}{unavailable ? ' · Unavailable' : ''}</small></div>
        <b>{formatInr(price * line.quantity)}</b>
      </article>
    })}</div>
    <dl className="checkout-price-summary"><div><dt>Subtotal</dt><dd>{formatInr(subtotal)}</dd></div><div><dt>Shipping</dt><dd>Calculated at checkout</dd></div><div><dt>Discount</dt><dd>{formatInr(discount)}</dd></div></dl>
    <div className="checkout-total"><span>Total</span><strong>{formatInr(total)}</strong><small>Including all taxes</small></div>
    {hasUnavailableItem && <p className="checkout-summary-warning">An unavailable item must be removed from your cart before payment.</p>}
    <div className="checkout-trust" aria-label="Checkout information"><div><ShieldCheck /><span><strong>Secure Payment</strong>Powered by Razorpay</span></div><div><Truck /><span><strong>Shipping</strong>Fulfilled through Delhivery</span></div><div><Headphones /><span><strong>Easy Support</strong>Help when you need it</span></div></div>
  </aside>
}

export function CheckoutPage() {
  const { lines, clearCart } = useCart()
  const { user } = usePercentSession()
  const navigate = useNavigate()
  const formRef = useRef<HTMLFormElement>(null)
  const submitted = useRef(false)
  const items = useMemo(() => lines.map(resolveLine), [lines])
  const [savedAddress, setSavedAddress] = useState<CheckoutFormData | null>(readSavedAddress)
  const [values, setValues] = useState<CheckoutFormData>(() => ({ ...emptyForm, fullName: user?.displayName ?? '' }))
  const [errors, setErrors] = useState<CheckoutErrors>({})
  const [rememberAddress, setRememberAddress] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [promoFeedback, setPromoFeedback] = useState('')
  const [paymentFeedback, setPaymentFeedback] = useState('')
  const subtotal = items.reduce((total, { line, product, variant }) => total + (variant?.price ?? product?.price ?? 0) * line.quantity, 0)
  const discount = 0
  const hasUnavailableItem = items.some(({ line, product, variant }) => !product || !variant || product.isSoldOut || !variant.isAvailable || variant.stock < line.quantity)

  useEffect(() => { const previousTitle = document.title; document.title = 'Checkout | Percent'; return () => { document.title = previousTitle } }, [])

  const updateField = (field: CheckoutFieldName, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }))
    setPaymentFeedback('')
  }

  const applyPromoCode = () => {
    if (!promoCode.trim()) { setPromoFeedback('Enter a promo code first.'); return }
    setPromoFeedback('Promo codes are not active in this frontend preview.')
  }

  const submitCheckout = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validateCheckout(values)
    if (hasUnavailableItem) nextErrors.form = 'Return to your cart and remove unavailable items before continuing.'
    setErrors(nextErrors)
    setPaymentFeedback('')
    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    if (rememberAddress) {
      localStorage.setItem(savedAddressKey, JSON.stringify(values))
      setSavedAddress(values)
    }
    if (submitted.current) return
    submitted.current = true
    const placedAt = new Date()
    const order: OrderConfirmationSnapshot = {
      version: 1,
      orderReference: createTemporaryOrderReference(placedAt),
      placedAt: placedAt.toISOString(),
      items: items.flatMap(({ line, product, variant }) => product && variant ? [{ productId: product.id, variantId: variant.id, productSlug: product.slug, productName: product.name, colour: variant.colour.label, size: variant.size, quantity: line.quantity, unitPrice: variant.price, image: variant.images?.[0] ?? product.images[0] }] : []),
      address: values,
      subtotal,
      shippingLabel: 'Calculated at checkout',
      discount,
      total: Math.max(0, subtotal - discount),
    }
    saveOrderConfirmation(order)
    setPaymentFeedback('Preparing your frontend order confirmation.')
    clearCart()
    navigate('/order-confirmation', { state: { order } })
  }

  if (!items.length) return <main className="checkout-page checkout-empty"><section aria-labelledby="checkout-empty-heading"><p className="checkout-kicker">Percent Checkout</p><h1 id="checkout-empty-heading">Your Cart Is Empty.</h1><span>Add something before checking out.</span><Link to="/shop">Return to Shop <ArrowRight /></Link></section></main>

  return <main className="checkout-page">
    <header className="checkout-page-heading"><p className="checkout-kicker">Percent Checkout</p><h1>Checkout</h1></header>
    <ol className="checkout-progress" aria-label="Checkout progress"><li className="is-active"><span>1</span>Contact</li><li><span>2</span>Delivery Address</li><li><span>3</span>Payment</li></ol>

    <form ref={formRef} className="checkout-form-shell" noValidate onSubmit={submitCheckout}>
      <div className="checkout-form-sections">
        <section className="checkout-panel" aria-labelledby="contact-information-heading">
          <div className="checkout-panel-heading"><span>01</span><div><p className="checkout-kicker">Your details</p><h2 id="contact-information-heading">Contact Information</h2></div></div>
          <div className="checkout-field-grid">
            <CheckoutField id="checkout-email" label="Email Address" required error={errors.email}><input id="checkout-email" name="email" type="email" autoComplete="email" value={values.email} placeholder="you@example.com" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'checkout-email-error' : undefined} onChange={(event) => updateField('email', event.target.value)} /></CheckoutField>
            <CheckoutField id="checkout-phone" label="Phone Number" required error={errors.phone}><div className="checkout-phone-input"><span aria-hidden="true">+91</span><input id="checkout-phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={values.phone} placeholder="98765 43210" aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? 'checkout-phone-error' : undefined} onChange={(event) => updateField('phone', event.target.value.replace(/\D/g, '').slice(0, 10))} /></div></CheckoutField>
          </div>
        </section>

        <section className="checkout-panel" aria-labelledby="delivery-address-heading">
          <div className="checkout-panel-heading"><span>02</span><div><p className="checkout-kicker">Where it goes</p><h2 id="delivery-address-heading">Delivery Address</h2></div></div>
          <div className="checkout-saved-address"><div><strong>Use Saved Address</strong><span>{savedAddress ? 'A locally saved checkout address is available.' : 'No saved addresses are available yet.'}</span></div><button type="button" disabled={!savedAddress} onClick={() => { if (savedAddress) { setValues(savedAddress); setErrors({}); setPaymentFeedback('') } }}>Use Address</button></div>
          <div className="checkout-field-grid checkout-address-grid">
            <CheckoutField id="checkout-name" label="Full Name" required error={errors.fullName} className="is-full"><input id="checkout-name" name="fullName" type="text" autoComplete="name" value={values.fullName} placeholder="Full name" aria-invalid={Boolean(errors.fullName)} aria-describedby={errors.fullName ? 'checkout-name-error' : undefined} onChange={(event) => updateField('fullName', event.target.value)} /></CheckoutField>
            <CheckoutField id="checkout-address-1" label="Address Line 1" required error={errors.addressLine1} className="is-full"><input id="checkout-address-1" name="addressLine1" type="text" autoComplete="address-line1" value={values.addressLine1} placeholder="House number and street" aria-invalid={Boolean(errors.addressLine1)} aria-describedby={errors.addressLine1 ? 'checkout-address-1-error' : undefined} onChange={(event) => updateField('addressLine1', event.target.value)} /></CheckoutField>
            <CheckoutField id="checkout-address-2" label="Address Line 2 (Optional)" className="is-full"><input id="checkout-address-2" name="addressLine2" type="text" autoComplete="address-line2" value={values.addressLine2} placeholder="Apartment, landmark, area" onChange={(event) => updateField('addressLine2', event.target.value)} /></CheckoutField>
            <CheckoutField id="checkout-city" label="City" required error={errors.city}><input id="checkout-city" name="city" type="text" autoComplete="address-level2" value={values.city} placeholder="City" aria-invalid={Boolean(errors.city)} aria-describedby={errors.city ? 'checkout-city-error' : undefined} onChange={(event) => updateField('city', event.target.value)} /></CheckoutField>
            <CheckoutField id="checkout-state" label="State" required error={errors.state}><input id="checkout-state" name="state" type="text" autoComplete="address-level1" value={values.state} placeholder="State" aria-invalid={Boolean(errors.state)} aria-describedby={errors.state ? 'checkout-state-error' : undefined} onChange={(event) => updateField('state', event.target.value)} /></CheckoutField>
            <CheckoutField id="checkout-pin" label="PIN Code" required error={errors.pinCode}><input id="checkout-pin" name="pinCode" type="text" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={values.pinCode} placeholder="000000" aria-invalid={Boolean(errors.pinCode)} aria-describedby={errors.pinCode ? 'checkout-pin-error' : undefined} onChange={(event) => updateField('pinCode', event.target.value.replace(/\D/g, '').slice(0, 6))} /></CheckoutField>
            <CheckoutField id="checkout-country" label="Country" required error={errors.country}><select id="checkout-country" name="country" autoComplete="country-name" value={values.country} aria-invalid={Boolean(errors.country)} aria-describedby={errors.country ? 'checkout-country-error' : undefined} onChange={(event) => updateField('country', event.target.value)}><option value="India">India</option></select></CheckoutField>
          </div>
          <label className="checkout-save-address"><input type="checkbox" checked={rememberAddress} onChange={(event) => setRememberAddress(event.target.checked)} /><span><strong>Save this address for next time</strong><small>Stored only on this device during the frontend preview.</small></span></label>
        </section>

        <section className="checkout-panel checkout-promo" aria-labelledby="promo-code-heading">
          <div><p className="checkout-kicker">Optional</p><h2 id="promo-code-heading">Promo Code</h2></div>
          <div className="checkout-promo-control"><label className="sr-only" htmlFor="checkout-promo">Enter promo code</label><input id="checkout-promo" type="text" value={promoCode} placeholder="Enter promo code" onChange={(event) => { setPromoCode(event.target.value.toUpperCase()); setPromoFeedback('') }} /><button type="button" onClick={applyPromoCode}>Apply</button></div>
          <p className="checkout-promo-feedback" aria-live="polite">{promoFeedback}</p>
        </section>
      </div>

      <CheckoutSummary items={items} subtotal={subtotal} discount={discount} hasUnavailableItem={hasUnavailableItem} />

      <section className="checkout-payment" aria-labelledby="secure-payment-heading">
        <div className="checkout-payment-copy"><span><LockKeyhole /></span><div><p className="checkout-kicker">Secure payment</p><h2 id="secure-payment-heading">Razorpay</h2><small>Secure payments powered by Razorpay.</small></div></div>
        {errors.form && <p className="checkout-payment-error" role="alert">{errors.form}</p>}
        <button type="submit" className="checkout-pay-button">Pay Securely <ArrowRight /></button>
        <div className="checkout-payment-meta"><span><ShieldCheck /> 100% Secure Payment</span><span>Powered by Razorpay</span></div>
        <p className="checkout-payment-feedback" aria-live="polite">{paymentFeedback}</p>
      </section>
    </form>
  </main>
}
