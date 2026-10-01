import { ExternalLink, Fingerprint, Globe2, LogOut, PackageCheck, ReceiptText, ShieldCheck, Tag, UserRoundCog } from 'lucide-react'
import { Link, useOutletContext } from 'react-router-dom'
import type { AdminIdentity } from '../../components/admin/AdminRouteGuard'
import { AdminPageHeader, AdminStatusBadge } from '../../components/admin/AdminComponents'
import { usePercentSession } from '../../hooks/usePercentSession'
import { ProductOptionsSettings } from './ProductOptionsSettings'
import './admin-users-settings.css'

const date = (value?: string) => value || 'Not available'

export function AdminSettings() {
  const identity = useOutletContext<AdminIdentity>()
  const session = usePercentSession()
  const provider = session.firebaseUser ? 'Firebase Authentication' : 'Supabase transition session'
  const logout = () => { void session.logout() }
  return <><AdminPageHeader title="Settings" description="Review your authenticated Admin session and navigate to the authoritative operational controls."/>
    <div className="settings-layout">
      <section className="admin-panel settings-section" aria-labelledby="settings-account"><header><span><UserRoundCog/></span><div><h2 id="settings-account">Account & Access</h2><p>Live details from the current verified Percent session.</p></div></header><dl className="settings-facts"><div><dt>Display name</dt><dd>{identity.user.displayName}</dd></div><div><dt>Contact email</dt><dd>{identity.user.email || 'No verified contact email'}</dd></div><div><dt>Percent role</dt><dd><AdminStatusBadge status={identity.role}/></dd></div><div><dt>Member since</dt><dd>{date(identity.user.memberSince)}</dd></div></dl><button className="admin-button settings-signout" onClick={logout}><LogOut/> Sign out</button></section>
      <section className="admin-panel settings-section" aria-labelledby="settings-security"><header><span><ShieldCheck/></span><div><h2 id="settings-security">Security & Identity</h2><p>Authorization remains separate from authentication credentials.</p></div></header><dl className="settings-facts"><div><dt>Authentication</dt><dd>{provider}</dd></div><div><dt>Session</dt><dd><span className="settings-live"><i/>Authenticated</span></dd></div><div><dt>Authorization source</dt><dd>Private Percent roles</dd></div><div><dt>Identity model</dt><dd>Internal Percent UUID</dd></div></dl><p className="settings-note"><Fingerprint/> Firebase claims, email addresses, browser storage, and usernames do not grant Admin authority.</p></section>
      <section className="admin-panel settings-section settings-wide" aria-labelledby="settings-operations"><header><span><PackageCheck/></span><div><h2 id="settings-operations">Operational Controls</h2><p>Each setting stays with the module that owns and enforces it.</p></div></header><div className="settings-links"><Link to="/admin/inventory"><PackageCheck/><span><strong>Inventory & production</strong><small>Production limits and stock remain product-specific.</small></span><ExternalLink/></Link><Link to="/admin/coupons"><Tag/><span><strong>Coupons</strong><small>Manage persisted discount rules and redemption limits.</small></span><ExternalLink/></Link><Link to="/admin/orders"><ReceiptText/><span><strong>Orders</strong><small>Review fulfillment and payment lifecycle state.</small></span><ExternalLink/></Link><Link to="/admin/website"><Globe2/><span><strong>Website Editor</strong><small>Storefront content and Global design controls remain here.</small></span><ExternalLink/></Link></div></section>
      <ProductOptionsSettings/>
    </div>
    <section className="settings-boundary" aria-label="Settings ownership"><ShieldCheck/><div><strong>Database-backed configuration only</strong><p>Product Options persist through authorized Percent RPCs. Storefront design controls remain in Website Editor, and no browser storage grants configuration authority.</p></div></section>
  </>
}
