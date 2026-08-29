import { Route, Routes } from 'react-router-dom'
import { Footer } from './components/layout/Footer'
import { Header } from './components/layout/Header'
import { ComingSoonPage } from './pages/ComingSoonPage'
import { HomePage } from './pages/HomePage'

export default function App() { return <><Header /><Routes><Route path="/" element={<HomePage />} />{['/collection', '/collection/limited', '/collection/regular', '/collection/sold-out', '/product/:slug', '/design/:slug', '/contact', '/about', '/blog', '/profile', '/cart'].map((path) => <Route key={path} path={path} element={<ComingSoonPage />} />)}<Route path="*" element={<ComingSoonPage />} /></Routes><Footer /></> }
