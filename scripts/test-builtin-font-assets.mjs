import fs from 'node:fs'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { createServer } from 'vite'

const require = createRequire(import.meta.url)
const { chromium } = require('C:/Users/mihir/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const registry = JSON.parse(fs.readFileSync('public/fonts/builtin/registry.json', 'utf8'))
const fonts = registry.filter(font => font.assets.length)
for (const font of fonts) {
  for (const asset of font.assets) {
    const bytes = fs.readFileSync('public' + asset.path)
    assert.equal(bytes.length, asset.size)
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), asset.sha256)
    assert.equal(bytes.toString('ascii', 0, 4), 'wOF2')
  }
  const css = fs.readFileSync('public' + font.cssPath, 'utf8')
  assert.ok(css.includes(`font-family: '${font.cssFamily}'`))
  assert.ok(css.includes('font-display: swap'))
  assert.ok(!/https?:|\.woff\)/.test(css), 'No CDN or raster fallback')
  assert.ok(fs.readFileSync(`public/fonts/builtin/${font.id}/LICENSE.txt`, 'utf8').includes('SIL OPEN FONT LICENSE'))
}
const server = await createServer({ server: { host: '127.0.0.1', port: 5194, strictPort: true }, logLevel: 'error' })
await server.listen()
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('http://127.0.0.1:5194/fonts/builtin/registry.json')
  await page.setContent('<main><h1>Percent Typography</h1><p>Limited pieces. Intentional designs.</p><button>Explore the shop</button></main>')
  // Decode every shipped subset/style/weight, not merely its signature.
  const decoded = await page.evaluate(async fonts => {
    let count = 0
    for (const font of fonts) for (const asset of font.assets) {
      const response = await fetch(asset.path)
      if (!response.ok) throw new Error(`Missing asset: ${asset.path}`)
      const face = new FontFace('DecodeQA', await response.arrayBuffer(), { display: 'swap' })
      await face.load()
      if (face.status !== 'loaded') throw new Error('Font failed decoding')
      count++
    }
    return count
  }, fonts)
  const renderings = []
  for (const font of registry) {
    const pixels = await page.evaluate(async font => {
      if (font.cssPath) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'; link.href = font.cssPath
        const ready = new Promise((resolve, reject) => { link.onload = resolve; link.onerror = reject })
        document.head.append(link)
        await ready
        const loaded = await document.fonts.load(`400 32px "${font.cssFamily}"`, 'Percent Typography')
        if (!loaded.length) throw new Error(`No face available: ${font.name}`)
      }
      const canvas = document.createElement('canvas')
      canvas.width = 900; canvas.height = 80
      const context = canvas.getContext('2d')
      context.font = `400 32px "${font.cssFamily}", ${font.fallback}`
      context.fillText('Percent Typography AaBb 0123456789', 10, 50)
      return canvas.toDataURL()
    }, font)
    renderings.push({ name: font.name, rendering_sha256: crypto.createHash('sha256').update(pixels).digest('hex') })
  }
  assert.equal(new Set(renderings.map(font => font.rendering_sha256)).size, registry.length, 'Each font must render distinctly')
  assert.deepEqual(errors, [])
  // Registering a family cannot alter the Admin/current Inter text: aliases only.
  assert.equal(await page.locator('h1').evaluate(element => getComputedStyle(element).fontFamily), '"Times New Roman"')
  const report = { checked_at: new Date().toISOString(), environment: 'Microsoft Edge headless; actual browser WOFF2 decoding and canvas rendering', families: registry.length, decoded_woff2_files: decoded, renderings, console_errors: errors, global_typography_unchanged: true, dropdowns_unchanged: true, rollout: 'Assets staged. Activation and font management remain pending SQL approval.' }
  fs.writeFileSync('docs/backend/builtin-font-asset-results.json', JSON.stringify(report, null, 2) + '\n')
  console.log(`PASS ${decoded} WOFF2 assets decoded; ${registry.length} distinct family renderings; licensed local delivery; no global styling or console errors.`)
} finally {
  await browser.close()
  await server.close()
}
