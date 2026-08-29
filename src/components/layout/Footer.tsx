import { Link } from 'react-router-dom'
import type { FooterGroup } from '../../types'

const footerGroups: FooterGroup[] = [
  { title: 'Collection', links: [{ label: 'Limited Editions', to: '/collection/limited' }, { label: 'Regular Editions', to: '/collection/regular' }, { label: 'Sold Out Designs', to: '/collection/sold-out' }, { label: 'All Products', to: '/collection' }] },
  { title: 'Company', links: [{ label: 'About Us', to: '/about' }, { label: 'Blogs', to: '/blog' }, { label: 'Contact', to: '/contact' }] },
  { title: 'Account', links: [{ label: 'Profile', to: '/profile' }, { label: 'Cart', to: '/cart' }] },
]

export function Footer() { return <footer className="site-footer"><div className="footer-main"><div className="footer-brand"><Link className="footer-wordmark" to="/" aria-label="Percent home">% PERCENT</Link><p>Less Ordinary. More You.</p><small>Limited pieces, made to be remembered.</small></div><div className="footer-groups">{footerGroups.map((group) => <nav key={group.title} aria-label={`${group.title} navigation`}><h2>{group.title}</h2>{group.links.map((link) => <Link key={link.to} to={link.to}>{link.label}</Link>)}</nav>)}</div></div><div className="footer-bottom"><small>© 2026 Percent. All rights reserved.</small><nav aria-label="Legal navigation"><Link to="/privacy">Privacy Policy</Link><Link to="/terms">Terms and Conditions</Link></nav></div></footer> }
