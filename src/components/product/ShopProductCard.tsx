import { Heart } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatInr } from '../../data/shop'
import type { Product } from '../../types'

const fallbackProductImage = 'https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?auto=format&fit=crop&w=900&q=84'

function InventoryProgress({ total, remaining, soldOut }: { total: number; remaining: number; soldOut: boolean }) {
  const safeTotal = Number.isFinite(total) ? Math.max(0, Math.trunc(total)) : 0
  const safeRemaining = soldOut ? 0 : Number.isFinite(remaining) ? Math.min(Math.max(0, Math.trunc(remaining)), safeTotal) : 0
  const remainingPercentage = safeTotal > 0 ? Math.min(100, Math.max(0, safeRemaining / safeTotal * 100)) : 0
  return <div className="shop-edition-progress"><span>{safeRemaining} of {safeTotal} remaining</span><i><b style={{ width: `${remainingPercentage}%` }} /></i></div>
}

export function ShopProductCard({ product, view = 'grid', wished, onWishlist }: { product: Product; view?: 'grid' | 'list'; wished: boolean; onWishlist: () => void }) {
  const [hoverReady, setHoverReady] = useState(false)
  const badges = [{ show: product.isSoldOut, label: 'Sold Out' }, { show: product.isLimitedEdition, label: 'Limited' }, { show: product.isNew, label: 'New' }, { show: product.isBestSeller, label: 'Best Seller' }, { show: product.isTrending, label: 'Trending' }].filter((badge) => badge.show).slice(0, 2)
  return <article className={`shop-product-card ${view === 'list' ? 'is-list' : ''} ${hoverReady ? 'is-hover-ready' : ''}`}>
    <div className="shop-product-media">
      <Link to={`/products/${product.slug}`} aria-label={`View ${product.name}`}><img className="shop-product-primary" src={product.images[0].src} alt={product.images[0].alt} width={product.images[0].width} height={product.images[0].height} loading="lazy" decoding="async" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = fallbackProductImage }} /><img className="shop-product-hover" src={product.hoverImage?.src ?? product.images[0].src} alt="" aria-hidden="true" width={product.hoverImage?.width ?? product.images[0].width} height={product.hoverImage?.height ?? product.images[0].height} loading="lazy" decoding="async" fetchPriority="low" onLoad={() => setHoverReady(Boolean(product.hoverImage?.src))} onError={(event) => { event.currentTarget.style.visibility = 'hidden'; setHoverReady(false) }} /></Link>
      {badges.length > 0 && <div className="shop-badges">{badges.map((badge) => <span key={badge.label}>{badge.label}</span>)}</div>}
      <button className={`shop-wishlist ${wished ? 'is-active' : ''}`} type="button" aria-label={wished ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`} aria-pressed={wished} onClick={(event) => { event.preventDefault(); event.stopPropagation(); onWishlist() }}><Heart size={18} fill={wished ? 'currentColor' : 'none'} /></button>
    </div>
    <div className="shop-product-info"><div className="shop-product-heading"><Link to={`/products/${product.slug}`}><h2>{product.name}</h2></Link><p>{product.fitType === 'standard' ? 'Standard Fit' : 'Oversized Fit'}</p></div><div className="shop-product-price"><strong>{formatInr(product.price)}</strong>{product.compareAtPrice && <del>{formatInr(product.compareAtPrice)}</del>}</div><InventoryProgress total={product.totalPieces} remaining={product.remainingPieces} soldOut={product.isSoldOut} /></div>
  </article>
}
