import { Route, Routes } from 'react-router-dom'
import { Footer } from './components/layout/Footer'
import { Header } from './components/layout/Header'
import { ComingSoonPage } from './pages/ComingSoonPage'
import { HomePage } from './pages/HomePage'
import { ShopPage } from './pages/ShopPage'

export default function App() { return <><Header /><Routes><Route path="/" element={<HomePage />} /><Route path="/shop" element={<ShopPage />} /><Route path="/collection" element={<ShopPage />} />{['/collection/limited', '/collection/regular', '/collection/trending', '/collection/sold-out', '/product/:slug', '/products/:slug', '/design/:slug', '/contact', '/about', '/blog', '/profile', '/cart', '/privacy', '/terms'].map((path) => <Route key={path} path={path} element={<ComingSoonPage />} />)}<Route path="*" element={<ComingSoonPage />} /></Routes><Footer /></> }
