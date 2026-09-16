import { StorefrontBootstrap } from './components/layout/StorefrontBootstrap'
import './admin.css'
import { lazy, Suspense, useEffect, useRef } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigationType } from 'react-router-dom'
import { Footer } from './components/layout/Footer'
import { Header } from './components/layout/Header'
import { ComingSoonPage } from './pages/ComingSoonPage'
import { HomePage } from './pages/HomePage'
import { ShopPage } from './pages/ShopPage'
import { ProductDetailsPage } from './pages/ProductDetailsPage'
import { SoldOutDesignsPage } from './pages/SoldOutDesignsPage'
import { CartPage } from './pages/CartPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { OrderConfirmationPage } from './pages/OrderConfirmationPage'
import { OrderDetailsPage, ProfileAddressPage, ProfileOrdersPage, ProfilePage, ProfileWishlistPage } from './pages/AccountPages'
import { TrackOrderPage } from './pages/TrackOrderPage'
import { AboutPage } from './pages/AboutPage'
import { BlogPage } from './pages/BlogPage'
import { BlogDetailPage } from './pages/BlogDetailPage'
import { ContactPage } from './pages/ContactPage'
import { FaqPage } from './pages/FaqPage'
import { SearchPage } from './pages/SearchPage'
import { PolicyPage } from './pages/PolicyPage'
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from './pages/AuthPages'

function ScrollToTop() {
  const { pathname, hash } = useLocation()
  const navigationType = useNavigationType()
  const previousPathname = useRef(pathname)
  useEffect(() => {
    const pathnameChanged = previousPathname.current !== pathname
    previousPathname.current = pathname
    if (hash) { const frame = requestAnimationFrame(() => document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'start' })); return () => cancelAnimationFrame(frame) }
    if (pathnameChanged && navigationType !== 'POP') window.scrollTo({ top: 0, behavior: 'auto' })
    return undefined
  }, [hash, navigationType, pathname])
  return null
}

function StorefrontApp() { return <><ScrollToTop /><Header /><Routes><Route path="/" element={<HomePage />} /><Route path="/shop" element={<ShopPage />} /><Route path="/search" element={<SearchPage />} /><Route path="/sold-out-designs" element={<SoldOutDesignsPage />} /><Route path="/cart" element={<CartPage />} /><Route path="/checkout" element={<CheckoutPage />} /><Route path="/order-confirmation" element={<OrderConfirmationPage />} /><Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} /><Route path="/reset-password" element={<ResetPasswordPage />} /><Route path="/forgot-password" element={<ForgotPasswordPage />} /><Route path="/profile" element={<ProfilePage />} /><Route path="/profile/orders" element={<ProfileOrdersPage />} /><Route path="/profile/address" element={<ProfileAddressPage />} /><Route path="/profile/wishlist" element={<ProfileWishlistPage />} /><Route path="/orders/:orderId/track" element={<TrackOrderPage />} /><Route path="/orders/:orderId" element={<OrderDetailsPage />} /><Route path="/products/:slug" element={<ProductDetailsPage />} /><Route path="/product/:slug" element={<Navigate to="/shop" replace />} /><Route path="/collection" element={<Navigate to="/shop" replace />} /><Route path="/collection/limited" element={<Navigate to="/shop?tags=limited-edition" replace />} /><Route path="/collection/regular" element={<Navigate to="/shop?tags=best-seller" replace />} /><Route path="/collection/trending" element={<Navigate to="/shop?tags=trending" replace />} /><Route path="/collection/sold-out" element={<Navigate to="/sold-out-designs" replace />} /><Route path="/about" element={<AboutPage />} /><Route path="/blog" element={<BlogPage />} /><Route path="/blog/:slug" element={<BlogDetailPage />} /><Route path="/contact" element={<ContactPage />} /><Route path="/faq" element={<FaqPage />} /><Route path="/policies/shipping" element={<PolicyPage policyId="shipping" />} /><Route path="/policies/returns" element={<PolicyPage policyId="returns" />} /><Route path="/policies/privacy" element={<PolicyPage policyId="privacy" />} /><Route path="/policies/terms" element={<PolicyPage policyId="terms" />} /><Route path="/privacy" element={<Navigate to="/policies/privacy" replace />} /><Route path="/terms" element={<Navigate to="/policies/terms" replace />} /><Route path="/design/:slug" element={<ComingSoonPage />} /><Route path="*" element={<ComingSoonPage />} /></Routes><Footer /></> }

const AdminRoutes=lazy(()=>import('./pages/admin/AdminRoutes'))
export default function App() {
 const {pathname}=useLocation()
 if(pathname==='/admin'||pathname.startsWith('/admin/'))return <Suspense fallback={<main className="percent-admin admin-gate" role="status">Loading admin…</main>}><AdminRoutes/></Suspense>
 return <StorefrontBootstrap><StorefrontApp/></StorefrontBootstrap>
}
