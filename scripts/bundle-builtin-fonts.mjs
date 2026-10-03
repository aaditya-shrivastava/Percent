import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

// Reproducible, self-hosted assets; never import these rules globally into Admin.
const ids = ['inter', 'manrope', 'dm-sans', 'montserrat', 'outfit', 'space-grotesk', 'playfair-display', 'cormorant-garamond', 'lora', 'libre-baskerville']
const root = process.cwd()
const registry = []
for (const id of ids) {
  const variable = id !== 'libre-baskerville'
  const packageName = `@fontsource${variable ? '-variable' : ''}/${id}`
  const directory = path.join(root, 'node_modules', packageName)
  const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'metadata.json'), 'utf8'))
  const version = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8')).version
  const target = path.join(root, 'public/fonts/builtin', id)
  fs.mkdirSync(target, { recursive: true })
  const cssFiles = variable
    ? ['wght.css', ...(metadata.styles.includes('italic') ? ['wght-italic.css'] : [])]
    : metadata.weights.flatMap(weight => metadata.styles.map(style => `${weight}${style === 'italic' ? '-italic' : ''}.css`))
  const alias = `PercentBuiltin_${id.replaceAll('-', '_')}`
  const assets = new Map()
  const css = cssFiles.map(file => fs.readFileSync(path.join(directory, file), 'utf8')
    .replace(/font-family: '[^']+';/g, `font-family: '${alias}';`)
    .replace(/, url\([^)]*\.woff\) format\('woff'\)/g, '')
    .replace(/url\(\.\/files\/([^)]*\.woff2)\)/g, (_, filename) => {
      const bytes = fs.readFileSync(path.join(directory, 'files', filename))
      if (bytes.toString('ascii', 0, 4) !== 'wOF2' || bytes.readUInt32BE(8) !== bytes.length) throw new Error(`Invalid WOFF2: ${filename}`)
      fs.writeFileSync(path.join(target, filename), bytes)
      assets.set(filename, { path: `/fonts/builtin/${id}/${filename}`, size: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') })
      return `url(./${filename})`
    })).join('\n')
  fs.writeFileSync(path.join(target, 'font.css'), css)
  fs.copyFileSync(path.join(directory, 'LICENSE'), path.join(target, 'LICENSE.txt'))
  registry.push({ name: metadata.family, id, cssFamily: alias, cssPath: `/fonts/builtin/${id}/font.css`, fallback: metadata.category === 'serif' ? 'Georgia, "Times New Roman", serif' : 'system-ui, -apple-system, "Segoe UI", sans-serif', weights: metadata.weights, styles: metadata.styles, package: packageName, version, license: metadata.license, assets: [...assets.values()] })
}
registry.push({ name: 'system-ui', cssFamily: 'system-ui', fallback: 'sans-serif', assets: [] }, { name: 'Georgia', cssFamily: 'Georgia', fallback: '"Times New Roman", serif', assets: [] })
fs.writeFileSync(path.join(root, 'public/fonts/builtin/registry.json'), JSON.stringify(registry, null, 2) + '\n')
console.log(`Bundled ${registry.length} families; ${registry.reduce((count, font) => count + font.assets.length, 0)} licensed WOFF2 assets. No live typography changes.`)
