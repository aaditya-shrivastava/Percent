import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildShopApiParams, fetchShopProducts, subscribeToShopChanges, type ShopQuery, type ShopResponse } from '../data/shop'

const shopCache = new Map<string, ShopResponse>()

export function useShopProducts(query: ShopQuery) {
  const queryKey = useMemo(() => buildShopApiParams(query).toString(), [query])
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [state, setState] = useState<{ key: string; data?: ShopResponse; fetching: boolean; error: boolean }>(() => ({ key: queryKey, data: shopCache.get(queryKey), fetching: true, error: false }))
  const retry = useCallback(() => { setState((current) => ({ ...current, fetching: true, error: false })); setRefreshVersion((version) => version + 1) }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchShopProducts(query, controller.signal).then((data) => {
      shopCache.set(queryKey, data)
      setState({ key: queryKey, data, fetching: false, error: false })
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setState((current) => ({ ...current, key: queryKey, fetching: false, error: true }))
      if (import.meta.env.DEV) console.error('Unable to load public shop products', error)
    })
    return () => controller.abort()
  }, [query, queryKey, refreshVersion])

  useEffect(() => {
    const refresh = () => { shopCache.clear(); retry() }
    const unsubscribe = subscribeToShopChanges(refresh)
    window.addEventListener('focus', refresh)
    return () => { unsubscribe(); window.removeEventListener('focus', refresh) }
  }, [retry])

  const cached = shopCache.get(queryKey)
  const data = state.key === queryKey ? state.data : cached ?? state.data
  const fetching = state.key === queryKey ? state.fetching : true
  return { data, loading: fetching && !data, refetching: fetching && Boolean(data), error: state.key === queryKey && state.error, retry }
}
