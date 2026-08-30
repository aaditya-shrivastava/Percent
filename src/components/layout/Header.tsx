import { Menu, Search, ShoppingBag, Sparkle, UserRound, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { collectionItems, navigation } from '../../data/homepage'

function RunningTrolleyIcon() {
  return <svg className="running-trolley" viewBox="0 0 28 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 7h4l2.1 9.2h11.7l2.4-7.1H8" /><path d="M15.5 7h6M17.5 4.5h4" /><circle cx="10" cy="20" r="1.45" /><circle cx="18.5" cy="20" r="1.45" /></svg>
}

function CollectionDropdown() {
  const [open, setOpen] = useState(false)
  const links = useRef<Array<HTMLAnchorElement | null>>([])
  const moveFocus = (index: number) => links.current[(index + collectionItems.length) % collectionItems.length]?.focus()

  return <div className="collection-dropdown" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
    <button className="collection-trigger icon-button" aria-label="Collection" title="Collection" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((value) => !value)} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); requestAnimationFrame(() => moveFocus(0)) } }}><RunningTrolleyIcon /></button>
    <div className={`collection-menu ${open ? 'is-open' : ''}`} role="menu" aria-label="Collection categories">{collectionItems.map((item, index) => <Link key={item.id} ref={(element) => { links.current[index] = element }} role="menuitem" to={item.href} onClick={() => setOpen(false)} onKeyDown={(event) => { if (event.key === 'Escape') { setOpen(false); event.currentTarget.closest('.collection-dropdown')?.querySelector<HTMLButtonElement>('button')?.focus() } if (event.key === 'ArrowDown') { event.preventDefault(); moveFocus(index + 1) } if (event.key === 'ArrowUp') { event.preventDefault(); moveFocus(index - 1) } }}>{item.label}</Link>)}</div>
  </div>
}

function MobileCollectionMenu({ onNavigate }: { onNavigate: () => void }) {
  const [open, setOpen] = useState(false)
  return <div className="mobile-collection"><button aria-expanded={open} aria-controls="mobile-collection-links" onClick={() => setOpen((value) => !value)}>Collection <span className="mobile-collection-indicator" aria-hidden="true">{open ? '−' : '+'}</span></button><div id="mobile-collection-links" className={open ? 'is-open' : ''}>{collectionItems.map((item) => <Link key={item.id} to={item.href} onClick={onNavigate}>{item.label}</Link>)}</div></div>
}

export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const menuTrigger = useRef<HTMLButtonElement>(null)
  const menuPopover = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const [menuState, setMenuState] = useState({ open: false, pathname: location.pathname })
  const menuOpen = menuState.open && menuState.pathname === location.pathname
  const closeMenu = () => setMenuState({ open: false, pathname: location.pathname })
  const toggleMenu = () => setMenuState((current) => ({ open: current.pathname === location.pathname ? !current.open : true, pathname: location.pathname }))
  const items = navigation.filter((item) => item.active).sort((first, second) => first.displayOrder - second.displayOrder)

  useEffect(() => { const updateScrolled = () => setScrolled((value) => { const nextValue = window.scrollY > 16; return value === nextValue ? value : nextValue }); updateScrolled(); window.addEventListener('scroll', updateScrolled, { passive: true }); return () => window.removeEventListener('scroll', updateScrolled) }, [])
  useEffect(() => { if (!menuOpen) return undefined; requestAnimationFrame(() => menuPopover.current?.querySelector<HTMLButtonElement | HTMLAnchorElement>('button,a')?.focus()); const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuState({ open: false, pathname: location.pathname }); requestAnimationFrame(() => menuTrigger.current?.focus()) } }; window.addEventListener('keydown', closeOnEscape); return () => window.removeEventListener('keydown', closeOnEscape) }, [location.pathname, menuOpen])

  return <header className={`site-header ${scrolled ? 'is-scrolled' : ''}`}>
    <div className="main-nav">
      <nav className="desktop-links" aria-label="Primary navigation"><CollectionDropdown />{items.filter((item) => item.id !== 'collection').map((item) => <Link className="icon-button nav-icon" key={item.id} to={item.href} aria-label={item.label} title={item.label} data-tooltip={item.label}><Sparkle size={22} strokeWidth={1.8} aria-hidden="true" /></Link>)}</nav>
      <button ref={menuTrigger} className={`mobile-menu-trigger icon-button ${menuOpen ? 'is-open' : ''}`} aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen} aria-controls="mobile-navigation-menu" onClick={toggleMenu}><span className="mobile-menu-glyph" aria-hidden="true"><Menu className="mobile-menu-open-icon" /><X className="mobile-menu-close-icon" /></span></button>
      <Link className="wordmark" to="/" aria-label="Percent home"><strong>% PERCENT</strong><small>LESS ORDINARY. MORE YOU.</small></Link>
      <nav className="header-actions" aria-label="Customer actions"><Link className="icon-button" to="/collection" aria-label="Search collection"><Search /></Link><Link className="icon-button" to="/profile" aria-label="Profile"><UserRound /></Link><Link className="icon-button" to="/cart" aria-label="Shopping bag"><ShoppingBag /></Link></nav>
    </div>
    <button className={`mobile-menu-backdrop ${menuOpen ? 'is-open' : ''}`} aria-label="Dismiss navigation menu" tabIndex={-1} onClick={closeMenu} />
    <div ref={menuPopover} id="mobile-navigation-menu" className={`mobile-menu-popover ${menuOpen ? 'is-open' : ''}`} aria-hidden={!menuOpen}>
      <nav aria-label="Mobile primary navigation"><MobileCollectionMenu onNavigate={closeMenu} />{items.filter((item) => item.id !== 'collection').map((item) => <Link key={item.id} to={item.href} onClick={closeMenu}>{item.label}</Link>)}</nav>
    </div>
  </header>
}
