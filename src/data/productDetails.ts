import { getPublicShopProducts } from './shop'
import { getArchivedProductBySlug } from './archive'
import { productColours } from './homepage'
import type { Product, ProductDetails, ProductImage, ProductReview, ProductVariant } from '../types'

export interface ProductDetailsResponse { product: ProductDetails; related: Product[] }

export class ProductNotFoundError extends Error {
  constructor() { super('Design not found'); this.name = 'ProductNotFoundError' }
}

const gallerySourceIds = [
  'photo-1523381210434-271e8be1f52b',
  'photo-1503342217505-b0a15ec3261c',
  'photo-1521572163474-6864f9cf17ab',
  'photo-1622445275463-afa2ab738c34',
  'photo-1618354691373-d851c5c3a990',
  'photo-1586790170083-2f9ceadc732d',
]

const galleryImage = (sourceId: string, productName: string, role: ProductImage['role'], sortOrder: number): ProductImage => ({
  id: `${productName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${role}-${sortOrder}`,
  src: `https://images.unsplash.com/${sourceId}?auto=format&fit=crop&w=1200&q=88`,
  alt: `${productName} ${role} view`,
  width: 1200,
  height: 1500,
  role,
  sortOrder,
})

const buildGallery = (product: Product): ProductImage[] => {
  const offset = product.displayOrder % gallerySourceIds.length
  const primary = { ...product.images[0], id: `${product.id}-primary`, role: 'primary' as const, sortOrder: 0 }
  const hover = product.hoverImage ? { ...product.hoverImage, id: `${product.id}-back`, role: 'back' as const, sortOrder: 1 } : undefined
  return [
    primary,
    hover,
    galleryImage(gallerySourceIds[offset], product.name, 'model', 2),
    galleryImage(gallerySourceIds[(offset + 2) % gallerySourceIds.length], product.name, 'detail', 3),
  ].filter((image): image is ProductImage => Boolean(image)).sort((first, second) => (first.sortOrder ?? 0) - (second.sortOrder ?? 0))
}

const buildVariants = (product: Product, gallery: ProductImage[]): ProductVariant[] => {
  const primaryColour = product.colors[0] ?? productColours[0]
  const secondaryColour = productColours[(productColours.findIndex((colour) => colour.id === primaryColour.id) + 1) % productColours.length]
  const colours = [primaryColour, secondaryColour].filter((colour, index, items) => items.findIndex((candidate) => candidate.id === colour.id) === index)
  return colours.flatMap((colour, colourIndex) => product.sizes.map((size, sizeIndex) => {
    const available = !product.isSoldOut && (sizeIndex + colourIndex + product.displayOrder) % 4 !== 0
    return {
      id: `${product.id}-${colour.slug}-${size.toLowerCase()}`,
      colour,
      size,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      isAvailable: available,
      stock: available ? Math.max(1, Math.min(12, product.remainingPieces - sizeIndex)) : 0,
      images: colourIndex === 0 ? gallery : [gallery[1], gallery[0], ...gallery.slice(2)].filter(Boolean),
    }
  }))
}

const buildReviews = (product: Product): ProductReview[] => {
  if (product.displayOrder % 4 === 0) return []
  return [
    { id: `${product.id}-review-1`, rating: 5, customerName: 'Aarav K.', text: 'The fabric weight and finish feel considered. The fit held its shape after washing.', date: '2026-08-18', status: 'published' },
    { id: `${product.id}-review-2`, rating: product.displayOrder % 3 === 0 ? 4 : 5, customerName: 'Mira S.', text: 'Clean construction, comfortable through the day, and the print has excellent detail.', date: '2026-08-09', status: 'published' },
  ]
}

const buildDetails = (product: Product): ProductDetails => {
  const images = buildGallery(product)
  const reviews = buildReviews(product)
  const variants = buildVariants(product, images)
  const averageRating = reviews.length ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length : 0
  return {
    ...product,
    images,
    colors: variants.map((variant) => variant.colour).filter((colour, index, colours) => colours.findIndex((candidate) => candidate.id === colour.id) === index),
    variants,
    shortDescription: product.description,
    fullDescription: `${product.description} Designed with a balanced silhouette, durable construction, and the quiet details that define Percent essentials.`,
    material: '240 GSM combed cotton jersey',
    style: 'Unisex everyday T-shirt',
    careInstructions: 'Machine wash cold with similar colours. Wash inside out and line dry. Do not iron directly on artwork.',
    shippingAndReturns: 'Dispatches within two business days. Eligible unworn pieces may be returned within seven days of delivery.',
    collaborator: product.collaboratorName ? { name: product.collaboratorName, title: product.collaborationTitle, description: product.collaborationDescription, image: product.collaboratorImage } : undefined,
    reviews,
    reviewSummary: { averageRating, reviewCount: reviews.length },
  }
}

const relatedScore = (current: Product, candidate: Product) => Number(current.fitType === candidate.fitType) * 4 + Number(current.colors.some((colour) => candidate.colors.some((item) => item.id === colour.id))) * 2 + (current.tags ?? []).filter((tag) => candidate.tags?.some((item) => item.id === tag.id)).length

const localProductDetailsBackend = async (slug: string, signal?: AbortSignal): Promise<ProductDetailsResponse> => {
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, 240)
    signal?.addEventListener('abort', () => { window.clearTimeout(timer); reject(new DOMException('Request aborted', 'AbortError')) }, { once: true })
  })
  const products = getPublicShopProducts()
  const product = products.find((item) => item.slug === slug) ?? getArchivedProductBySlug(slug)
  if (!product) throw new ProductNotFoundError()
  const related = products.filter((item) => item.id !== product.id).sort((first, second) => relatedScore(product, second) - relatedScore(product, first) || first.displayOrder - second.displayOrder).slice(0, 4)
  return { product: buildDetails(product), related }
}

export async function fetchProductDetails(slug: string, signal?: AbortSignal): Promise<ProductDetailsResponse> {
  const endpoint = import.meta.env.VITE_PRODUCTS_API_URL as string | undefined
  if (!endpoint) return localProductDetailsBackend(slug, signal)
  const baseUrl = endpoint.replace(/\/$/, '')
  const [productResponse, relatedResponse] = await Promise.all([
    fetch(`${baseUrl}/products/${encodeURIComponent(slug)}`, { signal, headers: { Accept: 'application/json' } }),
    fetch(`${baseUrl}/products/${encodeURIComponent(slug)}/related?limit=4`, { signal, headers: { Accept: 'application/json' } }),
  ])
  if (productResponse.status === 404) throw new ProductNotFoundError()
  if (!productResponse.ok || !relatedResponse.ok) throw new Error('Product details could not be loaded')
  const product = await productResponse.json() as ProductDetails
  const related = await relatedResponse.json() as Product[]
  return { product, related }
}
