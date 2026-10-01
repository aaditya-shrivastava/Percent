import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const sql = await readFile(new URL('./migrations/20260930055929_global_website_editor_controls.sql', import.meta.url), 'utf8')
const globalFunction = sql.slice(sql.indexOf('create function public.save_website_global_settings'), sql.indexOf("revoke all on function public.save_website_global_settings"))
const occurrences = (source, fragment) => source.split(fragment).length - 1
const keys = (value, expected) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key))
const integer = value => typeof value === 'number' && Number.isInteger(value)
const hex = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
const fonts = new Set(['Inter', 'Georgia', 'system-ui'])
const platforms = new Set(['instagram', 'facebook', 'x', 'youtube', 'pinterest', 'linkedin'])

function valid(value) {
  if (!keys(value, ['navbar_items', 'branding', 'colors', 'typography', 'social_links'])) return false
  if (!Array.isArray(value.navbar_items) || value.navbar_items.length > 8) return false
  const nav = value.navbar_items
  if (!nav.every(item => keys(item, ['id', 'label', 'path', 'enabled', 'sort_order'])
    && typeof item.id === 'string' && /^[a-z][a-z0-9_-]{0,31}$/.test(item.id)
    && typeof item.label === 'string' && item.label.trim().length >= 1 && item.label.trim().length <= 40
    && typeof item.path === 'string' && /^\/(?:[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*)?(?:\?[a-z0-9][a-z0-9%._=&-]*)?$/.test(item.path)
    && !item.path.includes('..') && !item.path.startsWith('//')
    && typeof item.enabled === 'boolean' && integer(item.sort_order) && item.sort_order >= 1 && item.sort_order <= 8)) return false
  if (new Set(nav.map(item => item.id)).size !== nav.length || new Set(nav.map(item => item.sort_order)).size !== nav.length) return false

  const brand = value.branding
  if (!keys(brand, ['display_name', 'tagline', 'logo_path', 'logo_alt', 'logo_width', 'logo_height', 'favicon_path'])) return false
  if (typeof brand.display_name !== 'string' || !brand.display_name.trim() || typeof brand.tagline !== 'string' || !brand.tagline.trim()) return false
  const mediaPath = path => typeof path === 'string' && /^branding\/[0-9a-f]{64}\.(jpg|png|webp)$/.test(path)
  if (brand.logo_path === null) {
    if (brand.logo_alt !== null || brand.logo_width !== null || brand.logo_height !== null) return false
  } else if (!mediaPath(brand.logo_path) || typeof brand.logo_alt !== 'string' || !brand.logo_alt.trim()
    || !integer(brand.logo_width) || brand.logo_width < 1 || brand.logo_width > 12000
    || !integer(brand.logo_height) || brand.logo_height < 1 || brand.logo_height > 12000) return false
  if (brand.favicon_path !== null && !mediaPath(brand.favicon_path)) return false

  if (!keys(value.colors, ['background', 'surface', 'text', 'muted', 'accent', 'accent_hover', 'border', 'highlight'])
    || !Object.values(value.colors).every(hex)) return false
  const type = value.typography
  if (!keys(type, ['display_family', 'heading_family', 'body_family', 'ui_family', 'heading_weight', 'body_weight', 'letter_spacing'])
    || ![type.display_family, type.heading_family, type.body_family, type.ui_family].every(font => typeof font === 'string' && fonts.has(font))
    || !integer(type.heading_weight) || ![400, 500, 600, 700, 800].includes(type.heading_weight)
    || !integer(type.body_weight) || ![400, 500, 600, 700].includes(type.body_weight)
    || typeof type.letter_spacing !== 'number' || type.letter_spacing < -0.05 || type.letter_spacing > 0.30) return false

  const socials = value.social_links
  if (!Array.isArray(socials) || socials.length > 6 || !socials.every(item => keys(item, ['platform', 'url', 'enabled', 'sort_order'])
    && typeof item.platform === 'string' && platforms.has(item.platform)
    && typeof item.url === 'string' && /^https:\/\/([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(?::[0-9]{1,5})?(?:\/\S*)?$/i.test(item.url)
    && typeof item.enabled === 'boolean' && integer(item.sort_order) && item.sort_order >= 1 && item.sort_order <= 6)) return false
  return new Set(socials.map(item => item.platform)).size === socials.length && new Set(socials.map(item => item.sort_order)).size === socials.length
}

const defaults = {
  navbar_items: [
    { id: 'collection', label: 'Collection', path: '/shop', enabled: true, sort_order: 1 },
    { id: 'about', label: 'About Us', path: '/about', enabled: true, sort_order: 2 },
  ],
  branding: { display_name: '% PERCENT', tagline: 'LESS ORDINARY. MORE YOU.', logo_path: null, logo_alt: null, logo_width: null, logo_height: null, favicon_path: null },
  colors: { background: '#f7f4ef', surface: '#efe8df', text: '#1d1b1b', muted: '#6f6965', accent: '#711d32', accent_hover: '#6b2737', border: '#d8d0c8', highlight: '#f5f3ee' },
  typography: { display_family: 'Inter', heading_family: 'Inter', body_family: 'Inter', ui_family: 'Inter', heading_weight: 700, body_weight: 400, letter_spacing: 0 },
  social_links: [],
}
const clone = () => structuredClone(defaults)
const reject = mutate => { const value = clone(); mutate(value); assert.equal(valid(value), false) }

reject(v => { delete v.navbar_items[0].enabled })
reject(v => { v.navbar_items[0].enabled = null })
reject(v => { v.navbar_items[0].enabled = 'true' })
reject(v => { delete v.navbar_items[0].sort_order })
reject(v => { v.navbar_items[0].sort_order = '1' })
reject(v => { v.navbar_items[0].extra = true })
for (const key of ['logo_width', 'logo_height']) reject(v => { v.branding.logo_path = `branding/${'a'.repeat(64)}.png`; v.branding.logo_alt = 'Percent'; delete v.branding[key] })
reject(v => { v.branding.logo_path = `branding/${'a'.repeat(64)}.png`; v.branding.logo_alt = 'Percent'; v.branding.logo_width = null; v.branding.logo_height = null })
reject(v => { v.branding.logo_path = `branding/${'a'.repeat(64)}.png`; delete v.branding.logo_alt; v.branding.logo_width = 100; v.branding.logo_height = 100 })
reject(v => { v.branding.logo_path = `branding/${'a'.repeat(64)}.png`; v.branding.logo_alt = 'Percent'; v.branding.logo_width = 'wide'; v.branding.logo_height = 100 })
reject(v => { delete v.colors.background })
reject(v => { v.colors.background = null })
reject(v => { v.colors.background = 123 })
reject(v => { v.colors.background = '#fff' })
reject(v => { v.colors.extra = '#ffffff' })
reject(v => { delete v.typography.display_family })
reject(v => { v.typography.display_family = null })
reject(v => { delete v.typography.heading_weight })
reject(v => { v.typography.heading_weight = '700' })
reject(v => { delete v.typography.letter_spacing })
reject(v => { v.typography.display_family = 'Comic Sans' })
reject(v => { v.typography.extra = 1 })
const social = { platform: 'instagram', url: 'https://instagram.com/percent', enabled: true, sort_order: 1 }
reject(v => { v.social_links = [{ ...social }]; delete v.social_links[0].enabled })
reject(v => { v.social_links = [{ ...social, enabled: null }] })
reject(v => { v.social_links = [{ ...social }]; delete v.social_links[0].sort_order })
reject(v => { v.social_links = [{ ...social, url: 'javascript:alert(1)' }] })
reject(v => { v.social_links = [{ ...social, url: 'https://' }] })
reject(v => { v.social_links = [{ ...social }, { ...social, sort_order: 2 }] })
reject(v => { v.social_links = [{ ...social, extra: true }] })

assert.equal(valid(defaults), true)
for (const [fragment, expected] of [
  ['if content is null', 1],
  ["for item in select value from jsonb_array_elements(navbar) loop", 1],
  ["raise exception 'Brand text is invalid'", 1],
  ['logo_path :=', 1],
  ["raise exception 'Brand logo metadata is invalid'", 1],
  ["raise exception 'Colors must contain every supported token and no extras'", 1],
  ["raise exception 'Typography must contain every supported field and no extras'", 1],
  ["for item in select value from jsonb_array_elements(socials) loop", 1],
]) assert.equal(occurrences(globalFunction, fragment), expected, `duplicate or missing SQL fragment: ${fragment}`)
assert.equal((globalFunction.match(/\bif\b/g) ?? []).length, (globalFunction.match(/end if;/g) ?? []).length * 2, 'unbalanced IF blocks')
assert.equal((globalFunction.match(/\bloop\b/g) ?? []).length, (globalFunction.match(/end loop;/g) ?? []).length * 2, 'unbalanced LOOP blocks')
assert.match(sql, /private\.current_user_id\(\).*private\.is_admin\(\)/s)
assert.match(sql, /grant execute on function public\.get_storefront_content\(\) to anon, authenticated/)
assert.match(sql, /grant execute on function public\.get_website_editor\(\) to authenticated/)
assert.match(sql, /grant execute on function public\.save_website_global_settings\(jsonb,timestamptz\) to authenticated/)
assert.match(sql, /^begin;[\s\S]*commit;\s*$/i)
console.log('PASS global Website Editor SQL fail-closed matrix, defaults, privileges, and transaction envelope')
