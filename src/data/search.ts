import type { Product } from '../types'
import { getArchivedProducts } from './archive'
import { blogArticles, type BlogArticle } from './blog'
import { getPublicShopProducts } from './shop'

const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const includesQuery = (source: string, query: string) => {
  const terms = normalize(query).split(' ').filter(Boolean)
  const normalizedSource = normalize(source)
  return terms.length > 0 && terms.every((term) => normalizedSource.includes(term))
}

const productSearchText = (product: Product) => [
  product.name,
  product.description,
  product.category,
  product.fitType,
  product.fitType === 'standard' ? 'standard fit' : 'oversized fit',
  product.status,
  product.availabilityStatus,
  product.isSoldOut ? 'sold out archived retired' : 'available current',
  ...(product.colors ?? []).flatMap((colour) => [colour.label, colour.slug, colour.slug === 'charcoal' || colour.swatchValue.toLowerCase() === '#171717' ? 'black' : '']),
  ...(product.tags ?? []).flatMap((tag) => [tag.name, tag.slug, tag.group]),
].filter(Boolean).join(' ')

const blogSearchText = (article: BlogArticle) => [article.title, article.excerpt, article.introduction, article.category, article.author, article.pullQuote, ...article.sections.flatMap((section) => [section.heading, ...section.paragraphs])].join(' ')

export const getSearchableProducts = () => [...getPublicShopProducts(), ...getArchivedProducts()]
export const searchProducts = (query: string) => getSearchableProducts().filter((product) => includesQuery(productSearchText(product), query))
export const searchBlogArticles = (query: string) => blogArticles.filter((article) => includesQuery(blogSearchText(article), query))
