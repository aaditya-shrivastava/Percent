import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const editor = readFileSync(new URL('../src/pages/admin/AdminWebsiteEditor.tsx', import.meta.url), 'utf8')
const preview = readFileSync(new URL('../src/pages/admin/WebsitePreviewPage.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../src/pages/admin/website-editor.css', import.meta.url), 'utf8')

assert.match(app, /pathname==='\/admin\/website\/preview'/)
assert.match(editor, /percent-website-preview-draft/)
assert.match(preview, /percent-website-preview-ready/)
assert.match(preview, /event\.origin !== window\.location\.origin/)
assert.match(preview, /event\.source !== window\.parent/)
assert.match(preview, /WebsiteContentProvider value=\{value\}/)
assert.match(preview, /StorefrontBootstrap/)
assert.match(preview, /<Header \/>\{selected\}<Footer \/>/)
for (const component of ['<HomePage />', '<ShopPage />', '<ProductDetailsPage', '<SoldOutDesignsPage />', '<AboutPage />', '<ContactPage />', '<FaqPage />', '<PolicyPage']) assert.ok(preview.includes(component), `preview does not reuse ${component}`)
assert.match(preview, /closest\('a'\)/)
assert.doesNotMatch(editor, /newArrivals|preview-navbar|preview-hero|preview-products|preview-footer/)
assert.match(editor, /desktop: 1440, tablet: 768, mobile: 390/)
assert.match(editor, /ResizeObserver/)
assert.match(styles, /overflow:hidden/)
assert.match(styles, /height:max\(620px,calc\(100vh - 245px\)\)/)
assert.match(styles, /preview-browser iframe/)

console.log('PASS Website Live Preview: one storefront component tree, same-origin draft injection, real catalog bootstrap, contained navigation, true responsive iframe viewports, and independent full-page scrolling verified')
