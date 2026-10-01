import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const read=path=>readFile(new URL(path,import.meta.url),'utf8')
const [backend,globalEditor,routes,shell,header,footer,context,edge,css]=await Promise.all([
 read('../src/backend/website.ts'),read('../src/pages/admin/AdminGlobalWebsiteEditor.tsx'),read('../src/pages/admin/AdminRoutes.tsx'),read('../src/components/admin/AdminShell.tsx'),read('../src/components/layout/Header.tsx'),read('../src/components/layout/Footer.tsx'),read('../src/components/layout/WebsiteContentContext.tsx'),read('./functions/percent-website-media/index.ts'),read('../src/pages/admin/global-website-editor.css'),
])
for(const route of ['navbar','footer','branding','colors','typography','social-links','media'])assert.match(shell,new RegExp(`website/\\$\\{item\\}|${route}`))
assert.match(routes,/website\/:section/);assert.match(routes,/website\/footer/)
for(const editor of ['NavbarEditor','BrandingEditor','ColorsEditor','TypographyEditor','SocialEditor','MediaLibrary'])assert.match(globalEditor,new RegExp(`function ${editor}`))
assert.match(backend,/save_website_global_settings/);assert.match(backend,/settings:\{footer_tagline:/)
assert.match(header,/settings\.navbar_items/);assert.match(header,/branding/)
assert.match(footer,/social_links/);assert.match(footer,/noopener noreferrer/)
assert.match(context,/--font-heading/);assert.match(context,/--accent-hover/)
for(const action of ['library_list','branding','library'])assert.match(edge,new RegExp(action))
assert.match(edge,/Referenced media cannot be removed/);assert.match(edge,/branding->>logo_path/)
for(const width of ['1080','850','600','360'])assert.match(css,new RegExp(`max-width:${width}px`))
assert.doesNotMatch(globalEditor,/service.role|service_role|localStorage|sessionStorage/)
console.log('PASS global Website Editor routes, editors, storefront tokens, media security, and responsive source coverage')
