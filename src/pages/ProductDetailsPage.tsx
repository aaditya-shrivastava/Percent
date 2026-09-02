import { Check, ChevronDown, Heart, Minus, Plus, Star, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ShopProductCard } from '../components/product/ShopProductCard'
import { ProductReviews } from '../components/product/ProductReviews'
import type { ProductDetailsResponse } from '../data/productDetails'
import { formatInr, safeSwatch } from '../data/shop'
import { addCartItem, useWishlist } from '../hooks/useCommerce'
import { useProductDetails } from '../hooks/useProductDetails'
import type { FitType, ProductDetails, ProductImage } from '../types'

const sizeGuides: Record<FitType, Array<{ size: string; chest: string; length: string }>> = {
  standard: [{ size: 'S', chest: '38 in', length: '27 in' }, { size: 'M', chest: '40 in', length: '28 in' }, { size: 'L', chest: '42 in', length: '29 in' }, { size: 'XL', chest: '44 in', length: '30 in' }],
  oversized: [{ size: 'S', chest: '42 in', length: '28 in' }, { size: 'M', chest: '44 in', length: '29 in' }, { size: 'L', chest: '46 in', length: '30 in' }, { size: 'XL', chest: '48 in', length: '31 in' }],
}

function Stars({ rating }: { rating: number }) { return <span className="pdp-stars" aria-label={`${rating.toFixed(1)} out of 5 stars`}>{Array.from({ length: 5 }, (_, index) => <Star key={index} size={15} fill={index < Math.round(rating) ? 'currentColor' : 'none'} />)}</span> }

function ProductSkeleton() { return <main className="pdp-page"><div className="pdp-breadcrumb pdp-skeleton-line" /><section className="pdp-primary pdp-skeleton"><div className="pdp-skeleton-thumbs">{Array.from({ length: 4 }, (_, index) => <i key={index} />)}</div><div className="pdp-skeleton-main" /><div className="pdp-skeleton-info"><i /><i /><i /><i /><i /></div></section></main> }

function ProductState({ failed = false }: { failed?: boolean }) { return <main className="pdp-state"><p>{failed ? 'Something interrupted the connection.' : 'This design may have moved or is no longer publicly available.'}</p><h1>{failed ? 'Unable to load design' : 'Design not found'}</h1><Link className="pdp-primary-action" to="/shop">Return to Shop</Link></main> }

function SizeGuideModal({ fit, onClose }: { fit: FitType; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null)
  useEffect(() => { const previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; closeButton.current?.focus(); const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }; window.addEventListener('keydown', closeOnEscape); return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', closeOnEscape) } }, [onClose])
  return <div className="pdp-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="pdp-size-guide" role="dialog" aria-modal="true" aria-labelledby="size-guide-title"><header><div><p>Percent sizing</p><h2 id="size-guide-title">{fit === 'standard' ? 'Standard Fit' : 'Oversized Fit'}</h2></div><button ref={closeButton} type="button" aria-label="Close size guide" onClick={onClose}><X /></button></header><p>Measurements are garment measurements. Compare them with a T-shirt you already own.</p><div className="pdp-size-table" role="table" aria-label={`${fit} size guide`}><div role="row"><strong role="columnheader">Size</strong><strong role="columnheader">Chest</strong><strong role="columnheader">Length</strong></div>{sizeGuides[fit].map((row) => <div role="row" key={row.size}><span role="cell">{row.size}</span><span role="cell">{row.chest}</span><span role="cell">{row.length}</span></div>)}</div></section></div>
}

function DetailAccordion({ title, children, initiallyOpen = false }: { title: string; children: React.ReactNode; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen)
  const id = `accordion-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  const toggle = () => setOpen((value) => !value)
  return <div className="pdp-accordion"><button type="button" aria-expanded={open} aria-controls={id} onClick={toggle} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle() } }}><span>{title}</span>{open ? <Minus /> : <Plus />}</button><div id={id} className={open ? 'is-open' : ''}><div>{children}</div></div></div>
}

function Gallery({ images, activeImage, onSelect }: { images: ProductImage[]; activeImage: ProductImage; onSelect: (image: ProductImage) => void }) {
  return <div className="pdp-gallery"><div className="pdp-thumbnails" aria-label="Product gallery thumbnails">{images.map((image, index) => <button key={image.id ?? image.src} type="button" className={activeImage.src === image.src ? 'is-active' : ''} aria-label={`View image ${index + 1}: ${image.alt}`} aria-pressed={activeImage.src === image.src} onClick={() => onSelect(image)}><img src={image.src} alt="" width={image.width} height={image.height} loading={index < 2 ? 'eager' : 'lazy'} /></button>)}</div><div className="pdp-main-image"><img key={activeImage.src} src={activeImage.src} alt={activeImage.alt} width={activeImage.width} height={activeImage.height} fetchPriority="high" decoding="async" /></div></div>
}

function ProductBadges({ product }: { product: ProductDetails }) {
  const badges = [{ show: product.retirementState === 'retired', label: 'Archived' }, { show: product.isSoldOut, label: 'Sold Out' }, { show: product.isLimitedEdition && product.retirementState !== 'retired', label: 'Limited' }, { show: product.isNew && product.retirementState !== 'retired', label: 'New' }, { show: product.isBestSeller && product.retirementState !== 'retired', label: 'Best Seller' }, { show: product.isTrending && product.retirementState !== 'retired', label: 'Trending' }].filter((badge) => badge.show)
  return badges.length ? <div className="pdp-badges">{badges.map((badge) => <span key={badge.label}>{badge.label}</span>)}</div> : null
}

export function ProductDetailsPage() {
  const { slug } = useParams<{ slug: string }>()
  const { data, loading, error } = useProductDetails(slug)
  if (loading) return <ProductSkeleton />
  if (error || !data) return <ProductState failed={error === 'failed'} />
  return <ProductDetailsContent key={data.product.id} data={data} />
}

function ProductDetailsContent({ data }: { data: ProductDetailsResponse }) {
  const wishlist = useWishlist()
  const product = data.product
  const [selectedColourId, setSelectedColourId] = useState(product.colors[0]?.id ?? '')
  const [selectedSize, setSelectedSize] = useState('')
  const [activeImage, setActiveImage] = useState<ProductImage>(product.images[0])
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false)
  const [selectionError, setSelectionError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [displayReviewSummary, setDisplayReviewSummary] = useState(product.reviewSummary)
  const sizeGroup = useRef<HTMLFieldSetElement>(null)

  const colourVariants = useMemo(() => product.variants.filter((variant) => variant.colour.id === selectedColourId), [product, selectedColourId])
  const gallery = useMemo(() => colourVariants.find((variant) => variant.images?.length)?.images ?? product.images, [colourVariants, product])
  const selectedVariant = colourVariants.find((variant) => variant.size === selectedSize)
  const displayVariant = selectedVariant ?? colourVariants[0]
  const displayedImage = gallery.find((image) => image.src === activeImage.src) ?? gallery[0]
  const archived = product.retirementState === 'retired'

  useEffect(() => {
    if (!product) return undefined
    const previousTitle = document.title
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]') ?? document.head.appendChild(document.createElement('meta'))
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]') ?? document.head.appendChild(document.createElement('link'))
    const ogImage = document.querySelector<HTMLMetaElement>('meta[property="og:image"]') ?? document.head.appendChild(document.createElement('meta'))
    document.title = `${product.name} | Percent`
    description.name = 'description'; description.content = product.shortDescription
    canonical.rel = 'canonical'; canonical.href = `${window.location.origin}/products/${product.slug}`
    ogImage.setAttribute('property', 'og:image'); ogImage.content = product.images[0].src
    const schema = document.createElement('script'); schema.id = 'product-detail-schema'; schema.type = 'application/ld+json'; schema.text = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name: product.name, image: product.images.map((image) => image.src), description: product.shortDescription, sku: product.id, offers: { '@type': 'Offer', priceCurrency: 'INR', price: product.price, availability: product.isSoldOut ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock', url: canonical.href }, ...(product.reviewSummary.reviewCount ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: product.reviewSummary.averageRating, reviewCount: product.reviewSummary.reviewCount } } : {}) }); document.head.appendChild(schema)
    return () => { document.title = previousTitle; schema.remove() }
  }, [product])

  const soldPercentage = product.totalPieces > 0 ? Math.min(100, Math.max(0, product.soldPieces / product.totalPieces * 100)) : 0
  const discount = displayVariant?.compareAtPrice && displayVariant.compareAtPrice > displayVariant.price ? Math.round((displayVariant.compareAtPrice - displayVariant.price) / displayVariant.compareAtPrice * 100) : 0
  const wished = wishlist.items.includes(product.id)
  const uniqueSizes = product.sizes.filter((size, index, sizes) => sizes.indexOf(size) === index)
  const addToCart = () => {
    if (!selectedColourId) { setSelectionError('Choose a colour before adding this piece.'); return }
    if (!selectedSize) { setSelectionError('Select an available size before adding this piece.'); sizeGroup.current?.focus(); return }
    if (!selectedVariant?.isAvailable || product.isSoldOut) { setSelectionError('This variant is currently unavailable.'); return }
    addCartItem(product.id, selectedVariant.id, selectedVariant.stock); setSelectionError(''); setFeedback(`${product.name}, ${selectedVariant.colour.label}, size ${selectedVariant.size} added to your bag.`)
  }
  const extraDetails = [{ title: 'Product Details', content: product.fullDescription }, { title: 'Material and Care', content: [product.material, product.careInstructions].filter(Boolean).join(' · ') }, { title: 'Fit and Size', content: `${product.fitType === 'standard' ? 'Standard Fit' : 'Oversized Fit'}. Available sizes: ${uniqueSizes.join(', ')}.` }, { title: 'Shipping and Returns', content: product.shippingAndReturns }, ...(product.collaborator ? [{ title: 'Collaboration Information', content: [product.collaborator.title, product.collaborator.description].filter(Boolean).join(' — ') }] : [])].filter((item) => item.content)

  return <main className="pdp-page product-details-page">
    <nav className="pdp-breadcrumb" aria-label="Breadcrumb"><Link to="/">Home</Link><span>/</span><Link to="/shop">Shop</Link><span>/</span><span aria-current="page">{product.name}</span></nav>
    <section className="pdp-primary">
      <Gallery images={gallery} activeImage={displayedImage} onSelect={setActiveImage} />
      <div className="pdp-info">
        <ProductBadges product={product} />
        <div className="pdp-title"><p>{product.fitType === 'standard' ? 'Standard Fit' : 'Oversized Fit'}</p><h1>{product.name}</h1></div>
        <div className="pdp-rating">{displayReviewSummary.reviewCount ? <><Stars rating={displayReviewSummary.averageRating} /><a href="#customer-reviews">{displayReviewSummary.averageRating.toFixed(1)} · {displayReviewSummary.reviewCount} reviews</a></> : <a href="#customer-reviews">No reviews yet</a>}</div>
        <div className="pdp-price"><strong>{formatInr(displayVariant?.price ?? product.price)}</strong>{displayVariant?.compareAtPrice && <del>{formatInr(displayVariant.compareAtPrice)}</del>}{discount > 0 && <span>{discount}% off</span>}</div>
        <p className="pdp-short-description">{product.shortDescription}</p>
        <div className={`pdp-inventory ${product.isSoldOut ? 'is-sold-out' : ''}`}><div><strong>{archived ? '100 / 100 sold' : `${product.soldPieces} of ${product.totalPieces} sold`}</strong><span>{archived ? 'Forever archived' : `${product.remainingPieces} of ${product.totalPieces} remaining`}</span></div><i><b style={{ width: `${soldPercentage}%` }} /></i></div>
        {archived ? <div className="pdp-archive-notice"><strong>This design is archived.</strong><span>One hundred pieces were made. There will be no restock or repeat.</span><Link to="/sold-out-designs">Return to the archive</Link></div> : <>
          <fieldset className="pdp-option-group"><legend>Colour <span>{product.colors.find((colour) => colour.id === selectedColourId)?.label}</span></legend><div className="pdp-colours">{product.colors.map((colour) => <button key={colour.id} type="button" className={selectedColourId === colour.id ? 'is-selected' : ''} aria-label={`Select ${colour.label}`} aria-pressed={selectedColourId === colour.id} onClick={() => { setSelectedColourId(colour.id); setSelectedSize(''); setSelectionError(''); const nextImages = product.variants.find((variant) => variant.colour.id === colour.id)?.images; if (nextImages?.[0]) setActiveImage(nextImages[0]) }}><i style={{ background: safeSwatch(colour) }} />{selectedColourId === colour.id && <Check />}</button>)}</div></fieldset>
          <fieldset ref={sizeGroup} className="pdp-option-group product-size-section" tabIndex={-1} aria-labelledby="product-size-label"><div className="product-size-header"><span id="product-size-label">Size</span><button className="pdp-size-guide-trigger product-size-guide" type="button" onClick={() => setSizeGuideOpen(true)}>Size Guide <ChevronDown /></button></div><div className="pdp-sizes product-size-options">{uniqueSizes.map((size) => { const variant = colourVariants.find((item) => item.size === size); const available = Boolean(variant?.isAvailable) && !product.isSoldOut; return <button key={size} type="button" disabled={!available} className={`product-size-option ${selectedSize === size ? 'is-selected' : ''}`} aria-pressed={selectedSize === size} onClick={() => { setSelectedSize(size); setSelectionError('') }}>{size}</button> })}</div></fieldset>
          {selectionError && <p className="pdp-validation" role="alert">{selectionError}</p>}
          <div className="pdp-purchase product-purchase-actions"><button type="button" className="pdp-primary-action" disabled={product.isSoldOut} onClick={addToCart}>{product.isSoldOut ? 'Sold Out' : 'Add to Cart'}</button><button type="button" className={`pdp-wishlist ${wished ? 'is-active' : ''}`} aria-label={wished ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`} aria-pressed={wished} onClick={() => { wishlist.toggle(product.id); setFeedback(wished ? 'Removed from your wishlist.' : 'Saved to your wishlist.') }}><Heart fill={wished ? 'currentColor' : 'none'} /></button></div>
          <p className="pdp-feedback" aria-live="polite">{feedback}</p>
        </>}
      </div>
    </section>

    {product.collaborator && <section className="pdp-collaboration"><div><p>Limited collaboration</p><h2>{product.collaborator.title ?? product.collaborator.name}</h2><strong>With {product.collaborator.name}</strong><span>{product.collaborator.description}</span></div>{product.collaborator.image && <img src={product.collaborator.image.src} alt={product.collaborator.image.alt} width={product.collaborator.image.width} height={product.collaborator.image.height} loading="lazy" />}</section>}

    <section className="pdp-details"><div><p>Details</p><h2>Made to live beyond the drop.</h2><span>{product.fullDescription}</span><dl><div><dt>Size & Fit</dt><dd>{product.fitType === 'standard' ? 'Standard Fit' : 'Oversized Fit'}</dd></div><div><dt>Material</dt><dd>{product.material}</dd></div>{product.style && <div><dt>Style</dt><dd>{product.style}</dd></div>}{product.shippingAndReturns && <div><dt>Shipping & Returns</dt><dd>{product.shippingAndReturns}</dd></div>}</dl></div><img src={(product.images[1] ?? product.images[0]).src} alt={(product.images[1] ?? product.images[0]).alt} width={(product.images[1] ?? product.images[0]).width} height={(product.images[1] ?? product.images[0]).height} loading="lazy" /></section>

    <ProductReviews productSlug={product.slug} initialReviews={product.reviews} onSummaryChange={setDisplayReviewSummary} />

    <section className="pdp-extra"><p>Extra Product Details</p><h2>Everything worth knowing.</h2><div>{extraDetails.map((item, index) => <DetailAccordion key={item.title} title={item.title} initiallyOpen={index === 0}>{item.content}</DetailAccordion>)}</div></section>

    <section className="pdp-related"><header className="related-products-header"><div><p>You May Also Like</p><h2 className="related-products-title">Continue exploring.</h2></div><Link className="related-products-view-all" to="/shop">View All</Link></header><div className="shop-product-grid related-products-grid">{data.related.map((relatedProduct) => <ShopProductCard key={relatedProduct.id} product={relatedProduct} wished={wishlist.items.includes(relatedProduct.id)} onWishlist={() => wishlist.toggle(relatedProduct.id)} />)}</div></section>
    {sizeGuideOpen && <SizeGuideModal fit={product.fitType} onClose={() => setSizeGuideOpen(false)} />}
  </main>
}
