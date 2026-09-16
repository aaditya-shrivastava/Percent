import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getAdminAccess } from '../backend/admin/role'
import type { AdminAccess } from '../backend/admin/access'
import { usePercentSession } from './usePercentSession'

export function useAdminAccess() {
  const { user, loading } = usePercentSession()
  const { key } = useLocation()
  const [revision, setRevision] = useState(0)
  const [resolved, setResolved] = useState<{ user: typeof user; key: string; revision: number; access: AdminAccess }>()
  const retry = useCallback(() => setRevision(value => value + 1), [])

  useEffect(() => {
    if (loading || !user) return
    let active = true
    void getAdminAccess(user.id).then(access => {
      if (active) setResolved({ user, key, revision, access })
    })
    return () => { active = false }
  }, [user, loading, key, revision])

  useEffect(() => {
    const visible = () => { if (document.visibilityState === 'visible') retry() }
    window.addEventListener('focus', retry)
    document.addEventListener('visibilitychange', visible)
    // Existing RLS enforces revocation on every request; periodically refresh UI too.
    const timer = window.setInterval(retry, 60_000)
    return () => { window.removeEventListener('focus', retry); document.removeEventListener('visibilitychange', visible); window.clearInterval(timer) }
  }, [retry])

  if (loading) return { access: { status: 'loading' as const }, user, retry }
  if (!user) return { access: { status: 'unauthenticated' as const }, user, retry }
  if (resolved?.user !== user || resolved.key !== key || (resolved.revision !== revision && resolved.access.status !== 'allowed')) return { access: { status: 'loading' as const }, user, retry }
  return { access: resolved.access, user, retry }
}
