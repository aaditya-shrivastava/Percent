import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { LockKeyhole, ShieldCheck } from 'lucide-react'
import { authRouteWithReturnTo } from '../../data/auth'
import { useAdminAccess } from '../../hooks/useAdminAccess'
import type { AdminRole } from '../../backend/admin/access'
import type { PercentSessionUser } from '../../hooks/usePercentSession'

export interface AdminIdentity { user: PercentSessionUser; role: AdminRole }

export function AdminRouteGuard() {
  const { access, user, retry } = useAdminAccess()
  const location = useLocation()
  if (access.status === 'unauthenticated') return <Navigate replace to={authRouteWithReturnTo('/login', location.pathname + location.search + location.hash)} />
  if (access.status === 'loading') return <main className="percent-admin admin-gate" aria-busy="true"><ShieldCheck /><p role="status">Verifying admin access…</p></main>
  if (access.status === 'error') return <main className="percent-admin admin-gate"><LockKeyhole /><h1>Unable to verify access.</h1><p role="alert">Please try again.</p><button onClick={retry}>Retry</button><Link to="/">Return to store</Link></main>
  if (access.status !== 'allowed' || !user) return <main className="percent-admin admin-gate"><LockKeyhole /><h1>Access denied.</h1><p>Your account does not have access to the Percent Admin Panel.</p><Link to="/">Return to store</Link></main>
  return <Outlet context={{ user, role: access.role } satisfies AdminIdentity} />
}
