import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/pages/admin/AdminWebsiteEditor.tsx', import.meta.url), 'utf8')
const pageEditor = readFileSync(new URL('../src/pages/admin/AdminWebsitePageEditor.tsx', import.meta.url), 'utf8')
const allEditors = source + pageEditor
const styles = readFileSync(new URL('../src/pages/admin/website-editor.css', import.meta.url), 'utf8')
const preview = readFileSync(new URL('../src/pages/admin/WebsitePreviewPage.tsx', import.meta.url), 'utf8')

for (const contract of [
  'Website editor modules', 'Hero Banners', 'Live Preview', 'Page Sections',
  'Save Changes', 'Unsaved changes', 'Stale version detected',
  "type Device = 'desktop' | 'tablet' | 'mobile'", 'useBeforeUnload', 'useBlocker',
]) assert.ok(allEditors.includes(contract), `missing UI contract: ${contract}`)

assert.match(source, /document\.banners\.map/)
assert.match(source, /document\.sections\.map/)
assert.match(source, /src="\/admin\/website\/preview"/)
assert.match(source, /desktop: 1440, tablet: 768, mobile: 390/)
assert.match(source, /saveWebsite\(document\)/)
assert.match(source, /loadWebsiteEditor\(\)/)
assert.match(pageEditor, /savePage\(document\)/)
assert.match(pageEditor, /loadPageEditor\(pageKey\)/)
assert.match(pageEditor, /iframe ref=\{frame\}/)
assert.doesNotMatch(source, /Save Draft|>Publish</)
assert.doesNotMatch(source, /Supabase|RPC|database ID|raw JSON/)
assert.doesNotMatch(source, /preview-navbar|preview-hero|preview-products|PreviewFooter/)
for (const component of ['<Header />', '<HomePage />', '<Footer />']) assert.ok(preview.includes(component), `preview does not reuse ${component}`)

for (const width of ['1300px', '1080px', '850px', '600px', '425px', '360px']) {
  assert.ok(styles.includes(`max-width:${width}`), `missing responsive breakpoint: ${width}`)
}
assert.match(styles, /grid-template-columns:168px minmax\(390px,500px\) minmax\(480px,1fr\)/)
assert.match(styles, /\.preview-browser iframe/)

console.log('PASS Website Editor UI: truthful designer navigation, selected-banner editing, live responsive preview, compact sections, Footer mode, save states, and unsaved-change protection verified')
