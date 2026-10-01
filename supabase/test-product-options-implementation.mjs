import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')
const [settings, section, service, editor, editorBackend, styles, editorStyles, types, migration] = await Promise.all([
  read('../src/pages/admin/AdminSettings.tsx'),
  read('../src/pages/admin/ProductOptionsSettings.tsx'),
  read('../src/backend/admin/productOptions.ts'),
  read('../src/pages/admin/AdminProductEditor.tsx'),
  read('../src/backend/admin/editor.ts'),
  read('../src/pages/admin/admin-users-settings.css'),
  read('../src/pages/admin/editor.css'),
  read('../src/backend/database.types.ts'),
  read('./migrations/20260930113030_product_options_foundation.sql'),
])

assert.match(settings, /<ProductOptionsSettings\/>/)
assert.match(section, /id="product-options"/)
assert.match(section, /Add Color/)
assert.match(section, /Add Size/)
assert.match(section, /usage_count/)
assert.match(section, /Move \$\{option\.name\} up/)
assert.match(section, /Move \$\{option\.label\} down/)
assert.match(section, /Disable.*Re-enable/)
assert.match(section, /used by.*existing product variants/i)
assert.match(section, /six-digit hex color/i)
assert.match(section, /role="alert"/)
assert.match(section, /role="status"/)
assert.doesNotMatch(section, /deleteProduct|Delete Color|Delete Size/)

for (const rpc of ['admin_list_product_options', 'save_product_color_option', 'save_product_size_option', 'admin_reorder_product_options']) assert.match(service, new RegExp(`rpc\\('${rpc}'`))
assert.match(service, /PT409/)
assert.match(service, /23505/)
assert.match(service, /42501/)
assert.doesNotMatch(service + section, /service[_-]?role|firebase.*uid|uid.*firebase|localStorage|sessionStorage/i)

assert.match(editorBackend, /listProductOptions\(\)/)
assert.doesNotMatch(editorBackend, /from\('colours'\)/)
assert.match(editor, /activeColors=data\.colours\.filter\(color=>color\.enabled\)/)
assert.match(editor, /activeSizes=data\.sizes\.filter\(size=>size\.enabled\)/)
assert.match(editor, /c\.enabled\|\|c\.id===v\.colour_id/)
assert.match(editor, /size\.enabled\|\|size\.normalized_label===v\.size\.trim\(\)\.toLowerCase\(\)/)
assert.match(editor, /\(Disabled\)/)
assert.match(editor, /\(Legacy\)/)
assert.match(editor, /Settings → Product Options/)
assert.doesNotMatch(editor, /\['S','M','L','XL'\]/)
assert.doesNotMatch(editor, /editor-sizes|<datalist/)

assert.match(types, /product_size_options:/)
assert.match(types, /admin_list_product_options:/)
assert.match(migration, /private\.current_user_id\(\)/)
assert.match(migration, /private\.is_admin\(\)/)
assert.match(migration, /raise exception 'Color option changed; reload before saving' using errcode = 'PT409'/)
assert.match(migration, /raise exception 'Size option changed; reload before saving' using errcode = 'PT409'/)
assert.match(migration, /This color is used by existing product variants/)
assert.match(migration, /revoke insert, update, delete on table public\.colours from public, anon, authenticated/)

for (const breakpoint of [1100, 600, 360]) assert.match(styles, new RegExp(`max-width:${breakpoint}px`))
assert.match(styles, /:focus-visible/)
assert.match(editorStyles, /editor-option-warning/)
assert.match(editorStyles, /max-width:600px/)

console.log('PASS Product Options Settings, managed RPC adapter, dynamic Product Editor choices, disabled historical compatibility, PT409 handling, security boundaries, responsive modes, and accessibility semantics')
