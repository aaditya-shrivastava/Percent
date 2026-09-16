import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { Archive, BarChart3, ChevronLeft, ChevronRight, FileText, Globe, Home, Image, LayoutPanelTop, LayoutTemplate, LogOut, Menu, Package, Palette, PanelBottom, Pencil, ReceiptText, Settings, Share2, Tag, Type, UserCog, Users, X, MessageSquare } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AdminIdentity } from './AdminRouteGuard'
import { usePercentSession } from '../../hooks/usePercentSession'

const primary: { path: string; label: string; icon: LucideIcon }[] = [
  {path:'/admin',label:'Dashboard',icon:Home}, {path:'/admin/products',label:'Products',icon:Package},
  {path:'/admin/inventory',label:'Inventory',icon:Archive}, {path:'/admin/orders',label:'Orders',icon:ReceiptText},
  {path:'/admin/customers',label:'Customers',icon:Users}, {path:'/admin/reviews',label:'Reviews',icon:MessageSquare},
  {path:'/admin/website',label:'Website Editor',icon:Pencil}, {path:'/admin/blog',label:'Blog & Content',icon:FileText},
  {path:'/admin/coupons',label:'Coupons',icon:Tag}, {path:'/admin/analytics',label:'Analytics',icon:BarChart3},
  {path:'/admin/users',label:'Admin Users',icon:UserCog}, {path:'/admin/settings',label:'Settings',icon:Settings},
]
const globalItems: { section: string; label: string; icon: LucideIcon }[] = [
  {section:'navbar',label:'Navbar',icon:LayoutPanelTop}, {section:'footer',label:'Footer',icon:PanelBottom},
  {section:'branding',label:'Branding',icon:LayoutTemplate}, {section:'colors',label:'Colors',icon:Palette},
  {section:'typography',label:'Typography',icon:Type}, {section:'social-links',label:'Social Links',icon:Share2},
]

function Brand() { return <span className="admin-brand"><span className="admin-brand-symbol" aria-hidden="true"><i/><i/></span><strong>Percent</strong></span> }

function AdminSidebar({ identity, onNavigate, onToggle, collapsed, mobile = false }: {identity: AdminIdentity; onNavigate?: () => void; onToggle?: () => void; collapsed?: boolean; mobile?: boolean}) {
  const { search, pathname } = useLocation()
  const { logout } = usePercentSession()
  const [logoutError, setLogoutError] = useState(false)
  const section = new URLSearchParams(search).get('section')
  const name = identity.user.displayName
  const initials = name.split(/\s+/).slice(0,2).map(n=>n[0]).join('')
  return <>
    <div className="admin-sidebar-brand"><Link to="/admin" onClick={onNavigate} aria-label="Percent admin dashboard"><Brand/></Link>{mobile && <button className="admin-icon-button" onClick={onNavigate} aria-label="Close navigation"><X/></button>}</div>
    <nav className="admin-navigation" aria-label="Admin navigation">
      {primary.map(({path,label,icon:Icon})=><NavLink key={path} to={path} end={path==='/admin'} title={label} onClick={onNavigate} className={({isActive})=>`admin-nav-link ${isActive && !(path==='/admin/website'&&section)?'is-active':''}`}><Icon/><span>{label}</span></NavLink>)}
      <div className="admin-nav-divider"/>
      <p className="admin-nav-group"><Globe/><span>Global</span></p>
      {globalItems.map(({section:item,label,icon:Icon})=><Link key={item} to={`/admin/website?section=${item}`} title={label} onClick={onNavigate} aria-current={pathname==='/admin/website'&&section===item?'page':undefined} className={`admin-nav-link admin-nav-sub ${pathname==='/admin/website'&&section===item?'is-active':''}`}><Icon/><span>{label}</span></Link>)}
      <NavLink to="/admin/media" title="Media Library" onClick={onNavigate} className={({isActive})=>`admin-nav-link ${isActive?'is-active':''}`}><Image/><span>Media Library</span></NavLink>
    </nav>
    <div className="admin-sidebar-bottom">
      <div className="admin-user"><span className="admin-avatar" aria-hidden="true">{initials}</span><div><strong>{name}</strong><span>{identity.role==='super_admin'?'Super Admin':'Admin'}</span></div><button className="admin-icon-button" aria-label="Sign out" title="Sign out" onClick={()=>{void logout().catch(()=>setLogoutError(true))}}><LogOut/></button></div>
      {logoutError&&<p role="alert">Unable to sign out. Please retry.</p>}
      <div className="admin-sidebar-footer"><Link to="/" title="Visit storefront"><Brand/></Link><small>Admin Panel</small>{onToggle&&<button className="admin-icon-button" onClick={onToggle} aria-label={collapsed?'Expand sidebar':'Collapse sidebar'} aria-expanded={!collapsed}>{collapsed?<ChevronRight/>:<ChevronLeft/>}</button>}</div>
    </div>
  </>
}

export function AdminShell() {
  const identity = useOutletContext<AdminIdentity>()
  const [collapsed,setCollapsed]=useState(()=>window.matchMedia('(max-width:1100px)').matches)
  const dialog=useRef<HTMLDialogElement>(null)
  useEffect(()=>{
    const media=window.matchMedia('(max-width:1100px)')
    const update=()=>{setCollapsed(media.matches);if(window.innerWidth>700)dialog.current?.close()}
    media.addEventListener('change',update)
    const mobile=window.matchMedia('(max-width:700px)')
    const closeDrawer=()=>{if(!mobile.matches)dialog.current?.close()}
    mobile.addEventListener('change',closeDrawer)
    return()=>{media.removeEventListener('change',update);mobile.removeEventListener('change',closeDrawer)}
  },[])
  return <div className={`percent-admin admin-shell ${collapsed?'is-collapsed':''}`}>
    <a className="admin-skip-link" href="#admin-workspace">Skip to workspace</a>
    <aside className="admin-sidebar"><AdminSidebar identity={identity} collapsed={collapsed} onToggle={()=>setCollapsed(value=>!value)}/></aside>
    <dialog ref={dialog} className="admin-drawer" aria-label="Admin navigation" onKeyDown={e=>{
      if(e.key!=='Tab')return
      const items=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)')).filter(item=>item.getClientRects().length)
      const first=items[0],last=items[items.length-1]
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}
    }} onClick={e=>{if(e.target===e.currentTarget)dialog.current?.close()}}><div className="admin-drawer-content"><AdminSidebar identity={identity} mobile onNavigate={()=>dialog.current?.close()}/></div></dialog>
    <div className="admin-workspace">
      <div className="admin-mobile-header"><button className="admin-icon-button" aria-label="Open admin navigation" onClick={()=>dialog.current?.showModal()}><Menu/></button><Brand/><span>Admin</span></div>
      <main id="admin-workspace" tabIndex={-1}><Outlet context={identity}/></main>
      <footer className="admin-workspace-footer">Built for today. Ready for what’s next.</footer>
    </div>
  </div>
}
