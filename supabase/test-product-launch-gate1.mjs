import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const projectRef = 'gijyjdeohvdrnvqfqdha'
const supabase = createClient(
  `https://${projectRef}.supabase.co`,
  'sb_publishable_QxLwW-LIAjzV-s8YbKMP2Q_-FqY_DXc',
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const bucket = 'percent-product-images'
const toPath = url => url.replace(`storage://${bucket}/`, '')

const { data: visibleImages, error: visibleImagesError } = await supabase
  .from('product_images')
  .select('url,products!inner(id,status,is_visible)')
  .like('url', `storage://${bucket}/%`)
  .eq('products.is_visible', true)
  .in('products.status', ['active', 'archived'])

assert.equal(visibleImagesError, null, 'Visible active/archived image metadata query should be allowed anonymously')

const visiblePaths = (visibleImages ?? []).map(image => toPath(image.url))
if (visiblePaths.length > 0) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(visiblePaths, 60)
  assert.equal(error, null, 'Visible active/archived product images should be anonymously signable')
  assert.equal(data.length, visiblePaths.length)
  for (const item of data) assert.ok(item.signedUrl && !item.error, 'Visible image should receive a signed URL')
}

const { data: draftImages, error: draftImagesError } = await supabase
  .from('product_images')
  .select('url,products!inner(id,status,is_visible)')
  .like('url', `storage://${bucket}/%`)
  .eq('products.status', 'draft')
  .eq('products.is_visible', false)
  .limit(1)

assert.equal(draftImagesError, null)
assert.equal(draftImages.length, 0, 'Draft image metadata must remain hidden anonymously')

const knownDraftPath = 'products/f6b65a97-1f13-4b77-b760-7a944620f5e7/8e6e7128dfdf2d6785e2f21bb5aae2a5b7b09e11ac55895b50b452890b1f5f3b.webp'
const { data: draftSigning, error: draftSigningError } = await supabase.storage.from(bucket).createSignedUrls([knownDraftPath], 60)
assert.ok(draftSigningError || draftSigning?.some(item => item.error || !item.signedUrl), 'Draft media must not be anonymously signable')

const { data: unrelatedSigning, error: unrelatedSigningError } = await supabase.storage
  .from(bucket)
  .createSignedUrls(['products/00000000-0000-0000-0000-000000000000/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png'], 60)
assert.ok(unrelatedSigningError || unrelatedSigning?.some(item => item.error || !item.signedUrl), 'Unrelated object paths must not be anonymously signable')

const { data: listData, error: listError } = await supabase.storage.from(bucket).list('products', { limit: 1 })
assert.ok(listError || listData?.length === 0, 'Anonymous bucket listing must remain blocked')

console.log(JSON.stringify({
  status: 'PASS',
  visibleActiveOrArchivedImageCount: visiblePaths.length,
  visibleSigningTested: visiblePaths.length > 0,
  draftMetadataHidden: true,
  draftSigningDenied: true,
  unrelatedSigningDenied: true,
  bucketListingBlocked: true,
}, null, 2))
