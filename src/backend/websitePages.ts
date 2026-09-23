import { supabase } from './client'
import { faqCategories, faqItems } from '../data/support'
import { policyById, type PolicyId } from '../data/policies'
import { aboutImages } from '../data/about'

export const pageKeys = ['shop', 'product_details', 'sold_out', 'about', 'contact', 'faq', 'policy_shipping', 'policy_returns', 'policy_privacy', 'policy_terms'] as const
export type PageKey = typeof pageKeys[number]
export type PageSection = { section_key: string; heading: string | null; body: string | null; cta_label: string | null; cta_path: string | null; media_path: string | null; media_alt: string | null; media_width: number | null; media_height: number | null; enabled: boolean; sort_order: number; media_url?: string }
export type FaqItem = { item_key: string; question: string; answer: string; enabled: boolean; sort_order: number }
export type FaqCategory = { category_key: string; label: string; enabled: boolean; sort_order: number; items: FaqItem[] }
export type PolicySection = { section_key: string; heading: string; paragraphs: string[]; sort_order: number }
export type PageDocument = { page_key: PageKey; updated_at: string | null; eyebrow: string | null; heading: string | null; subheading: string | null; body: string | null; cta_label: string | null; cta_path: string | null; media_path: string | null; media_alt: string | null; media_width: number | null; media_height: number | null; sections: PageSection[]; faq_categories: FaqCategory[]; policy_sections: PolicySection[]; media_url?: string }
export type PageResult = { managed: boolean; document: PageDocument }

const section = (section_key: string, sort_order: number, heading: string | null, body: string | null = null, cta_label: string | null = null, cta_path: string | null = null): PageSection => ({ section_key, heading, body, cta_label, cta_path, media_path: null, media_alt: null, media_width: null, media_height: null, enabled: true, sort_order })
const base = (page_key: PageKey, heading: string | null, subheading: string | null = null, body: string | null = null, eyebrow: string | null = null): PageDocument => ({ page_key, updated_at: null, eyebrow, heading, subheading, body, cta_label: null, cta_path: null, media_path: null, media_alt: null, media_width: null, media_height: null, sections: [], faq_categories: [], policy_sections: [] })

export function fallbackPageDocument(key: PageKey): PageDocument {
  if (key === 'shop') return { ...base(key, 'Shop Exclusive', 'Standard and oversized fits. Made to stand apart.') }
  if (key === 'product_details') return { ...base(key, null), sections: [section('size_guide', 1, 'Percent sizing', 'Measurements are garment measurements. Compare them with a T-shirt you already own.'), section('details', 2, 'Made to live beyond the drop.'), section('extra_details', 3, 'Everything worth knowing.'), section('related', 4, 'Continue exploring.'), section('archive_notice', 5, 'This design is archived.', 'The production run is complete. There will be no restock or repeat.')] }
  if (key === 'sold_out') return { ...base(key, 'Sold Out.', 'They’re gone, forever.', 'Every Percent design is created in a fixed production run.\nWhen it’s sold out, it’s gone forever.\nNo restocks. No repeats. Just exclusivity.', 'Percent Archive'), cta_label: 'Discover Current Drop', cta_path: '/shop', sections: [section('archive_catalog', 1, 'Archived Designs'), section('promise_production', 2, 'Limited production', 'Each design has its own fixed production limit.'), section('promise_permanence', 3, 'Once gone, never back', 'No restocks. No second chances.'), section('promise_exclusivity', 4, 'Exclusive by design', 'Created for the few who value rarity.'), section('promise_thanks', 5, 'Thank you', 'For being a part of something rare.')] }
  if (key === 'about') return { ...base(key, 'Not Just A Brand,\nIt makes you unique.', null, 'PERCENT was built for the ones who keep it real.\nEvery drop is limited. Every piece is intentional.\nLess ordinary, more you.', 'This is Percent'), sections: [section('statement', 1, 'When you look good, you feel unstoppable.\nYour outfit is your first impression.'), section('live', 2, null, null, 'Live Now', '/shop'), section('limited', 3, null, 'Every design has its own limited production run.\nOnce they’re gone, they’re gone forever.\nNo restocks, no repeats.'), section('values', 4, 'What we Deliver.', 'Our promise'), section('craft', 5, null), section('identity', 6, 'Where Elegance\nMeets Identity', 'Intentional design and clean silhouettes in limited runs. Made for people who wear their identity with confidence.', 'Explore the Store', '/shop')].map(item => { const image = item.section_key === 'live' ? aboutImages.live : item.section_key === 'craft' ? aboutImages.craft : item.section_key === 'identity' ? aboutImages.identity : null; return image ? { ...item, media_url: image.src, media_alt: image.alt, media_width: image.width, media_height: image.height } : item }) }
  if (key === 'contact') return { ...base(key, 'Contact / Support', 'We’re here to help. Reach out to us for order assistance, product inquiries, sizing questions, or any other support.', 'Real People. Genuine Support.', 'Percent Support'), sections: [section('support', 1, 'We’re Here for You', 'We aim to respond as soon as possible.'), section('quick_help', 2, 'Quick Help')] }
  if (key === 'faq') return { ...base(key, 'FAQ / Policies', 'Find answers to common questions about orders, shipping, returns, sizing, payments, and store policies.', null, 'Percent Help'), sections: [section('policy_links', 1, 'Policies at a Glance'), section('contact_cta', 2, 'Still Have a Question?', null, 'Contact Support', '/contact')], faq_categories: faqCategories.filter(name => name !== 'All').map((name, index) => ({ category_key: name, label: name, enabled: true, sort_order: index + 1, items: faqItems.filter(item => item.category === name).map((item, itemIndex) => ({ item_key: item.id, question: item.question, answer: item.answer, enabled: true, sort_order: itemIndex + 1 })) })) }
  const id = key.replace('policy_', '') as PolicyId
  const policy = policyById[id]
  return { ...base(key, policy.title, policy.introduction, null, 'Percent Policies'), policy_sections: policy.sections.map((item, index) => ({ section_key: item.id, heading: item.title, paragraphs: item.paragraphs, sort_order: index + 1 })) }
}

const normalize = (key: PageKey, raw: unknown): PageDocument => {
  const value = raw as Partial<PageDocument> | null
  if (!value || value.page_key !== key || !Array.isArray(value.sections) || !Array.isArray(value.faq_categories) || !Array.isArray(value.policy_sections)) throw new Error('Website page content is unavailable')
  const fromPublicKey = <T extends { section_key?: string; category_key?: string; item_key?: string; key?: string }>(item: T, field: 'section_key' | 'category_key' | 'item_key') => ({ ...item, [field]: item[field] ?? item.key, enabled: 'enabled' in item ? item.enabled : true })
  return {
    ...base(key, value.heading ?? null), ...value,
    updated_at: value.updated_at ?? null,
    sections: value.sections.map(item => fromPublicKey(item, 'section_key')) as PageSection[],
    faq_categories: value.faq_categories.map(category => ({ ...fromPublicKey(category, 'category_key'), items: category.items.map(item => fromPublicKey(item, 'item_key')) })) as FaqCategory[],
    policy_sections: value.policy_sections.map(item => fromPublicKey(item, 'section_key')) as PolicySection[],
  }
}

async function signed(action: 'public_page_read' | 'admin_page_read', page_key: PageKey, paths: string[] = []) {
  const { data, error } = await supabase.functions.invoke('percent-website-media', { body: { action, page_key, paths } })
  if (error) throw error
  return (data as { media?: Record<string, string> })?.media ?? {}
}

function hydrate(document: PageDocument, media: Record<string, string>): PageDocument {
  return { ...document, media_url: document.media_path ? media[document.media_path] : document.media_url, sections: document.sections.map(item => ({ ...item, media_url: item.media_path ? media[item.media_path] : item.media_url })) }
}

export async function loadStorefrontPage(key: PageKey): Promise<PageResult> {
  const { data, error } = await supabase.rpc('get_storefront_page', { p_page_key: key })
  if (error) throw error
  if (!data) return { managed: false, document: fallbackPageDocument(key) }
  return { managed: true, document: hydrate(normalize(key, data), await signed('public_page_read', key)) }
}

export async function loadPageEditor(key: PageKey): Promise<PageResult> {
  const { data, error } = await supabase.rpc('get_website_page_editor', { p_page_key: key })
  if (error) throw error
  if (!data) return { managed: false, document: fallbackPageDocument(key) }
  return { managed: true, document: hydrate(normalize(key, data), await signed('admin_page_read', key)) }
}

export async function signDraftPagePaths(key: PageKey, paths: string[]) { return signed('admin_page_read', key, paths) }

export async function savePage(document: PageDocument) {
  const content = {
    page_key: document.page_key, eyebrow: document.eyebrow, heading: document.heading,
    subheading: document.subheading, body: document.body, cta_label: document.cta_label,
    cta_path: document.cta_path, media_path: document.media_path, media_alt: document.media_alt,
    media_width: document.media_width, media_height: document.media_height,
    sections: document.sections.map(({ section_key, heading, body, cta_label, cta_path, media_path, media_alt, media_width, media_height, enabled, sort_order }) => ({ section_key, heading, body, cta_label, cta_path, media_path, media_alt, media_width, media_height, enabled, sort_order })),
    faq_categories: document.faq_categories.map(({ category_key, label, enabled, sort_order, items }) => ({ category_key, label, enabled, sort_order, items: items.map(({ item_key, question, answer, enabled, sort_order }) => ({ item_key, question, answer, enabled, sort_order })) })),
    policy_sections: document.policy_sections.map(({ section_key, heading, paragraphs, sort_order }) => ({ section_key, heading, paragraphs, sort_order })),
  }
  const { data, error } = await supabase.rpc('save_website_page', { p_page_key: document.page_key, p_content: content, p_expected_updated_at: document.updated_at })
  if (error) throw error
  return normalize(document.page_key, data)
}

export const pageMediaPath = /^pages\/(about|contact)\/[0-9a-f]{64}\.(jpg|png|webp)$/
export function validatePage(document: PageDocument): string[] {
  const errors: string[] = []
  if (document.page_key !== 'product_details' && !document.heading?.trim()) errors.push('Add a page heading.')
  if (!!document.cta_label !== !!document.cta_path) errors.push('Complete both page CTA fields.')
  if (document.media_path && (!pageMediaPath.test(document.media_path) || !document.media_alt?.trim() || !document.media_width || !document.media_height)) errors.push('Upload a valid page image with alt text.')
  for (const section of document.sections) {
    if (!!section.cta_label !== !!section.cta_path) errors.push(`${section.section_key}: complete both CTA fields.`)
    if (section.media_path && (!pageMediaPath.test(section.media_path) || !section.media_alt?.trim() || !section.media_width || !section.media_height)) errors.push(`${section.section_key}: upload a valid image with alt text.`)
  }
  if (document.page_key === 'faq' && !document.faq_categories.length) errors.push('Add at least one FAQ category.')
  if (document.page_key.startsWith('policy_') && !document.policy_sections.length) errors.push('Add at least one policy section.')
  return errors
}

export async function uploadPageImage(file: File, pageKey: 'about' | 'contact', size: { width: number; height: number }) {
  const form = new FormData()
  form.set('action', 'upload'); form.set('target_kind', 'page'); form.set('target_id', pageKey)
  form.set('request_id', crypto.randomUUID()); form.set('width', String(size.width)); form.set('height', String(size.height)); form.set('file', file)
  const { data, error } = await supabase.functions.invoke('percent-website-media', { body: form })
  if (error) throw error
  const result = data as { path?: string; preview_url?: string; width?: number; height?: number }
  if (!result.path || !pageMediaPath.test(result.path) || !result.preview_url || result.width !== size.width || result.height !== size.height) throw new Error('Upload returned an invalid page image.')
  return result as { path: string; preview_url: string; width: number; height: number }
}
