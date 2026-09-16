import { ArrowRight, Heart, House, LogOut, Package, UserRound } from 'lucide-react'
import { type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { demoMemberSince, getAccountOrders } from '../../data/account'
import { authRouteWithReturnTo, getSafeAuthReturnTo } from '../../data/auth'
import { usePercentSession } from '../../hooks/usePercentSession'

const accountNavigation = [
  { label: 'Profile', href: '/profile', icon: UserRound },
  { label: 'My Orders', href: '/profile/orders', icon: Package },
  { label: 'My Address', href: '/profile/address', icon: House },
  { label: 'Wishlist', href: '/profile/wishlist', icon: Heart },
]

const activeAccountPath = (pathname: string) => pathname.startsWith('/orders/') ? '/profile/orders' : accountNavigation.find((item) => item.href === pathname)?.href ?? '/profile'

export function AccountShell({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, logout, loading } = usePercentSession()
  const location = useLocation()
  const navigate = useNavigate()
  const displayName = user?.displayName ?? 'Demo Member'
  const currentPath = activeAccountPath(location.pathname)
  const requestedReturnTo = new URLSearchParams(location.search).get('returnTo')
  const safeReturnTo = getSafeAuthReturnTo(requestedReturnTo, location.pathname)
  const signOut = async () => { await logout(); navigate('/', { replace: true }) }

  if (loading) return <main className="account-page" role="status">Loading your account…</main>
  if (!isAuthenticated) return <main className="account-page account-signed-out"><section><p>Percent Account</p><h1>Sign In Required.</h1><span>Sign in through the existing Percent account flow to access your profile.</span><Link to={authRouteWithReturnTo('/login', safeReturnTo)}>Sign In <ArrowRight /></Link></section></main>

  return <main className="account-page">
    <div className="account-layout">
      <aside className="account-sidebar" aria-label="Account navigation">
        <div className="account-member"><span aria-hidden="true">{displayName.charAt(0).toUpperCase()}</span><div><strong>{displayName}</strong><small>Percent Member</small></div><dl><div><dt>Orders</dt><dd>{getAccountOrders().length}</dd></div><div><dt>Member since</dt><dd>{user?.memberSince ?? demoMemberSince}</dd></div></dl></div>
        <nav>{accountNavigation.map(({ label, href, icon: Icon }) => <NavLink key={href} to={href} end={href === '/profile'} className={({ isActive }) => isActive || (href === '/profile/orders' && location.pathname.startsWith('/orders/')) ? 'is-active' : ''}><Icon /><span>{label}</span></NavLink>)}<button type="button" onClick={signOut}><LogOut /><span>Logout</span></button></nav>
      </aside>

      <div className="account-mobile-navigation"><label htmlFor="account-section">Account</label><div><select id="account-section" value={currentPath} onChange={(event) => navigate(event.target.value)}>{accountNavigation.map((item) => <option key={item.href} value={item.href}>{item.label}</option>)}</select><button type="button" onClick={signOut}><LogOut /> Logout</button></div></div>
      <section className="account-content">{children}</section>
    </div>
  </main>
}
