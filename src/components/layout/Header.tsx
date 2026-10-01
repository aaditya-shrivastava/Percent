import { Menu, Search, ShoppingBag, Sparkle, UserRound, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { navigation, shopNavigationItems } from '../../data/homepage'
import { useCartCount } from '../../hooks/useCommerce'
import { usePercentSession } from '../../hooks/usePercentSession'
import { useWebsiteContent } from './WebsiteContentContext'

function RunningTrolleyIcon() {
  return <svg className="running-trolley" viewBox="0 0 28 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 7h4l2.1 9.2h11.7l2.4-7.1H8" /><path d="M15.5 7h6M17.5 4.5h4" /><circle cx="10" cy="20" r="1.45" /><circle cx="18.5" cy="20" r="1.45" /></svg>
}

function CollectionDropdown({label}:{label:string}) {
  const [open, setOpen] = useState(false)
  const links = useRef<Array<HTMLAnchorElement | null>>([])
  const moveFocus = (index: number) => links.current[(index + shopNavigationItems.length) % shopNavigationItems.length]?.focus()

  return <div className="collection-dropdown" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
    <button className="collection-trigger icon-button" aria-label={label} title={label} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((value) => !value)} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); requestAnimationFrame(() => moveFocus(0)) } }}><RunningTrolleyIcon /></button>
    <div className={`collection-menu ${open ? 'is-open' : ''}`} role="menu" aria-label={`${label} categories`}>{shopNavigationItems.map((item, index) => <Link key={item.id} ref={(element) => { links.current[index] = element }} role="menuitem" to={item.href} onClick={() => setOpen(false)} onKeyDown={(event) => { if (event.key === 'Escape') { setOpen(false); event.currentTarget.closest('.collection-dropdown')?.querySelector<HTMLButtonElement>('button')?.focus() } if (event.key === 'ArrowDown') { event.preventDefault(); moveFocus(index + 1) } if (event.key === 'ArrowUp') { event.preventDefault(); moveFocus(index - 1) } }}>{item.label}</Link>)}</div>
  </div>
}

function MobileCollectionMenu({ onNavigate,label }: { onNavigate: () => void;label:string }) {
  const [open, setOpen] = useState(false)
  const navigate = () => { setOpen(false); onNavigate() }
  return <div className="mobile-collection"><button aria-expanded={open} aria-controls="mobile-collection-links" onClick={() => setOpen((value) => !value)}>{label} <span className="mobile-collection-indicator" aria-hidden="true">{open ? '−' : '+'}</span></button><div id="mobile-collection-links" className={open ? 'is-open' : ''}>{shopNavigationItems.map((item) => <Link key={item.id} to={item.href} onClick={navigate}>{item.label}</Link>)}</div></div>
}

export function Header() {
  const { document } = useWebsiteContent()
  const [scrolled, setScrolled] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInput = useRef<HTMLInputElement>(null)
  const menuTrigger = useRef<HTMLButtonElement>(null)
  const menuPopover = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const locationKey = `${location.pathname}${location.search}`
  const [searchState, setSearchState] = useState({ open: false, locationKey })
  const searchOpen = searchState.open && searchState.locationKey === locationKey
  const cartCount = useCartCount()
  const { isAuthenticated } = usePercentSession()
  const [menuState, setMenuState] = useState({ open: false, pathname: location.pathname })
  const menuOpen = menuState.open && menuState.pathname === location.pathname
  const closeMenu = () => setMenuState({ open: false, pathname: location.pathname })
  const closeMenuAfterNavigation = () => { closeMenu(); window.scrollTo({ top: 0, behavior: 'auto' }) }
  const toggleMenu = () => setMenuState((current) => ({ open: current.pathname === location.pathname ? !current.open : true, pathname: location.pathname }))
  const managedItems = document.settings.navbar_items.map(item=>({id:item.id,label:item.label,href:item.path,active:item.enabled,displayOrder:item.sort_order}))
  const items = (managedItems.length?managedItems:navigation).filter((item) => item.active).sort((first, second) => first.displayOrder - second.displayOrder)
  const brand=document.settings.branding
  const collectionLabel=items.find(item=>item.id==='collection')?.label??'Collection'
  const closeSearch = () => setSearchState({ open: false, locationKey })
  const openSearch = () => { closeMenu(); setSearchState({ open: true, locationKey }) }
  const submitSearch = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const query = searchQuery.trim(); closeSearch(); navigate(query ? `/search?q=${encodeURIComponent(query)}` : '/search') }

  useEffect(() => { const updateScrolled = () => setScrolled((value) => { const nextValue = window.scrollY > 16; return value === nextValue ? value : nextValue }); updateScrolled(); window.addEventListener('scroll', updateScrolled, { passive: true }); return () => window.removeEventListener('scroll', updateScrolled) }, [])
  useEffect(() => { if (!searchOpen) return undefined; const frame = requestAnimationFrame(() => searchInput.current?.focus()); return () => cancelAnimationFrame(frame) }, [searchOpen])
  useEffect(() => { if (!menuOpen) return undefined; requestAnimationFrame(() => menuPopover.current?.querySelector<HTMLButtonElement | HTMLAnchorElement>('button,a')?.focus()); const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuState({ open: false, pathname: location.pathname }); requestAnimationFrame(() => menuTrigger.current?.focus()) } }; window.addEventListener('keydown', closeOnEscape); return () => window.removeEventListener('keydown', closeOnEscape) }, [location.pathname, menuOpen])

  return <header className={`site-header ${scrolled ? 'is-scrolled' : ''}`}>
    <div className="main-nav">
      <nav className="desktop-links" aria-label="Primary navigation">{items.some(item=>item.id==='collection')&&<CollectionDropdown label={collectionLabel}/>} {items.filter((item) => item.id !== 'collection').map((item) => <Link className="icon-button nav-icon" key={item.id} to={item.href} aria-label={item.label} title={item.label} data-tooltip={item.label}><Sparkle size={22} strokeWidth={1.8} aria-hidden="true" /></Link>)}</nav>
      <button ref={menuTrigger} className={`mobile-menu-trigger icon-button ${menuOpen ? 'is-open' : ''}`} aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen} aria-controls="mobile-navigation-menu" onClick={toggleMenu}><span className="mobile-menu-glyph" aria-hidden="true"><Menu className="mobile-menu-open-icon" /><X className="mobile-menu-close-icon" /></span></button>
      <Link className="wordmark" to="/" aria-label="Percent home">{brand.logo_url?<img src={brand.logo_url} alt={brand.logo_alt??brand.display_name} width={brand.logo_width??undefined} height={brand.logo_height??undefined}/>:<strong>{brand.display_name}</strong>}<small>{brand.tagline}</small></Link>
      <nav className="header-actions" aria-label="Customer actions"><button className="icon-button" type="button" aria-label="Search Percent" aria-expanded={searchOpen} aria-controls="header-search-panel" onClick={openSearch}><Search /></button><Link className="icon-button" to={isAuthenticated ? '/profile' : '/login'} aria-label="Profile"><UserRound /></Link><Link className="icon-button cart-action" to="/cart" aria-label="Cart" title="Cart"><ShoppingBag />{cartCount > 0 && <span aria-hidden="true">{Math.min(cartCount, 99)}</span>}</Link></nav>
    </div>
    <div id="header-search-panel" className={`header-search-panel ${searchOpen ? 'is-open' : ''}`} aria-hidden={!searchOpen} onKeyDown={(event) => { if (event.key === 'Escape') closeSearch() }}>{searchOpen && <form onSubmit={submitSearch}><label className="sr-only" htmlFor="header-search-input">Search Percent</label><Search aria-hidden="true" /><input ref={searchInput} id="header-search-input" type="search" autoComplete="off" placeholder="Search products and stories..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} autoFocus /><button type="submit">Search <ArrowRightIcon /></button><button className="header-search-close" type="button" aria-label="Close search" onClick={closeSearch}><X /></button></form>}</div>
    <button className={`mobile-menu-backdrop ${menuOpen ? 'is-open' : ''}`} aria-label="Dismiss navigation menu" tabIndex={-1} onClick={closeMenu} />
    <div ref={menuPopover} id="mobile-navigation-menu" className={`mobile-menu-popover ${menuOpen ? 'is-open' : ''}`} aria-hidden={!menuOpen}>
      <nav aria-label="Mobile primary navigation">{items.some(item=>item.id==='collection')&&<MobileCollectionMenu label={collectionLabel} onNavigate={closeMenuAfterNavigation} />}{items.filter((item) => item.id !== 'collection').map((item) => <Link key={item.id} to={item.href} onClick={closeMenuAfterNavigation}>{item.label}</Link>)}</nav>
    </div>
  </header>
}

function ArrowRightIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg> }
