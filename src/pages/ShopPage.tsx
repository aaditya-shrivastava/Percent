import { ChevronDown, ChevronLeft, ChevronRight, Grid2X2, Heart, List, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { formatInr, type ShopFacets, type ShopFilters, type ShopQuery, type ShopSort, type ShopTab, type ShopView } from '../data/shop'
import { useShopProducts } from '../hooks/useShopProducts'
import type { Product } from '../types'

const sortOptions: Array<{ value: ShopSort; label: string }> = [{ value: 'featured', label: 'Featured' }, { value: 'newest', label: 'Newest' }, { value: 'price-asc', label: 'Price: Low to High' }, { value: 'price-desc', label: 'Price: High to Low' }, { value: 'best-selling', label: 'Best Selling' }, { value: 'trending', label: 'Trending' }]
const tabs: Array<{ value: ShopTab; label: string }> = [{ value: 'all', label: 'All' }, { value: 'standard', label: 'Standard' }, { value: 'oversized', label: 'Oversized' }, { value: 'limited', label: 'Limited' }]
const fallbackProductImage = 'https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?auto=format&fit=crop&w=900&q=84'
const cleanList = (value: string | null, allowed?: readonly string[]) => (value ?? '').split(',').map((item) => item.trim().toLowerCase()).filter((item, index, items) => /^[a-z0-9-]+$/.test(item) && (!allowed || allowed.includes(item)) && items.indexOf(item) === index).slice(0, 20)
const cleanNumber = (value: string | null) => { const number = Number(value); return value && Number.isFinite(number) && number >= 0 ? Math.round(number) : undefined }

function queryFromParams(params: URLSearchParams): ShopQuery {
  const sort = params.get('sort') as ShopSort
  const tab = params.get('tab') as ShopTab
  return {
    page: Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1),
    pageSize: 12,
    sort: sortOptions.some((option) => option.value === sort) ? sort : 'featured',
    tab: tabs.some((item) => item.value === tab) ? tab : 'all',
    fits: cleanList(params.get('fit'), ['standard', 'oversized']) as ShopQuery['fits'],
    availability: cleanList(params.get('availability'), ['available', 'sold-out']) as ShopQuery['availability'],
    colours: cleanList(params.get('colors')),
    tags: cleanList(params.get('tags')),
    minPrice: cleanNumber(params.get('minPrice')),
    maxPrice: cleanNumber(params.get('maxPrice')),
  }
}

const emptyFilters: ShopFilters = { fits: [], availability: [], colours: [], tags: [] }
const filtersFromQuery = (query: ShopQuery): ShopFilters => ({ fits: query.fits, availability: query.availability, colours: query.colours, tags: query.tags, minPrice: query.minPrice, maxPrice: query.maxPrice })
const selectedFilterCount = (filters: ShopFilters) => filters.fits.length + filters.availability.length + filters.colours.length + filters.tags.length + Number(filters.minPrice !== undefined) + Number(filters.maxPrice !== undefined)

function SortSelect({ value, onChange, mobile = false }: { value: ShopSort; onChange: (value: ShopSort) => void; mobile?: boolean }) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, sortOptions.findIndex((option) => option.value === value)))
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const options = useRef<Array<HTMLButtonElement | null>>([])
  const listboxId = useId()
  const selected = sortOptions.find((option) => option.value === value) ?? sortOptions[0]
  const focusOption = (index: number) => { const next = (index + sortOptions.length) % sortOptions.length; setActiveIndex(next); requestAnimationFrame(() => options.current[next]?.focus()) }
  const openMenu = (index = sortOptions.findIndex((option) => option.value === value)) => { setOpen(true); requestAnimationFrame(() => focusOption(Math.max(0, index))) }
  const selectOption = (option: typeof sortOptions[number]) => { onChange(option.value); setOpen(false); requestAnimationFrame(() => trigger.current?.focus()) }

  useEffect(() => {
    if (!open) return undefined
    const closeOutside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

  return <div ref={root} className={`sort-select ${mobile ? 'sort-select--mobile' : ''} ${open ? 'is-open' : ''}`}>
    <button ref={trigger} type="button" className="sort-select-trigger" aria-label="Sort products" aria-haspopup="listbox" aria-expanded={open} aria-controls={listboxId} onClick={() => open ? setOpen(false) : openMenu()} onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); openMenu(activeIndex) } if (event.key === 'ArrowUp') { event.preventDefault(); openMenu(activeIndex - 1) } if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (open) setOpen(false); else openMenu() } if (event.key === 'Escape') setOpen(false) }}><span className="sort-select-value">{selected.label}</span><ChevronDown className="sort-select-chevron" aria-hidden="true" /></button>
    <div id={listboxId} className={`sort-select-menu ${open ? 'is-open' : ''}`} role="listbox" aria-label="Sort products" aria-hidden={!open}>{sortOptions.map((option, index) => <button ref={(element) => { options.current[index] = element }} key={option.value} id={`${listboxId}-${option.value}`} type="button" role="option" aria-selected={option.value === value} className={`sort-select-option ${index === activeIndex ? 'is-active' : ''}`} tabIndex={open ? 0 : -1} onClick={() => selectOption(option)} onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); focusOption(index + 1) } if (event.key === 'ArrowUp') { event.preventDefault(); focusOption(index - 1) } if (event.key === 'Home') { event.preventDefault(); focusOption(0) } if (event.key === 'End') { event.preventDefault(); focusOption(sortOptions.length - 1) } if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectOption(option) } if (event.key === 'Escape') { event.preventDefault(); setOpen(false); requestAnimationFrame(() => trigger.current?.focus()) } if (event.key === 'Tab') setOpen(false) }}>{option.label}</button>)}</div>
  </div>
}

function FilterPanel({ facets, selected, onApply, onClear, mobile = false }: { facets: ShopFacets; selected: ShopFilters; onApply: (filters: ShopFilters) => void; onClear: () => void; mobile?: boolean }) {
  const [draft, setDraft] = useState(selected)
  const toggle = <T extends string>(key: 'fits' | 'availability' | 'colours' | 'tags', value: T) => setDraft((current) => ({ ...current, [key]: current[key].includes(value as never) ? current[key].filter((item) => item !== value) : [...current[key], value] }))
  const checkGroup = (title: string, options: Array<{ value: string; label: string; count: number }>, key: 'fits' | 'availability' | 'tags') => options.length ? <fieldset className="shop-filter-group" key={title}><legend>{title}</legend>{options.map((option) => <label className="shop-check" key={option.value}><input type="checkbox" checked={draft[key].includes(option.value as never)} onChange={() => toggle(key, option.value)} /><span>{option.label}</span><small>{option.count}</small></label>)}</fieldset> : null

  return <form className={`shop-filters ${mobile ? 'is-mobile' : ''}`} onSubmit={(event) => { event.preventDefault(); onApply(draft) }}>
    {checkGroup('Fit', facets.fits, 'fits')}
    {checkGroup('Availability', facets.availability, 'availability')}
    {facets.colours.length > 0 && <fieldset className="shop-filter-group"><legend>Colour</legend><div className="shop-swatches">{facets.colours.filter((colour) => colour.count > 0).map((colour) => <label key={colour.id} className={`shop-swatch ${draft.colours.includes(colour.value) ? 'is-selected' : ''}`} title={`${colour.label} (${colour.count})`}><input className="sr-only" type="checkbox" checked={draft.colours.includes(colour.value)} onChange={() => toggle('colours', colour.value)} aria-label={`Filter by ${colour.label.toLowerCase()}`} /><i style={{ background: /^#[0-9a-f]{6}$/i.test(colour.swatchValue) ? colour.swatchValue : '#d8d0c8' }} /><span>{colour.label}</span></label>)}</div></fieldset>}
    <fieldset className="shop-filter-group"><legend>Price</legend><div className="shop-price-inputs"><label><span>Min</span><input type="number" inputMode="numeric" min={facets.price.min} max={facets.price.max} placeholder={String(facets.price.min)} value={draft.minPrice ?? ''} onChange={(event) => setDraft((current) => ({ ...current, minPrice: cleanNumber(event.target.value) }))} /></label><span>—</span><label><span>Max</span><input type="number" inputMode="numeric" min={facets.price.min} max={facets.price.max} placeholder={String(facets.price.max)} value={draft.maxPrice ?? ''} onChange={(event) => setDraft((current) => ({ ...current, maxPrice: cleanNumber(event.target.value) }))} /></label></div><small>{formatInr(facets.price.min)} – {formatInr(facets.price.max)}</small></fieldset>
    {facets.tagGroups.map((group) => checkGroup(group.group, group.options.filter((option) => option.count > 0), 'tags'))}
    <div className="shop-filter-actions"><button type="button" onClick={() => { setDraft(emptyFilters); onClear() }}>Clear All</button><button type="submit">Apply Filters</button></div>
  </form>
}

function useWishlist() {
  const [items, setItems] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('percent-wishlist') ?? '[]') as string[] } catch { return [] } })
  const toggle = (id: string) => setItems((current) => { const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]; localStorage.setItem('percent-wishlist', JSON.stringify(next)); return next })
  return { items, toggle }
}

function InventoryProgress({ total, remaining, soldOut }: { total: number; remaining: number; soldOut: boolean }) {
  const safeTotal = Number.isFinite(total) ? Math.max(0, Math.trunc(total)) : 0
  const safeRemaining = soldOut ? 0 : Number.isFinite(remaining) ? Math.min(Math.max(0, Math.trunc(remaining)), safeTotal) : 0
  const remainingPercentage = safeTotal > 0 ? Math.min(100, Math.max(0, safeRemaining / safeTotal * 100)) : 0
  return <div className="shop-edition-progress"><span>{safeRemaining} of {safeTotal} remaining</span><i><b style={{ width: `${remainingPercentage}%` }} /></i></div>
}

function ShopProductCard({ product, view, wished, onWishlist }: { product: Product; view: ShopView; wished: boolean; onWishlist: () => void }) {
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

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).filter((item) => item === 1 || item === totalPages || Math.abs(item - page) <= 1)
  return <nav className="shop-pagination" aria-label="Shop pages"><button className="pagination-arrow" aria-label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={20} strokeWidth={1.8} /></button>{pages.map((item, index) => <span key={item}>{index > 0 && item - pages[index - 1] > 1 && <i>…</i>}<button className={item === page ? 'is-active' : ''} aria-current={item === page ? 'page' : undefined} onClick={() => onChange(item)}>{item}</button></span>)}<button className="pagination-arrow" aria-label="Next page" disabled={page >= totalPages} onClick={() => onChange(page + 1)}><ChevronRight size={20} strokeWidth={1.8} /></button></nav>
}

function ShopSkeletons() { return <div className="shop-product-grid" aria-label="Loading products">{Array.from({ length: 6 }, (_, index) => <div className="shop-skeleton" key={index}><i /><span /><span /></div>)}</div> }

export function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const searchKey = searchParams.toString()
  const query = useMemo(() => queryFromParams(new URLSearchParams(searchKey)), [searchKey])
  const view = (searchParams.get('view') === 'list' ? 'list' : 'grid') as ShopView
  const { data, loading, refetching, error, retry } = useShopProducts(query)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filterTrigger = useRef<HTMLButtonElement>(null)
  const productHeading = useRef<HTMLDivElement>(null)
  const wishlist = useWishlist()
  const currentFilters = filtersFromQuery(query)

  const updateParams = (updates: Record<string, string | number | undefined>, resetPage = true) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([key, value]) => value === undefined || value === '' ? next.delete(key) : next.set(key, String(value)))
    if (resetPage) next.delete('page')
    setSearchParams(next)
  }
  const applyFilters = (filters: ShopFilters) => {
    updateParams({ fit: filters.fits.join(',') || undefined, availability: filters.availability.join(',') || undefined, colors: filters.colours.join(',') || undefined, tags: filters.tags.join(',') || undefined, minPrice: filters.minPrice, maxPrice: filters.maxPrice })
    setFiltersOpen(false)
  }
  const clearFilters = () => { updateParams({ fit: undefined, availability: undefined, colors: undefined, tags: undefined, minPrice: undefined, maxPrice: undefined, tab: undefined }); setFiltersOpen(false) }
  const changePage = (page: number) => { updateParams({ page }, false); requestAnimationFrame(() => productHeading.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })) }

  useEffect(() => {
    if (!filtersOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setFiltersOpen(false); requestAnimationFrame(() => filterTrigger.current?.focus()) } }
    window.addEventListener('keydown', close)
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', close) }
  }, [filtersOpen])

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Shop Standard & Oversized T-Shirts | Percent'
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]') ?? document.head.appendChild(document.createElement('meta'))
    description.name = 'description'
    description.content = 'Explore Percent standard and oversized T-shirts, limited collaborations, best sellers and trending designs.'
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]') ?? document.head.appendChild(document.createElement('link'))
    canonical.rel = 'canonical'
    canonical.href = `${window.location.origin}/shop`
    return () => { document.title = previousTitle }
  }, [])

  useEffect(() => {
    const existing = document.getElementById('shop-product-list-schema')
    existing?.remove()
    if (!data?.items.length) return
    const schema = document.createElement('script')
    schema.id = 'shop-product-list-schema'
    schema.type = 'application/ld+json'
    schema.text = JSON.stringify({ '@context': 'https://schema.org', '@type': 'ItemList', numberOfItems: data.total, itemListElement: data.items.map((product, index) => ({ '@type': 'ListItem', position: (data.page - 1) * data.pageSize + index + 1, url: `${window.location.origin}/products/${product.slug}`, name: product.name })) })
    document.head.appendChild(schema)
    return () => schema.remove()
  }, [data])

  const facets = data?.facets
  return <main className="shop-page">
    <header className="shop-hero">
      <div><nav aria-label="Breadcrumb"><Link to="/">Home</Link><span>/</span><span>Shop</span></nav><h1>Shop <em>Exclusive</em></h1><p>Standard and oversized fits. Made to stand apart.</p></div>
      <div className="shop-available" aria-live="polite"><strong>{data?.availableDesignsCount ?? '—'}</strong><span>Available Designs</span></div>
    </header>

    <section className="shop-catalog" aria-labelledby="shop-results-title">
      <div className="shop-topbar">
        <nav className="shop-tabs shop-category-tabs" aria-label="Shop categories">{tabs.map((tab) => <button key={tab.value} className={`shop-category-tab ${query.tab === tab.value ? 'is-active' : ''}`} aria-current={query.tab === tab.value ? 'page' : undefined} onClick={() => updateParams({ tab: tab.value === 'all' ? undefined : tab.value })}>{tab.label}</button>)}</nav>
        <div className="shop-sort"><span>Sort by</span><SortSelect value={query.sort} onChange={(sort) => updateParams({ sort: sort === 'featured' ? undefined : sort })} /></div>
      </div>

      <div className="shop-mobile-toolbar"><button ref={filterTrigger} onClick={() => setFiltersOpen(true)}><SlidersHorizontal />Filter{selectedFilterCount(currentFilters) > 0 && <span>{selectedFilterCount(currentFilters)}</span>}</button><SortSelect mobile value={query.sort} onChange={(sort) => updateParams({ sort: sort === 'featured' ? undefined : sort })} /></div>

      <div className="shop-layout">
        <aside className="shop-sidebar" aria-label="Product filters">{facets && <FilterPanel key={`desktop-${JSON.stringify(currentFilters)}`} facets={facets} selected={currentFilters} onApply={applyFilters} onClear={clearFilters} />}</aside>
        <div className="shop-results">
          <div className="shop-results-head" ref={productHeading}><div><p id="shop-results-title">{data?.total ?? 0} Products</p>{refetching && <span>Updating…</span>}</div><div className="shop-view-controls" aria-label="Product view"><button className={view === 'grid' ? 'is-active' : ''} aria-label="Grid view" aria-pressed={view === 'grid'} onClick={() => updateParams({ view: undefined }, false)}><Grid2X2 /></button><button className={view === 'list' ? 'is-active' : ''} aria-label="List view" aria-pressed={view === 'list'} onClick={() => updateParams({ view: 'list' }, false)}><List /></button></div></div>
          {loading && !data && <ShopSkeletons />}
          {error && !data && <div className="shop-state"><h2>We couldn’t load the shop.</h2><p>Please try again in a moment.</p><button onClick={retry}>Retry</button></div>}
          {data && data.items.length > 0 && <div className={`shop-product-grid ${view === 'list' ? 'is-list' : ''}`}>{data.items.map((product) => <ShopProductCard key={product.id} product={product} view={view} wished={wishlist.items.includes(product.id)} onWishlist={() => wishlist.toggle(product.id)} />)}</div>}
          {data && data.items.length === 0 && <div className="shop-state"><h2>No designs found.</h2><p>Try adjusting or clearing some filters.</p><div><button onClick={clearFilters}>Clear Filters</button><Link to="/shop">Return to All Products</Link></div></div>}
          {data && <Pagination page={data.page} totalPages={data.totalPages} onChange={changePage} />}
        </div>
      </div>
    </section>

    <button className={`shop-drawer-backdrop ${filtersOpen ? 'is-open' : ''}`} aria-label="Close filters" tabIndex={filtersOpen ? 0 : -1} onClick={() => setFiltersOpen(false)} />
    <aside className={`shop-filter-drawer ${filtersOpen ? 'is-open' : ''}`} role="dialog" aria-modal="true" aria-label="Product filters" aria-hidden={!filtersOpen}><header><h2>Filters</h2><button aria-label="Close filters" onClick={() => { setFiltersOpen(false); requestAnimationFrame(() => filterTrigger.current?.focus()) }}><X /></button></header>{facets && <FilterPanel key={`mobile-${JSON.stringify(currentFilters)}`} mobile facets={facets} selected={currentFilters} onApply={applyFilters} onClear={clearFilters} />}</aside>
  </main>
}
