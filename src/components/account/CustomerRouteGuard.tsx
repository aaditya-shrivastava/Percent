import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { authRouteWithReturnTo } from '../../data/auth'
import { usePercentSession } from '../../hooks/usePercentSession'

export function CustomerRouteGuard() {
  const session = usePercentSession()
  const location = useLocation()
  if (session.loading) return <main className="account-page" aria-busy="true" role="status">Verifying your Percent account…</main>
  if (!session.isAuthenticated || !session.percentUserId || session.user?.id !== session.percentUserId) {
    return <Navigate replace to={authRouteWithReturnTo('/login', location.pathname + location.search + location.hash)} />
  }
  if (!session.isCustomer) return <main className="account-page"><p role="alert">This staff account has no customer activity.</p><Link to="/admin">Go to Admin</Link> · <Link to="/shop">Browse the collection</Link></main>
  return <Outlet key={session.percentUserId} />
}
