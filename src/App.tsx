import { useEffect, useRef } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigationType } from 'react-router-dom'
import { Footer } from './components/layout/Footer'
import { Header } from './components/layout/Header'
import { ComingSoonPage } from './pages/ComingSoonPage'
import { HomePage } from './pages/HomePage'
import { ShopPage } from './pages/ShopPage'
import { ProductDetailsPage } from './pages/ProductDetailsPage'
import { SoldOutDesignsPage } from './pages/SoldOutDesignsPage'

function ScrollToTop() {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()
  const previousPathname = useRef(pathname)
  useEffect(() => {
    const pathnameChanged = previousPathname.current !== pathname
    previousPathname.current = pathname
    if (pathnameChanged && navigationType !== 'POP') window.scrollTo({ top: 0, behavior: 'auto' })
  }, [navigationType, pathname])
  return null
}

export default function App() { return <><ScrollToTop /><Header /><Routes><Route path="/" element={<HomePage />} /><Route path="/shop" element={<ShopPage />} /><Route path="/sold-out-designs" element={<SoldOutDesignsPage />} /><Route path="/products/:slug" element={<ProductDetailsPage />} /><Route path="/product/:slug" element={<Navigate to="/shop" replace />} /><Route path="/collection" element={<Navigate to="/shop" replace />} /><Route path="/collection/limited" element={<Navigate to="/shop?tags=limited-edition" replace />} /><Route path="/collection/regular" element={<Navigate to="/shop?tags=best-seller" replace />} /><Route path="/collection/trending" element={<Navigate to="/shop?tags=trending" replace />} /><Route path="/collection/sold-out" element={<Navigate to="/sold-out-designs" replace />} />{['/design/:slug', '/contact', '/about', '/blog', '/profile', '/cart', '/privacy', '/terms'].map((path) => <Route key={path} path={path} element={<ComingSoonPage />} />)}<Route path="*" element={<ComingSoonPage />} /></Routes><Footer /></> }
