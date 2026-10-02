import { getPercentSessionSnapshot } from './percentSession'
import { authRouteWithReturnTo } from '../data/auth'

export function customerSessionId() {
  const session = getPercentSessionSnapshot()
  return !session.loading && session.authenticated && session.isCustomer && session.percentUserId && session.user?.id === session.percentUserId ? session.percentUserId : null
}

export function requireCustomerAction() {
  if (customerSessionId()) return true
  const session = getPercentSessionSnapshot()
  // A pending restoration must not turn into a premature sign-in redirect.
  if (session.loading) return false
  const returnTo = window.location.pathname + window.location.search + window.location.hash
  window.location.assign(session.authenticated ? '/admin' : authRouteWithReturnTo('/login', returnTo))
  return false
}
