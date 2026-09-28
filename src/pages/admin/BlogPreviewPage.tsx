import { useEffect, useState, type MouseEvent } from 'react'
import { Header } from '../../components/layout/Header'
import { Footer } from '../../components/layout/Footer'
import { BlogDetailContent } from '../BlogDetailPage'
import { blogArticles } from '../../data/blog'
import { signBlogImages, toBlogArticle, type BlogDocument } from '../../backend/admin/blog'
import { getAdminAccess } from '../../backend/admin/role'
import { usePercentSession } from '../../hooks/usePercentSession'
import './website-preview.css'

export default function BlogPreviewPage() {
  const { user, loading } = usePercentSession()
  const [authorizedUserId, setAuthorizedUserId] = useState<string>(), [document, setDocument] = useState<BlogDocument>(), [signed, setSigned] = useState<BlogDocument['images']>([])
  const authorized = Boolean(user && authorizedUserId === user.id)
  useEffect(() => {
    if (loading || !user) return
    let active = true
    getAdminAccess(user.id).then(access => { if (active && access.status === 'allowed') setAuthorizedUserId(user.id) })
    return () => { active = false }
  }, [loading, user])
  useEffect(() => {
    if (!authorized) return
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.type !== 'percent-blog-preview-draft') return
      const incoming = event.data.article as BlogDocument
      if (!incoming || !Array.isArray(incoming.sections) || !Array.isArray(incoming.images)) return
      setDocument(incoming)
      if (incoming.id) signBlogImages(incoming.id, incoming.images, true).then(setSigned).catch(() => setSigned(incoming.images))
      else setSigned(incoming.images)
    }
    window.addEventListener('message', receive)
    window.parent.postMessage({ type: 'percent-blog-preview-ready' }, window.location.origin)
    return () => window.removeEventListener('message', receive)
  }, [authorized])
  const contain = (event: MouseEvent<HTMLDivElement>) => { if ((event.target as HTMLElement).closest('a')) event.preventDefault() }
  if (!authorized) return <main className="blog-preview-pending" role="status">Checking preview access…</main>
  if (!document) return <main className="blog-preview-pending" role="status">Preparing article preview…</main>
  const article = toBlogArticle(document, signed)
  return <div className="website-storefront-preview" onClickCapture={contain}><Header/><BlogDetailContent article={article} articles={[article, ...blogArticles.filter(item => item.slug !== article.slug)]}/><Footer/></div>
}
