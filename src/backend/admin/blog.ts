import { supabase } from '../client'
import { getAdminAccess } from './role'
import type { BlogArticle, BlogCategory } from '../../data/blog'

export const blogCategories = ['Brand', 'Design', 'Style', 'Process', 'Community'] as const
export type BlogImage = { role: 'primary' | 'secondary'; url: string; alt: string; width: number; height: number; preview?: string }
export type BlogSection = { heading: string; paragraphs: string[] }
export type BlogDocument = {
  id: string | null; updated_at: string | null; first_published_at: string | null
  slug: string; title: string; excerpt: string; introduction: string
  category: string; author: string; status: 'draft' | 'published'
  featured: boolean; published_at: string | null; pull_quote: string
  sections: BlogSection[]; images: BlogImage[]
}
export type BlogSummary = Pick<BlogDocument, 'id' | 'slug' | 'title' | 'category' | 'status' | 'featured' | 'published_at' | 'updated_at'> & { image?: BlogImage }

const roleCheck = async (userId: string) => {
  if ((await getAdminAccess(userId)).status !== 'allowed') throw new Error('Admin access required')
}
const imageRow = (row: { role: string; url: string; alt: string; width: number; height: number }): BlogImage => ({ role: row.role as BlogImage['role'], url: row.url, alt: row.alt, width: row.width, height: row.height })

export async function listBlogPosts(userId: string, signal?: AbortSignal): Promise<BlogSummary[]> {
  await roleCheck(userId)
  const { data, error } = await supabase.from('blog_posts').select('id,slug,title,category,status,featured,published_at,updated_at').order('updated_at', { ascending: false }).abortSignal(signal ?? new AbortController().signal)
  if (error) throw new Error(error.message)
  const posts = data ?? []
  const ids = posts.map(post => post.id)
  const images = ids.length ? await supabase.from('blog_images').select('post_id,role,url,alt,width,height').in('post_id', ids).eq('role', 'primary') : { data: [], error: null }
  if (images.error) throw new Error(images.error.message)
  return posts.map(post => ({ ...post, id: post.id, status: post.status as 'draft' | 'published', image: imageRow(images.data?.find(image => image.post_id === post.id) ?? { role: 'primary', url: '', alt: '', width: 1, height: 1 }) }))
}

export async function getBlogPost(userId: string, id: string): Promise<BlogDocument> {
  await roleCheck(userId)
  const [post, sections, images] = await Promise.all([
    supabase.from('blog_posts').select('*').eq('id', id).single(),
    supabase.from('blog_sections').select('heading,paragraphs,sort_order').eq('post_id', id).order('sort_order'),
    supabase.from('blog_images').select('role,url,alt,width,height').eq('post_id', id),
  ])
  if (post.error || !post.data || sections.error || images.error) throw new Error('Article unavailable')
  const row = post.data
  return { id: row.id, updated_at: row.updated_at, first_published_at: row.first_published_at, slug: row.slug, title: row.title, excerpt: row.excerpt, introduction: row.introduction, category: row.category, author: row.author, status: row.status as BlogDocument['status'], featured: row.featured, published_at: row.published_at, pull_quote: row.pull_quote ?? '', sections: (sections.data ?? []).map(section => ({ heading: section.heading, paragraphs: section.paragraphs as string[] })), images: (images.data ?? []).map(imageRow) }
}

export const emptyBlogDocument = (): BlogDocument => ({ id: null, updated_at: null, first_published_at: null, slug: '', title: '', excerpt: '', introduction: '', category: 'Brand', author: 'Percent Journal', status: 'draft', featured: false, published_at: null, pull_quote: '', sections: [{ heading: '', paragraphs: [''] }], images: [] })
export const blogSlug = (title: string) => title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120).replace(/-$/, '')
export const managedBlogPath = (url: string) => /^storage:\/\/percent-blog-images\/posts\/[0-9a-f-]{36}\/[0-9a-f]{64}\.(jpg|png|webp)$/.test(url)

export async function saveBlogPost(userId: string, document: BlogDocument): Promise<{ id: string; updated_at: string; status: string }> {
  await roleCheck(userId)
  const { id, updated_at, first_published_at, ...content } = document
  void first_published_at
  const { data, error } = await supabase.rpc('save_blog_post', { p_post_id: id, p_content: { ...content, images: content.images.map(({ preview, ...image }) => { void preview; return image }) }, p_expected_updated_at: updated_at })
  if (error) {
    const failure = new Error(error.code === 'PT409' ? 'This article changed elsewhere. Reload the latest version before saving again.' : error.message) as Error & { code?: string }
    failure.code = error.code
    throw failure
  }
  return data as { id: string; updated_at: string; status: string }
}

async function mediaFailure(error: { message: string; context?: unknown } | null, data: { error?: string } | null): Promise<Error> {
  if (data?.error) return new Error(data.error)
  const context = error?.context
  if (context instanceof Response) {
    try { const details = await context.clone().json(); if (typeof details.error === 'string') return new Error(details.error) } catch { /* use the transport error */ }
  }
  return new Error(error?.message ?? 'Blog media unavailable')
}
async function media(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('percent-blog-media', { body })
  if (error || data?.error) throw await mediaFailure(error, data)
  return data as { media?: Record<string, string>; path?: string; url?: string; preview_url?: string }
}
export async function signBlogImages(postId: string, images: BlogImage[], admin = false): Promise<BlogImage[]> {
  const paths = images.filter(image => managedBlogPath(image.url)).map(image => image.url.slice('storage://percent-blog-images/'.length))
  if (!paths.length) return images
  const { media: signed } = await media({ action: admin ? 'admin_sign' : 'public_sign', post_id: postId, paths })
  return images.map(image => ({ ...image, preview: managedBlogPath(image.url) ? signed?.[image.url.slice('storage://percent-blog-images/'.length)] : image.url }))
}
export async function uploadBlogImage(postId: string, file: File): Promise<BlogImage> {
  const bitmap = await createImageBitmap(file)
  const width = bitmap.width, height = bitmap.height
  bitmap.close()
  if (width < 1 || width > 10000 || height < 1 || height > 10000) throw new Error('Image dimensions must be 1–10,000 pixels.')
  const form = new FormData()
  form.set('action', 'upload'); form.set('post_id', postId); form.set('file', file)
  const { data, error } = await supabase.functions.invoke('percent-blog-media', { body: form })
  if (error || data?.error) throw await mediaFailure(error, data)
  if (!data?.url || !managedBlogPath(data.url)) throw new Error('Blog image upload failed')
  return { role: 'primary', url: data.url, alt: '', width, height, preview: data.preview_url }
}
export async function cleanupBlogImage(postId: string, url: string): Promise<void> {
  if (!managedBlogPath(url)) return
  await media({ action: 'cleanup', post_id: postId, paths: [url.slice('storage://percent-blog-images/'.length)] })
}
export function toBlogArticle(document: BlogDocument, images: BlogImage[]): BlogArticle {
  const primary = images.find(image => image.role === 'primary')
  const secondary = images.find(image => image.role === 'secondary')
  const image = (source?: BlogImage) => ({ src: source?.preview ?? (source?.url.startsWith('https://') ? source.url : ''), alt: source?.alt ?? '', width: source?.width ?? 1200, height: source?.height ?? 900 })
  return { slug: document.slug || 'draft', title: document.title || 'Untitled article', excerpt: document.excerpt, introduction: document.introduction, category: document.category as BlogCategory, author: document.author, date: (document.published_at ?? new Date().toISOString()).slice(0, 10), featured: document.featured, pullQuote: document.pull_quote, sections: document.sections, image: image(primary), secondaryImage: secondary ? image(secondary) : undefined }
}
