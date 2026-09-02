import { ArrowRight, LockKeyhole, Minus, Plus } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getProductDetailsById } from '../data/productDetails'
import { formatInr } from '../data/shop'
import { useCart, type CartLine } from '../hooks/useCommerce'

interface ResolvedCartLine {
  line: CartLine
  product: ReturnType<typeof getProductDetailsById>
  variant: NonNullable<ReturnType<typeof getProductDetailsById>>['variants'][number] | undefined
}

const resolveLine = (line: CartLine): ResolvedCartLine => {
  const product = getProductDetailsById(line.productId)
  return { line, product, variant: product?.variants.find((variant) => variant.id === line.variantId) }
}

function CartItem({ item, index, onQuantityChange, onRemove }: { item: ResolvedCartLine; index: number; onQuantityChange: (quantity: number, stock: number) => void; onRemove: () => void }) {
  const { line, product, variant } = item
  const image = variant?.images?.[0] ?? product?.images[0]
  const unavailable = !product || !variant || product.isSoldOut || !variant.isAvailable || variant.stock < 1
  const stock = unavailable ? 0 : variant.stock
  const price = variant?.price ?? product?.price ?? 0
  return <article className={`cart-item ${unavailable ? 'is-unavailable' : ''}`}>
    <span className="cart-item-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
    {product && image ? <Link className="cart-item-image" to={`/products/${product.slug}`}><img src={image.src} alt={image.alt} width={image.width} height={image.height} /></Link> : <div className="cart-item-image cart-item-image-missing" aria-hidden="true">%</div>}
    <div className="cart-item-copy">
      {unavailable && <strong className="cart-item-status">Sold Out</strong>}
      {product ? <Link to={`/products/${product.slug}`}><h2>{product.name}</h2></Link> : <h2>Unavailable design</h2>}
      <dl><div><dt>Colour</dt><dd>{variant?.colour.label ?? 'Unavailable'}</dd></div><div><dt>Size</dt><dd>{variant?.size ?? 'Unavailable'}</dd></div></dl>
      <p>{formatInr(price * line.quantity)}</p>
    </div>
    <div className="cart-item-actions">
      <div className="cart-quantity" aria-label={`Quantity for ${product?.name ?? 'unavailable design'}`}><button type="button" aria-label="Decrease quantity" disabled={line.quantity <= 1} onClick={() => onQuantityChange(line.quantity - 1, stock)}><Minus /></button><output aria-live="polite">{line.quantity}</output><button type="button" aria-label="Increase quantity" disabled={unavailable || line.quantity >= stock} onClick={() => onQuantityChange(line.quantity + 1, stock)}><Plus /></button></div>
      <button type="button" className="cart-remove" onClick={onRemove}>Remove</button>
    </div>
  </article>
}

export function CartPage() {
  const { lines, updateQuantity, removeItem } = useCart()
  const items = useMemo(() => lines.map(resolveLine), [lines])
  const subtotal = items.reduce((total, { line, product, variant }) => total + (variant?.price ?? product?.price ?? 0) * line.quantity, 0)
  const hasUnavailableItem = items.some(({ product, variant }) => !product || !variant || product.isSoldOut || !variant.isAvailable || variant.stock < 1)

  useEffect(() => { const previousTitle = document.title; document.title = 'Your Cart | Percent'; return () => { document.title = previousTitle } }, [])

  if (!items.length) return <main className="cart-page cart-page-empty"><section className="cart-empty" aria-labelledby="empty-cart-heading"><p>Percent Cart</p><h1 id="empty-cart-heading">Your Cart Is Empty.</h1><span>Looks like you haven’t added a piece yet.</span><Link to="/shop">Discover Current Drop <ArrowRight /></Link></section></main>

  return <main className="cart-page">
    <div className="cart-layout">
      <section className="cart-content" aria-labelledby="cart-heading">
        <header className="cart-heading"><div><p>Percent Cart</p><h1 id="cart-heading">Your Cart</h1></div><Link to="/shop">Continue Shopping <ArrowRight /></Link></header>
        <div className="cart-list">{items.map((item, index) => <CartItem key={item.line.variantId} item={item} index={index} onQuantityChange={(quantity, stock) => updateQuantity(item.line.variantId, quantity, stock)} onRemove={() => removeItem(item.line.variantId)} />)}</div>
        <section className="cart-address" aria-labelledby="address-heading"><header><h2 id="address-heading">Address</h2><Link to="/profile">Add Address <ArrowRight /></Link></header><div><strong>No delivery address added yet.</strong><p>Add a delivery address from your profile before checkout.</p></div></section>
      </section>

      <aside className="cart-summary" aria-labelledby="summary-heading">
        <p>Order details</p><h2 id="summary-heading">Order Summary</h2>
        <dl><div><dt>Subtotal</dt><dd>{formatInr(subtotal)}</dd></div><div><dt>Shipping</dt><dd>Calculated at checkout</dd></div></dl>
        <div className="cart-total"><span>Total</span><strong>{formatInr(subtotal)}</strong><small>Including all taxes</small></div>
        {hasUnavailableItem ? <button type="button" className="cart-checkout" disabled>Remove unavailable items</button> : <Link className="cart-checkout" to="/checkout">Checkout Securely <ArrowRight /></Link>}
        <span className="cart-security"><LockKeyhole /> 100% Secure Payment</span>
      </aside>
    </div>
  </main>
}
