import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const projectRef = 'gijyjdeohvdrnvqfqdha'
const db = createClient(`https://${projectRef}.supabase.co`, 'sb_publishable_QxLwW-LIAjzV-s8YbKMP2Q_-FqY_DXc', { auth: { persistSession: false, autoRefreshToken: false } })
const draftId = 'f6b65a97-1f13-4b77-b760-7a944620f5e7'
const draftImagePath = `products/${draftId}/8e6e7128dfdf2d6785e2f21bb5aae2a5b7b09e11ac55895b50b452890b1f5f3b.webp`

const [products, variants, images, signing] = await Promise.all([
  db.from('products').select('id,status,is_visible').eq('id', draftId),
  db.from('product_variants').select('id').eq('product_id', draftId),
  db.from('product_images').select('id').eq('product_id', draftId),
  db.storage.from('percent-product-images').createSignedUrls([draftImagePath], 60),
])
for (const result of [products, variants, images]) assert.equal(result.error, null)
assert.equal(products.data.length, 0, 'Anonymous callers must not see verification drafts')
assert.equal(variants.data.length, 0, 'Anonymous callers must not see draft variants')
assert.equal(images.data.length, 0, 'Anonymous callers must not see draft image metadata')
assert.ok(signing.error || signing.data?.some(item => item.error || !item.signedUrl), 'Anonymous callers must not sign draft media')
console.log('PASS Percent anonymous draft product, variant, image and private-media signing denial')
