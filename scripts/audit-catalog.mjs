import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

// Evaluate the existing pure data modules without altering or importing the UI.
const cache = new Map()
function readModule(file) {
  file = path.resolve(file)
  if (cache.has(file)) return cache.get(file)
  let source = fs.readFileSync(file, 'utf8')
  if (file.endsWith('shop.ts')) source += '\nexport const auditCatalog = catalog;'
  if (file.endsWith('productDetails.ts')) source += '\nexport const auditBuildDetails = buildDetails;'
  source = source.replaceAll('import.meta.env', '({})')
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  cache.set(file, exports)
  vm.runInNewContext(output, { exports, require: relative => readModule(path.resolve(path.dirname(file), relative + '.ts')), Date, Intl, URLSearchParams, console }, { filename: file })
  return exports
}
const shop = readModule('src/data/shop.ts')
const { auditBuildDetails } = readModule('src/data/productDetails.ts')
const { getArchivedProducts } = readModule('src/data/archive.ts')
const { blogArticles } = readModule('src/data/blog.ts')
const { productColours, productTags } = readModule('src/data/homepage.ts')
const products = shop.auditCatalog.map(auditBuildDetails)
const archives = getArchivedProducts().map(p => ({ ...auditBuildDetails(p), archiveNumber: p.archiveNumber, archivedAt: p.archivedAt }))
const summary = {
  catalogProducts: products.length, publicShopProducts: shop.getPublicShopProducts().length,
  catalogVariants: products.reduce((n, p) => n + p.variants.length, 0),
  archiveDemoClones: archives.length, archiveDemoVariants: archives.reduce((n,p) => n+p.variants.length,0),
  sizes: [...new Set(products.flatMap(p => p.sizes))], colors: productColours,
  categories: [...new Set(products.map(p=>p.category))], tags: productTags,
  soldOut: products.filter(p=>p.isSoldOut).map(p=>p.slug),
  nonPublic: products.filter(p=>!shop.getPublicShopProducts().some(q=>p.id===q.id)).map(p=>({slug:p.slug,status:p.status,visible:p.isVisible})),
  inventoryMismatches: products.filter(p=>p.variants.reduce((n,v)=>n+v.stock,0)!==p.remainingPieces).map(p=>({slug:p.slug,remaining:p.remainingPieces,variantStock:p.variants.reduce((n,v)=>n+v.stock,0)})),
  blogPosts: blogArticles.length, blogCategories: [...new Set(blogArticles.map(p=>p.category))],
}
fs.mkdirSync('docs/backend', { recursive:true })
fs.writeFileSync('docs/backend/catalog-audit.json', JSON.stringify({ summary, products, archives, blogArticles }, null, 2)+'\n')
console.log(JSON.stringify(summary,null,2))
