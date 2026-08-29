import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { blogBanner, designs, heroBanners, limitedProducts, regularEditions } from '../../data/homepage'
import type { Product, ProductCategory } from '../../types'
import { LinkButton } from '../common/LinkButton'
import { ProductCard } from '../product/ProductCard'

export function Hero() {
  const banners = heroBanners.filter((banner) => banner.active).sort((first, second) => first.displayOrder - second.displayOrder)
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [timerVersion, setTimerVersion] = useState(0)
  const touchStart = useRef<number | null>(null)
  const bannerCount = banners.length
  const move = useCallback((amount: number, resetTimer = true) => { setActive((index) => (index + amount + bannerCount) % bannerCount); if (resetTimer) setTimerVersion((version) => version + 1) }, [bannerCount])

  useEffect(() => {
    if (paused || bannerCount < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const interval = window.setInterval(() => move(1, false), 3500)
    return () => window.clearInterval(interval)
  }, [bannerCount, move, paused, timerVersion])

  if (!banners.length) return null
  const displayNumber = String(active + 1).padStart(2, '0')
  const totalNumber = String(banners.length).padStart(2, '0')
  return <section className="hero" aria-roledescription="carousel" aria-label="Percent campaign banners" tabIndex={0} onKeyDown={(event) => { if (event.key === 'ArrowLeft') move(-1); if (event.key === 'ArrowRight') move(1) }} onPointerMove={(event) => { if (event.pointerType === 'mouse') setPaused(true) }} onPointerLeave={() => setPaused(false)} onPointerDown={(event) => { touchStart.current = event.clientX }} onPointerUp={(event) => { if (touchStart.current === null) return; const distance = event.clientX - touchStart.current; if (Math.abs(distance) > 45) move(distance < 0 ? 1 : -1); touchStart.current = null }}>
    <div className="hero-media">{banners.map((banner, index) => <img key={banner.id} className={index === active ? 'is-active' : ''} src={banner.image} alt={index === active ? banner.alt : ''} width={banner.width} height={banner.height} fetchPriority={index === 0 ? 'high' : 'auto'} loading={index === 0 ? 'eager' : 'lazy'} />)}</div>
    <div className="hero-copy"><p className="eyebrow">NEW DROP</p><h1>REDEFINED{`\n`}BASICS.</h1><p>Every Drop is Limited.{`\n`}Every Piece Tells A Story.</p><LinkButton to="/collection/limited" dark>SHOP THE DROP</LinkButton></div>
    <div className="hero-footer"><span>{displayNumber}<b />{totalNumber}</span><div className="hero-controls"><button className="icon-button" onClick={() => move(-1)} aria-label="Previous banner"><ArrowLeft size={19} /></button><button className="icon-button" onClick={() => move(1)} aria-label="Next banner"><ArrowRight size={19} /></button></div></div>
  </section>
}

export function LimitedEditions() { return <section className="limited section"><div className="limited-heading"><div><h2>Limited Editions</h2><p>Only 100 pieces. Never restocked.</p></div><Link to="/collection/limited">View All <ArrowRight size={15} /></Link></div><div className="limited-grid">{limitedProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div></section> }

export function RegularCarousel() { const rail = useRef<HTMLDivElement>(null); const pointerStart = useRef<{ x: number; scroll: number } | null>(null); const move = (direction: number) => rail.current?.scrollBy({ left: direction * 320, behavior: 'smooth' }); return <section className="regular section"><div className="section-heading"><h2>Regular Editions</h2><div><button onClick={() => move(-1)} aria-label="Previous regular editions"><ArrowLeft /></button><button onClick={() => move(1)} aria-label="Next regular editions"><ArrowRight /></button></div></div><div className="edition-rail" ref={rail} onPointerDown={(event) => { if (rail.current) pointerStart.current = { x: event.clientX, scroll: rail.current.scrollLeft } }} onPointerMove={(event) => { if (rail.current && pointerStart.current) rail.current.scrollLeft = pointerStart.current.scroll - (event.clientX - pointerStart.current.x) }} onPointerUp={() => { pointerStart.current = null }} onPointerLeave={() => { pointerStart.current = null }}>{regularEditions.map((product) => <Link to={`/product/${product.slug}`} key={product.id}><img src={product.images[0].src} alt={product.images[0].alt} width="300" height="360" loading="lazy" /><span>View</span></Link>)}</div></section> }

export function ProductSection({ title, products, promo }: { title: string; products: Product[]; promo?: ProductCategory['promo'] }) { return <section className={`product-section section ${promo ? 'with-promo' : ''}`}><div className="section-heading"><h2>{title}</h2><Link to="/collection">View All <ArrowRight size={15} /></Link></div><div className="product-grid">{promo && <Link className="promo-card" to="/collection"><img src={promo.image.src} alt={promo.image.alt} width={promo.image.width} height={promo.image.height} loading="lazy" /><strong>{promo.copy}</strong></Link>}{products.map((product) => <ProductCard key={product.id} product={product} />)}</div></section> }

export function DesignGrid() { return <section className="designs section"><div className="title-center"><h2>Shop by Design</h2><p>Find the artwork that speaks to you.</p></div><div className="design-grid">{designs.map((design) => <Link to={`/design/${design.slug}`} key={design.id}><img src={design.image.src} alt={design.image.alt} width={design.image.width} height={design.image.height} loading="lazy" /><span><strong>{design.title}</strong>Explore <ArrowRight size={17} /></span></Link>)}</div></section> }

export function StoryAndBlog() { return <><section className="story section"><h2>What We Do</h2><div><p>We create limited pieces designed to feel personal, rare, and worth owning. Every drop is made in only 100 pieces, giving each design a life that ends once it sells out.</p><LinkButton to="/about" dark>Explore</LinkButton></div></section><section className="blog section"><h2>{blogBanner.title}</h2><Link to={blogBanner.href}><img src={blogBanner.image.src} alt={blogBanner.image.alt} width={blogBanner.image.width} height={blogBanner.image.height} loading="lazy" /><span>Blogs</span><em>Explore <ArrowRight size={16} /></em></Link></section></> }
