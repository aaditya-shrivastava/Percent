import { homepageProducts, productColours, productTags } from './homepage'
import type { FitType, Product, ProductColour, ProductStatus, ProductTag } from '../types'

export type ShopSort = 'featured' | 'newest' | 'price-asc' | 'price-desc' | 'best-selling' | 'trending'
export type ShopTab = 'all' | 'standard' | 'oversized' | 'limited'
export type ShopView = 'grid' | 'list'
export const shopTagSlugs = productTags.filter((tag) => tag.isActive && tag.isFilterable).map((tag) => tag.slug)
export const shopColourSlugs = productColours.map((colour) => colour.slug)

export interface ShopFilters {
  fits: FitType[]
  availability: Array<'available' | 'sold-out'>
  colours: string[]
  tags: string[]
  minPrice?: number
  maxPrice?: number
}

export interface ShopQuery extends ShopFilters {
  page: number
  pageSize: number
  sort: ShopSort
  tab: ShopTab
}

interface FacetOption<T extends string = string> { value: T; label: string; count: number }
export interface ShopTagGroupFacet { group: string; options: Array<FacetOption & { id: string }> }
export interface ShopFacets {
  fits: FacetOption<FitType>[]
  availability: FacetOption<'available' | 'sold-out'>[]
  colours: Array<FacetOption & { id: string; swatchValue: string }>
  tagGroups: ShopTagGroupFacet[]
  price: { min: number; max: number }
}

export interface ShopResponse {
  items: Product[]
  total: number
  availableDesignsCount: number
  page: number
  pageSize: number
  totalPages: number
  facets: ShopFacets
}

const image = (id: string, alt: string) => ({ src: `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=84`, alt, width: 900, height: 1100 })
const tag = (slug: string) => productTags.find((item) => item.slug === slug) as ProductTag

interface ShopSeed {
  name: string
  imageId: string
  hoverImageId: string
  price: number
  fitType: FitType
  colour: number
  tags: string[]
  limited?: boolean
  bestSeller?: boolean
  trending?: boolean
  isNew?: boolean
  status?: ProductStatus
  visible?: boolean
  shop?: boolean
  soldOut?: boolean
  remainingPieces?: number
}

const seeds: ShopSeed[] = [
  { name: 'Afterimage Tee', imageId: 'photo-1529139574466-a303027c1d8b', hoverImageId: 'photo-1515886657613-9f3515b0c78f', price: 1499, fitType: 'oversized', colour: 2, tags: ['graphic', 'trending'], trending: true, remainingPieces: 1 },
  { name: 'Studio Outline Tee', imageId: 'photo-1503342217505-b0a15ec3261c', hoverImageId: 'photo-1586790170083-2f9ceadc732d', price: 1299, fitType: 'standard', colour: 1, tags: ['minimal', 'new'], isNew: true },
  { name: 'Night Signal Tee', imageId: 'photo-1523381210434-271e8be1f52b', hoverImageId: 'photo-1618354691373-d851c5c3a990', price: 1599, fitType: 'oversized', colour: 2, tags: ['graphic', 'best-seller'], bestSeller: true },
  { name: 'Field Notes Tee', imageId: 'photo-1515372039744-b8f02a3ae446', hoverImageId: 'photo-1521572163474-6864f9cf17ab', price: 1199, fitType: 'standard', colour: 0, tags: ['minimal'] },
  { name: 'Burgundy Study Tee', imageId: 'photo-1551488831-00ddcb6c6bd3', hoverImageId: 'photo-1496747611176-843222e1e57c', price: 1399, fitType: 'standard', colour: 3, tags: ['minimal', 'trending'], trending: true },
  { name: 'Parallel Lines Tee', imageId: 'photo-1506629082955-511b1aa562c8', hoverImageId: 'photo-1506629905607-d405b7a30db5', price: 1699, fitType: 'oversized', colour: 4, tags: ['graphic', 'limited-edition'], limited: true },
  { name: 'Common Ground Tee', imageId: 'photo-1521572163474-6864f9cf17ab', hoverImageId: 'photo-1620799140408-edc6dcb6d633', price: 1299, fitType: 'standard', colour: 1, tags: ['best-seller'], bestSeller: true },
  { name: 'Archive Form Tee', imageId: 'photo-1618354691373-d851c5c3a990', hoverImageId: 'photo-1583743814966-8936f37f4678', price: 1499, fitType: 'oversized', colour: 2, tags: ['minimal', 'new'], isNew: true },
  { name: 'Quiet Geometry Tee', imageId: 'photo-1562157873-818bc0726f68', hoverImageId: 'photo-1622445275463-afa2ab738c34', price: 1199, fitType: 'standard', colour: 0, tags: ['minimal'] },
  { name: 'Edition No. 09 Tee', imageId: 'photo-1576566588028-4147f3842f27', hoverImageId: 'photo-1539109136881-3be0616acf4b', price: 1799, fitType: 'oversized', colour: 3, tags: ['limited-edition', 'artist-collaboration'], limited: true },
  { name: 'Daily Ritual Tee', imageId: 'photo-1622445275463-afa2ab738c34', hoverImageId: 'photo-1586790170083-2f9ceadc732d', price: 1099, fitType: 'standard', colour: 4, tags: ['best-seller'], bestSeller: true },
  { name: 'Soft Focus Tee', imageId: 'photo-1627225924765-552d49cf47ad', hoverImageId: 'photo-1490481651871-ab68de25d43d', price: 1399, fitType: 'oversized', colour: 1, tags: ['graphic', 'trending'], trending: true },
  { name: 'Internal Draft Tee', imageId: 'photo-1521572163474-6864f9cf17ab', hoverImageId: 'photo-1586790170083-2f9ceadc732d', price: 999, fitType: 'standard', colour: 0, tags: ['minimal'], status: 'draft' },
  { name: 'Archived Campaign Tee', imageId: 'photo-1618354691373-d851c5c3a990', hoverImageId: 'photo-1583743814966-8936f37f4678', price: 1899, fitType: 'oversized', colour: 2, tags: ['graphic'], status: 'archived' },
  { name: 'Private Sample Tee', imageId: 'photo-1562157873-818bc0726f68', hoverImageId: 'photo-1622445275463-afa2ab738c34', price: 899, fitType: 'standard', colour: 4, tags: ['minimal'], visible: false, shop: false },
]

const sharedHoverImageIds: Record<string, string> = {
  'product-1': 'photo-1515886657613-9f3515b0c78f', 'product-2': 'photo-1620799140408-edc6dcb6d633', 'product-3': 'photo-1539109136881-3be0616acf4b', 'product-4': 'photo-1583743814966-8936f37f4678', 'product-5': 'photo-1496747611176-843222e1e57c', 'product-6': 'photo-1521572163474-6864f9cf17ab', 'product-7': 'photo-1618354691373-d851c5c3a990', 'product-8': 'photo-1622445275463-afa2ab738c34', 'product-9': 'photo-1586790170083-2f9ceadc732d', 'product-10': 'photo-1620799140408-edc6dcb6d633', 'product-11': 'photo-1506629905607-d405b7a30db5', 'product-12': 'photo-1490481651871-ab68de25d43d',
}

const statusTags = (product: Product) => [
  ...(product.tags ?? []),
  ...(product.isLimitedEdition ? [tag('limited-edition')] : []),
  ...(product.isBestSeller ? [tag('best-seller')] : []),
  ...(product.isTrending ? [tag('trending')] : []),
  ...(product.isNew ? [tag('new')] : []),
].filter((item, index, items) => item && items.findIndex((candidate) => candidate.id === item.id) === index)

const sharedProducts: Product[] = homepageProducts.map((product, index) => {
  const soldOut = index === 4
  const isNew = index < 3
  const updated: Product = {
    ...product,
    price: 1199 + (index % 5) * 100,
    compareAtPrice: index % 4 === 0 ? 1699 : undefined,
    currency: 'INR',
    colors: [productColours[index % productColours.length]],
    hoverImage: image(sharedHoverImageIds[product.id], `${product.name} alternate view`),
    isNew,
    isAvailable: !soldOut,
    isSoldOut: soldOut,
    soldPieces: soldOut ? product.totalPieces : product.soldPieces,
    remainingPieces: soldOut ? 0 : product.remainingPieces,
    availabilityStatus: soldOut ? 'sold-out' : product.availabilityStatus,
    editionRemaining: soldOut ? 0 : product.editionRemaining,
    launchDate: new Date(2026, 7, 28 - index).toISOString(),
  }
  return { ...updated, tags: statusTags(updated) }
})

const seededProducts: Product[] = seeds.map((seed, index) => {
  const totalPieces = 100
  const remainingPieces = seed.soldOut ? 0 : Math.min(totalPieces, Math.max(0, seed.remainingPieces ?? totalPieces - 28 - index * 3))
  const soldPieces = totalPieces - remainingPieces
  const product: Product = {
    id: `shop-product-${index + 13}`,
    slug: seed.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name: seed.name,
    description: 'Premium heavyweight cotton with an original Percent graphic.',
    price: seed.price,
    compareAtPrice: index % 5 === 0 ? seed.price + 300 : undefined,
    currency: 'INR',
    images: [image(seed.imageId, seed.name)],
    hoverImage: image(seed.hoverImageId, `${seed.name} alternate view`),
    category: 't-shirts',
    fitType: seed.fitType,
    colors: [productColours[seed.colour]],
    sizes: ['S', 'M', 'L', 'XL'],
    status: seed.status ?? 'published',
    isVisible: seed.visible ?? true,
    isAvailable: !seed.soldOut,
    isSoldOut: seed.soldOut ?? false,
    isShopAvailable: seed.shop ?? true,
    isDeleted: false,
    totalPieces,
    soldPieces,
    remainingPieces,
    isLimitedEdition: seed.limited ?? false,
    isBestSeller: seed.bestSeller ?? false,
    isTrending: seed.trending ?? false,
    isNew: seed.isNew ?? false,
    editionTotal: seed.limited ? totalPieces : undefined,
    editionSold: seed.limited ? soldPieces : undefined,
    editionRemaining: seed.limited ? remainingPieces : undefined,
    editionBadge: seed.limited ? 'Limited' : undefined,
    tags: seed.tags.map(tag),
    launchDate: new Date(2026, 7, 16 - index).toISOString(),
    salesCount: 180 + (index * 37) % 320,
    retirementState: seed.soldOut ? 'sold-out' : 'active',
    availabilityStatus: seed.soldOut ? 'sold-out' : 'available',
    featured: index < 8,
    active: seed.status !== 'archived',
    displayOrder: index + 13,
  }
  return { ...product, tags: statusTags(product) }
})

const catalog = [...sharedProducts, ...seededProducts]
const hasValidInventory = (product: Product) => Number.isInteger(product.totalPieces) && product.totalPieces > 0 && Number.isInteger(product.soldPieces) && product.soldPieces >= 0 && Number.isInteger(product.remainingPieces) && product.remainingPieces >= 0 && product.soldPieces <= product.totalPieces && product.remainingPieces <= product.totalPieces && product.soldPieces + product.remainingPieces === product.totalPieces
const hasRequiredCardImages = (product: Product) => Boolean(product.images[0]?.src && product.hoverImage?.src)
const isPublicShopProduct = (product: Product) => product.status === 'published' && product.isVisible && product.isShopAvailable && !product.isDeleted && product.active && hasValidInventory(product) && hasRequiredCardImages(product)

const sortProducts = (products: Product[], sort: ShopSort) => [...products].sort((first, second) => {
  if (sort === 'price-asc') return first.price - second.price
  if (sort === 'price-desc') return second.price - first.price
  if (sort === 'newest') return Date.parse(second.launchDate ?? '') - Date.parse(first.launchDate ?? '')
  if (sort === 'best-selling') return (second.salesCount ?? 0) - (first.salesCount ?? 0)
  if (sort === 'trending') return Number(second.isTrending) - Number(first.isTrending) || (second.salesCount ?? 0) - (first.salesCount ?? 0)
  return Number(second.featured) - Number(first.featured) || first.displayOrder - second.displayOrder
})

const count = (products: Product[], predicate: (product: Product) => boolean) => products.filter(predicate).length
const buildFacets = (products: Product[]): ShopFacets => {
  const activeTags = productTags.filter((item) => item.isActive && item.isFilterable).sort((first, second) => first.displayOrder - second.displayOrder)
  const groups = new Map<string, ProductTag[]>()
  activeTags.forEach((item) => groups.set(item.group, [...(groups.get(item.group) ?? []), item]))
  const prices = products.map((product) => product.price)
  return {
    fits: [{ value: 'standard', label: 'Standard Fit', count: count(products, (product) => product.fitType === 'standard') }, { value: 'oversized', label: 'Oversized Fit', count: count(products, (product) => product.fitType === 'oversized') }],
    availability: [{ value: 'available', label: 'Available', count: count(products, (product) => product.isAvailable && !product.isSoldOut) }, { value: 'sold-out', label: 'Sold Out', count: count(products, (product) => product.isSoldOut) }],
    colours: productColours.map((colour) => ({ id: colour.id, value: colour.slug, label: colour.label, swatchValue: colour.swatchValue, count: count(products, (product) => product.colors.some((item) => item.id === colour.id)) })),
    tagGroups: Array.from(groups, ([group, options]) => ({ group, options: options.map((item) => ({ id: item.id, value: item.slug, label: item.name, count: count(products, (product) => product.tags?.some((tagItem) => tagItem.id === item.id) ?? false) })) })).filter((group) => group.options.some((option) => option.count > 0)),
    price: { min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0 },
  }
}

const localShopBackend = async (query: ShopQuery, signal?: AbortSignal): Promise<ShopResponse> => {
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, 220)
    signal?.addEventListener('abort', () => { window.clearTimeout(timer); reject(new DOMException('Request aborted', 'AbortError')) }, { once: true })
  })
  const publicProducts = catalog.filter(isPublicShopProduct)
  let filtered = publicProducts
  if (query.tab === 'standard') filtered = filtered.filter((product) => product.fitType === 'standard')
  if (query.tab === 'oversized') filtered = filtered.filter((product) => product.fitType === 'oversized')
  if (query.tab === 'limited') filtered = filtered.filter((product) => product.isLimitedEdition)
  if (query.fits.length) filtered = filtered.filter((product) => query.fits.includes(product.fitType))
  if (query.availability.length) filtered = filtered.filter((product) => query.availability.includes(product.isSoldOut ? 'sold-out' : 'available'))
  if (query.colours.length) filtered = filtered.filter((product) => product.colors.some((colour) => query.colours.includes(colour.slug)))
  const supportedTags = query.tags.filter((slug) => shopTagSlugs.includes(slug))
  if (supportedTags.length) filtered = filtered.filter((product) => supportedTags.every((slug) => product.tags?.some((item) => item.slug === slug)))
  if (query.minPrice !== undefined) filtered = filtered.filter((product) => product.price >= query.minPrice!)
  if (query.maxPrice !== undefined) filtered = filtered.filter((product) => product.price <= query.maxPrice!)
  const sorted = sortProducts(filtered, query.sort)
  const totalPages = Math.max(1, Math.ceil(sorted.length / query.pageSize))
  const page = Math.min(query.page, totalPages)
  const start = (page - 1) * query.pageSize
  return { items: sorted.slice(start, start + query.pageSize), total: sorted.length, availableDesignsCount: publicProducts.length, page, pageSize: query.pageSize, totalPages, facets: buildFacets(publicProducts) }
}

export const buildShopApiParams = (query: ShopQuery) => {
  const params = new URLSearchParams({ status: 'published', visible: 'true', page: String(query.page), pageSize: String(query.pageSize), sort: query.sort })
  if (query.tab !== 'all') params.set('tab', query.tab)
  if (query.fits.length) params.set('fit', query.fits.join(','))
  if (query.availability.length) params.set('availability', query.availability.join(','))
  if (query.colours.length) params.set('colors', query.colours.join(','))
  if (query.tags.length) params.set('tags', query.tags.join(','))
  if (query.minPrice !== undefined) params.set('minPrice', String(query.minPrice))
  if (query.maxPrice !== undefined) params.set('maxPrice', String(query.maxPrice))
  return params
}

export async function fetchShopProducts(query: ShopQuery, signal?: AbortSignal): Promise<ShopResponse> {
  const endpoint = import.meta.env.VITE_PRODUCTS_API_URL as string | undefined
  if (!endpoint) return localShopBackend(query, signal)
  const response = await fetch(`${endpoint.replace(/\/$/, '')}/products?${buildShopApiParams(query)}`, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('Shop products could not be loaded')
  return response.json() as Promise<ShopResponse>
}

export function subscribeToShopChanges(onChange: () => void) {
  const handler = () => onChange()
  window.addEventListener('percent:products-changed', handler)
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('percent-products') : undefined
  channel?.addEventListener('message', handler)
  const eventsEndpoint = import.meta.env.VITE_PRODUCTS_EVENTS_URL as string | undefined
  const eventSource = eventsEndpoint ? new EventSource(eventsEndpoint) : undefined
  eventSource?.addEventListener('product-changed', handler)
  return () => { window.removeEventListener('percent:products-changed', handler); channel?.close(); eventSource?.close() }
}

export const formatInr = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)
export const safeSwatch = (colour: ProductColour) => /^#[0-9a-f]{6}$/i.test(colour.swatchValue) ? colour.swatchValue : '#d8d0c8'
