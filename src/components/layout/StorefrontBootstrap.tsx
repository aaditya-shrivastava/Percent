import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { loadCatalog, hostedProducts, hostedBlogs } from '../../backend/catalog'
import { hydrateHomepage } from '../../data/homepage'
import { hydrateBlogs } from '../../data/blog'

let status: 'idle' | 'loading' | 'ready' | 'error' = 'idle'
let refreshTimer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()
const subscribe = (fn:()=>void) => { listeners.add(fn); return()=>{listeners.delete(fn)} }
const notify = () => listeners.forEach(fn=>fn())
async function start(force=false) {
  if(status==='loading'||(status==='ready'&&!force))return
  if(refreshTimer)clearTimeout(refreshTimer)
  status='loading';notify()
  try { await loadCatalog();hydrateHomepage(hostedProducts.filter(p=>p.active));hydrateBlogs(hostedBlogs);status='ready';refreshTimer=setTimeout(()=>void start(true),50*60*1000) }
  catch { status='error' }
  notify()
}

// Preserve storefront loading behavior without making admin authentication depend
// on successful public catalog or media requests.
export function StorefrontBootstrap({children}:{children:ReactNode}) {
  const current=useSyncExternalStore(subscribe,()=>status)
  useEffect(()=>{void start()},[])
  if(current==='ready')return children
  if(current==='error')return <main role="alert" style={{padding:48}}><h1>Percent is temporarily unavailable</h1><p>We could not load the collection. Please try again.</p><button onClick={()=>void start()}>Retry</button></main>
  return <main role="status" style={{padding:48}}>Loading Percent…</main>
}
