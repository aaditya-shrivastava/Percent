import { useEffect, useState } from 'react'
import { fetchProductDetails, ProductNotFoundError, type ProductDetailsResponse } from '../data/productDetails'

const cache = new Map<string, ProductDetailsResponse>()

export function useProductDetails(slug: string | undefined) {
  const [state, setState] = useState<{ slug?: string; data?: ProductDetailsResponse; error?: 'not-found' | 'failed' }>(() => ({ slug, data: slug ? cache.get(slug) : undefined }))

  useEffect(() => {
    if (!slug || cache.has(slug)) return undefined
    const controller = new AbortController()
    fetchProductDetails(slug, controller.signal).then((response) => { cache.set(slug, response); setState({ slug, data: response }) }).catch((reason: unknown) => { if (reason instanceof DOMException && reason.name === 'AbortError') return; setState({ slug, error: reason instanceof ProductNotFoundError ? 'not-found' : 'failed' }) })
    return () => controller.abort()
  }, [slug])

  const cached = slug ? cache.get(slug) : undefined
  if (!slug) return { data: undefined, loading: false, error: 'not-found' as const }
  if (cached) return { data: cached, loading: false, error: undefined }
  if (state.slug !== slug) return { data: undefined, loading: true, error: undefined }
  return { data: state.data, loading: !state.data && !state.error, error: state.error }
}
