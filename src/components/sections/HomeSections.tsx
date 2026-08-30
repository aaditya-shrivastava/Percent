import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { bestSellerProducts, designs, heroBanners, limitedProducts } from '../../data/homepage'
import type { Product, ProductCategory } from '../../types'
import { LinkButton } from '../common/LinkButton'
import { ProductCard } from '../product/ProductCard'

const HERO_INTERVAL_MS = 2000
const HERO_TRANSITION_MS = 650
const REGULAR_ANIMATION_MS = 850

export function Hero() {
  const banners = useMemo(() => heroBanners.filter((banner) => banner.active).sort((first, second) => first.displayOrder - second.displayOrder), [])
  const [active, setActive] = useState(0)
  const [leaving, setLeaving] = useState<number | null>(null)
  const [direction, setDirection] = useState<'next' | 'previous'>('next')
  const touchStart = useRef<number | null>(null)
  const activeBanner = useRef(0)
  const leavingTimer = useRef<number | null>(null)
  const bannerCount = banners.length
  const move = useCallback((amount: -1 | 1) => { const current = activeBanner.current; activeBanner.current = (current + amount + bannerCount) % bannerCount; setDirection(amount > 0 ? 'next' : 'previous'); setLeaving(current); setActive(activeBanner.current); if (leavingTimer.current !== null) window.clearTimeout(leavingTimer.current); leavingTimer.current = window.setTimeout(() => setLeaving(null), HERO_TRANSITION_MS + 25) }, [bannerCount])
  const moveRef = useRef(move)

  useEffect(() => { const nextBanner = banners[(active + 1) % bannerCount]; if (!nextBanner) return; const image = new Image(); image.src = nextBanner.image }, [active, bannerCount, banners])
  useEffect(() => () => { if (leavingTimer.current !== null) window.clearTimeout(leavingTimer.current) }, [])

  useEffect(() => {
    if (bannerCount < 2) return undefined
    const interval = window.setInterval(() => moveRef.current(1), HERO_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [bannerCount])

  if (!banners.length) return null
  const displayNumber = String(active + 1).padStart(2, '0')
  const totalNumber = String(banners.length).padStart(2, '0')
  return <section className={`hero hero--${direction}`} data-home-hero aria-roledescription="carousel" aria-label="Percent campaign banners" tabIndex={0} onKeyDown={(event) => { if (event.key === 'ArrowLeft') move(-1); if (event.key === 'ArrowRight') move(1) }} onPointerDown={(event) => { touchStart.current = event.clientX }} onPointerUp={(event) => { if (touchStart.current === null) return; const distance = event.clientX - touchStart.current; if (Math.abs(distance) > 45) move(distance < 0 ? 1 : -1); touchStart.current = null }}>
    <div className="hero-media">{banners.map((banner, index) => <img key={banner.id} className={`${index === active ? 'is-active' : ''} ${index === leaving ? 'is-leaving' : ''}`} src={banner.image} alt={index === active ? banner.alt : ''} width={banner.width} height={banner.height} fetchPriority={index === 0 ? 'high' : 'auto'} loading={index === 0 ? 'eager' : 'lazy'} />)}</div>
    <div className="hero-copy"><p className="eyebrow">NEW DROP</p><h1>REDEFINED{`\n`}BASICS.</h1><p>Every Drop is Limited.{`\n`}Every Piece Tells A Story.</p><LinkButton to="/collection/limited" dark>SHOP THE DROP</LinkButton></div>
    <div className="hero-footer"><span>{displayNumber}<b />{totalNumber}</span><div className="hero-controls"><button className="icon-button" onClick={() => move(-1)} aria-label="Previous banner"><ArrowLeft size={19} /></button><button className="icon-button" onClick={() => move(1)} aria-label="Next banner"><ArrowRight size={19} /></button></div></div>
  </section>
}

export function LimitedEditions() { return <section className="limited section" data-limited-editions><div className="limited-heading"><div><h2>Limited Editions</h2><p>Creator collaborations, released in limited numbers.</p></div><Link to="/collection/limited">View All <ArrowRight size={15} /></Link></div>{limitedProducts.length ? <div className="limited-grid homepage-card-grid">{limitedProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <p className="section-empty">New collaborations are coming soon.</p>}</section> }

const regularPositionMap: Record<number, { x: number; y: number; scale: number; opacity: number; zIndex: number }> = {
  [-4]: { x: -640, y: 88, scale: .65, opacity: 0, zIndex: 10 },
  [-3]: { x: -500, y: 70, scale: .72, opacity: 1, zIndex: 20 },
  [-2]: { x: -360, y: 52, scale: .8, opacity: 1, zIndex: 30 },
  [-1]: { x: -200, y: 28, scale: .9, opacity: 1, zIndex: 40 },
  0: { x: 0, y: 0, scale: 1, opacity: 1, zIndex: 50 },
  1: { x: 200, y: 28, scale: .9, opacity: 1, zIndex: 40 },
  2: { x: 360, y: 52, scale: .8, opacity: 1, zIndex: 30 },
  3: { x: 500, y: 70, scale: .72, opacity: 1, zIndex: 20 },
  4: { x: 640, y: 88, scale: .65, opacity: 0, zIndex: 10 },
}

export function BestSellersCarousel() {
  const products = bestSellerProducts
  const productCount = products.length
  const [virtualCenter, setVirtualCenter] = useState(() => productCount * 1000)
  const [paused, setPaused] = useState(false)
  const [timerVersion, setTimerVersion] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const touchStart = useRef<number | null>(null)
  const animationTimer = useRef<number | null>(null)
  const animationLock = useRef(false)
  const finishAnimation = useCallback(() => { if (animationTimer.current !== null) window.clearTimeout(animationTimer.current); animationTimer.current = null; animationLock.current = false; setIsAnimating(false) }, [])
  const navigate = useCallback((direction: -1 | 1, resetTimer = true) => { if (animationLock.current || isAnimating) return; animationLock.current = true; setIsAnimating(true); setVirtualCenter((current) => current + direction); if (resetTimer) setTimerVersion((version) => version + 1); animationTimer.current = window.setTimeout(finishAnimation, REGULAR_ANIMATION_MS + 50) }, [finishAnimation, isAnimating])
  const navigateNext = useCallback((resetTimer = true) => navigate(1, resetTimer), [navigate])
  const navigatePrevious = useCallback((resetTimer = true) => navigate(-1, resetTimer), [navigate])

  useEffect(() => () => { if (animationTimer.current !== null) window.clearTimeout(animationTimer.current) }, [])

  useEffect(() => {
    if (paused || productCount < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const interval = window.setInterval(() => navigateNext(false), 4500)
    return () => window.clearInterval(interval)
  }, [navigateNext, paused, productCount, timerVersion])

  if (!productCount) return <section className="regular section" data-best-sellers><div className="regular-heading"><h2>Best Sellers</h2><p className="regular-quote">Most loved pieces, chosen again and again.</p></div><p className="section-empty">Customer favourites will appear here soon.</p></section>
  const virtualIndexes = Array.from({ length: 9 }, (_, index) => virtualCenter - 4 + index)
  return <section className="regular section" data-best-sellers aria-roledescription="carousel" aria-label="Best sellers carousel" tabIndex={0} onKeyDown={(event) => { if (event.key === 'ArrowLeft') navigatePrevious(); if (event.key === 'ArrowRight') navigateNext() }} onPointerMove={(event) => { if (event.pointerType === 'mouse') setPaused(true) }} onPointerLeave={() => setPaused(false)} onPointerDown={(event) => { touchStart.current = event.clientX }} onPointerUp={(event) => { if (touchStart.current === null) return; const distance = event.clientX - touchStart.current; if (Math.abs(distance) > 45) { if (distance < 0) navigateNext(); else navigatePrevious() } touchStart.current = null }}>
    <div className="regular-heading"><h2>Best Sellers</h2><p className="regular-quote">Most loved pieces, chosen again and again.</p></div><div className="regular-stage">{virtualIndexes.map((virtualIndex) => { const relativePosition = virtualIndex - virtualCenter; const presentation = regularPositionMap[relativePosition]; const product = products[((virtualIndex % productCount) + productCount) % productCount]; const isActive = relativePosition === 0; const isVisible = Math.abs(relativePosition) <= 3; return <article className={`regular-card ${isActive ? 'is-active' : isVisible ? 'is-selectable' : 'is-buffer'}`} data-position={relativePosition} data-virtual-index={virtualIndex} key={`${product.id}-${virtualIndex}`} tabIndex={isVisible && !isActive ? 0 : -1} aria-hidden={!isVisible} aria-label={isVisible && !isActive ? `Show ${product.name}` : undefined} onClick={!isActive && isVisible ? () => relativePosition > 0 ? navigateNext() : navigatePrevious() : undefined} onKeyDown={!isActive && isVisible ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (relativePosition > 0) navigateNext(); else navigatePrevious() } } : undefined} onTransitionEnd={isActive ? (event) => { if (event.propertyName === 'transform') finishAnimation() } : undefined} style={{ '--offset-x': presentation.x, '--offset-y': presentation.y, '--scale': presentation.scale, '--opacity': presentation.opacity, zIndex: presentation.zIndex } as React.CSSProperties}><div className="regular-card-media"><img src={product.images[0].src} alt={product.images[0].alt} width={product.images[0].width} height={product.images[0].height} loading="lazy" /></div><div className="regular-card-view"><Link className={`regular-view-action ${isActive ? 'is-enabled' : ''}`} to={`/product/${product.slug}`} tabIndex={isActive ? 0 : -1} aria-hidden={!isActive} onClick={!isActive ? (event) => event.preventDefault() : undefined}>View</Link></div></article> })}</div>{productCount > 1 && <div className="regular-controls"><button className="icon-button" onClick={() => navigatePrevious()} aria-label="Previous best seller" disabled={isAnimating}><ArrowLeft size={19} /></button><button className="icon-button" onClick={() => navigateNext()} aria-label="Next best seller" disabled={isAnimating}><ArrowRight size={19} /></button></div>}
  </section>
}

export function ProductSection({ title, products, promo, description, emptyMessage }: { title: string; products: Product[]; promo?: ProductCategory['promo']; description?: string; emptyMessage?: string }) { return <section className={`product-section section ${promo ? 'with-promo' : ''}`}><div className="section-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div><Link to="/collection">View All <ArrowRight size={15} /></Link></div>{products.length || promo ? <div className="product-grid homepage-card-grid">{promo && <Link className="promo-card" to="/collection"><img src={promo.image.src} alt={promo.image.alt} width={promo.image.width} height={promo.image.height} loading="lazy" /><strong>{promo.copy}</strong></Link>}{products.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <p className="section-empty">{emptyMessage}</p>}</section> }

export function DesignGrid() { return <section className="designs section"><div className="title-center"><h2>Shop by Design</h2><p>Find the artwork that speaks to you.</p></div><div className="design-grid homepage-card-grid">{designs.map((design) => <Link to={`/design/${design.slug}`} key={design.id}><img src={design.image.src} alt={design.image.alt} width={design.image.width} height={design.image.height} loading="lazy" /><span><strong>{design.title}</strong>Explore <ArrowRight size={17} /></span></Link>)}</div></section> }

export function StorySection() { return <section className="story section"><h2>What We Do</h2><div><p>We create expressive T-shirts in Standard Fit and Oversized Fit, shaped by original design, meaningful collaborations, and the pieces people return to most.</p><LinkButton to="/about" dark>Explore</LinkButton></div></section> }
