import { supabase } from './client'

const bucket = 'percent-product-images'
const prefix = `storage://${bucket}/`
const lifetime = 3600

export function productImagePath(url: string, productId: string): string | null {
  if (!url.startsWith(prefix)) return null
  const path = url.slice(prefix.length)
  return new RegExp(`^products/${productId}/[0-9a-f]{64}\\.(jpg|png|webp)$`).test(path) ? path : null
}

export async function signedProductImages(images: { product_id: string; url: string }[], activeIds: Set<string>) {
  const paths = [...new Set(images.flatMap(image => {
    if (!activeIds.has(image.product_id)) return []
    const path = productImagePath(image.url, image.product_id)
    return path ? [path] : []
  }))]
  const delivered = new Map<string, string>()
  for (let start = 0; start < paths.length; start += 100) {
    const batch = paths.slice(start, start + 100)
    const { data, error } = await supabase.storage.from(bucket).createSignedUrls(batch, lifetime)
    if (error || !data || data.some(item => item.error || !item.signedUrl)) {
      throw new Error('Published product images are unavailable. Please retry.')
    }
    data.forEach((item, index) => delivered.set(batch[index], item.signedUrl))
  }
  return delivered
}

export function deliveredProductImage(url: string, productId: string, signed: Map<string, string>) {
  const path = productImagePath(url, productId)
  return path ? signed.get(path) ?? '' : url.startsWith('storage://') ? '' : url
}
