import { supabase, checkError } from './client'
import type { ProductDetails, ProductImage, ProductTag } from '../types'
import type { BlogArticle } from '../data/blog'
import { deliveredProductImage, signedProductImages } from './public-product-media'

export let hostedProducts: (ProductDetails & { archiveNumber: string; archivedAt: string })[] = []
export let hostedBlogs: BlogArticle[] = []

export async function loadCatalog() {
  const [products, variants, images, colours, tags, links, stock, reviews, posts, sections, blogImages, variantImages] = await Promise.all([
    supabase.from('products').select('*').eq('is_visible', true).in('status', ['active', 'archived']).order('display_order'),
    supabase.from('product_variants').select('*'), supabase.from('product_images').select('*').order('sort_order'),
    supabase.from('colours').select('*'), supabase.from('tags').select('*'), supabase.from('product_tags').select('*'),
    supabase.rpc('catalog_stock'), supabase.from('product_reviews').select('*').eq('status', 'approved'),
    supabase.from('blog_posts').select('*').eq('status', 'published').lte('published_at', new Date().toISOString()).order('published_at', { ascending: false }),
    supabase.from('blog_sections').select('*').order('sort_order'), supabase.from('blog_images').select('*'),
    supabase.from('variant_images').select('*').order('sort_order'),
  ])
  for (const result of [products, variants, images, colours, tags, links, stock, reviews, posts, sections, blogImages, variantImages]) checkError(result.error)
  const visibleIds = new Set((products.data ?? []).filter(p => p.is_visible && ['active', 'archived'].includes(p.status)).map(p => p.id))
  const signedImages = await signedProductImages(images.data ?? [], visibleIds)
  const image = (i: { url: string; alt: string; width: number; height: number }): ProductImage => ({ src: i.url, alt: i.alt, width: i.width, height: i.height })
  hostedProducts = (products.data ?? []).map(p => {
    const gallery = (images.data ?? []).filter(i => i.product_id === p.id).map(i => ({ ...image({ ...i, url: deliveredProductImage(i.url, p.id, signedImages) }), id: i.id, role: i.role, sortOrder: i.sort_order }))
    const productVariants = (variants.data ?? []).filter(v => v.product_id === p.id).map(v => {
      const c = colours.data!.find(c => c.id === v.colour_id)!
      const quantity = Number((stock.data as { variant_id: string; available_quantity: number }[]).find(s => s.variant_id === v.id)?.available_quantity ?? 0)
      return { id: v.id, colour: { id: c.id, label: c.label, slug: c.slug, swatchValue: c.swatch_value }, size: v.size, price: v.price_paise / 100, compareAtPrice: v.compare_at_price_paise ? v.compare_at_price_paise / 100 : undefined, stock: quantity, isAvailable: v.enabled && quantity > 0, images: (variantImages.data ?? []).filter(i => i.variant_id === v.id).map(i => gallery.find(g => g.id === i.image_id)!).filter(Boolean) }
    })
    const sold = (stock.data as { product_id: string; sold_quantity: number }[]).filter(s => s.product_id === p.id).reduce((n,s) => n + Number(s.sold_quantity), 0)
    const remaining = productVariants.reduce((n,v) => n + v.stock, 0)
    const soldOut = sold >= p.production_limit
    const productTags: ProductTag[] = (links.data ?? []).filter(l => l.product_id === p.id).flatMap(l => (tags.data ?? []).filter(t => t.id === l.tag_id).map(t => ({ id: t.id, name: t.name, slug: t.slug, group: t.group_name, isFilterable: t.is_filterable, isActive: t.active, displayOrder: t.display_order })))
    const productReviews = (reviews.data ?? []).filter(r => r.product_id === p.id).map(r => ({ id: r.id, rating: r.rating, title: r.title, customerName: r.customer_name, text: r.body, date: r.created_at, status: 'published' as const }))
    return { id: p.id, slug: p.slug, name: p.name, description: p.short_description, shortDescription: p.short_description, fullDescription: p.full_description, material: p.material ?? '', style: p.style, careInstructions: p.care_instructions, shippingAndReturns: p.shipping_and_returns, price: p.price_paise / 100, compareAtPrice: p.compare_at_price_paise ? p.compare_at_price_paise / 100 : undefined, currency: 'INR', images: gallery, hoverImage: gallery[1] ?? gallery[0], category: 't-shirts', fitType: p.fit_type, status: p.status === 'active' ? 'published' : 'archived', isVisible: true, isAvailable: p.status === 'active' && remaining > 0, isSoldOut: soldOut, isShopAvailable: p.is_shop_available, isDeleted: false, totalPieces: p.production_limit, soldPieces: sold, remainingPieces: remaining, editionTotal: p.production_limit, editionSold: sold, editionRemaining: remaining, isLimitedEdition: p.is_limited, isBestSeller: productTags.some(t => t.slug === 'best-seller'), isTrending: productTags.some(t => t.slug === 'trending'), isNew: productTags.some(t => t.slug === 'new'), colors: [...new Map(productVariants.map(v => [v.colour.id, v.colour])).values()], sizes: [...new Set(productVariants.map(v => v.size))], variants: productVariants, tags: productTags, featured: p.featured, active: p.status === 'active', displayOrder: p.display_order, launchDate: p.launch_at, retirementState: soldOut ? 'sold-out' : p.status === 'archived' ? 'retired' : 'active', availabilityStatus: soldOut ? 'sold-out' : remaining < 10 ? 'low-stock' : 'available', salesCount: sold, reviews: productReviews, reviewSummary: { reviewCount: productReviews.length, averageRating: productReviews.length ? productReviews.reduce((n,r) => n+r.rating,0)/productReviews.length : 0 }, archiveNumber: p.archive_number ?? '', archivedAt: p.archived_at ?? '', collaboratorName: p.collaborator_name, collaborator: p.collaborator_name ? { name: p.collaborator_name, title: p.collaboration_title, description: p.collaboration_description } : undefined }
  })
  await Promise.all(hostedProducts.flatMap(p => p.reviews.map(async review => {
    const {data,error}=await supabase.functions.invoke('percent-review-media',{body:{action:'read',review_id:review.id}})
    if(!error)review.images=data.images
  })))
  hostedBlogs = (posts.data ?? []).map(p => ({ slug: p.slug, title: p.title, excerpt: p.excerpt, introduction: p.introduction, category: p.category, date: p.published_at.slice(0,10), author: p.author, featured: p.featured, pullQuote: p.pull_quote ?? '', image: image(blogImages.data!.find(i => i.post_id === p.id && i.role === 'primary') ?? { url: '', alt: '', width: 1200, height: 900 }), secondaryImage: blogImages.data!.some(i => i.post_id === p.id && i.role === 'secondary') ? image(blogImages.data!.find(i => i.post_id === p.id && i.role === 'secondary')!) : undefined, sections: (sections.data ?? []).filter(s => s.post_id === p.id).map(s => ({ heading: s.heading, paragraphs: s.paragraphs })) }))
}
