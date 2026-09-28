import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { BookOpen, Plus, RefreshCw, Search } from 'lucide-react'
import type { AdminIdentity } from '../../components/admin/AdminRouteGuard'
import { AdminEmptyState, AdminPageHeader, AdminStatCard } from '../../components/admin/AdminComponents'
import { blogCategories, listBlogPosts, signBlogImages, type BlogSummary } from '../../backend/admin/blog'
import './blog.css'

const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value)) : '—'

export function AdminBlog() {
  const { user } = useOutletContext<AdminIdentity>()
  const [items, setItems] = useState<BlogSummary[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [revision, setRevision] = useState(0)
  const [search, setSearch] = useState(''), [category, setCategory] = useState('all'), [status, setStatus] = useState('all'), [sort, setSort] = useState('updated')
  useEffect(() => {
    let current = true
    listBlogPosts(user.id).then(async posts => {
      const decorated = await Promise.all(posts.map(async post => {
        if (!post.id || !post.image?.url) return post
        try { const [image] = await signBlogImages(post.id, [post.image], true); return { ...post, image } } catch { return post }
      }))
      if (current) { setItems(decorated); setLoading(false); setError('') }
    }).catch(() => { if (current) { setError('Articles could not be loaded.'); setLoading(false) } })
    return () => { current = false }
  }, [user.id, revision])
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return items.filter(item => (!query || [item.title, item.slug, item.category].some(value => value.toLowerCase().includes(query))) && (category === 'all' || item.category === category) && (status === 'all' || item.status === status)).sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : sort === 'oldest' ? new Date(a.updated_at ?? 0).getTime() - new Date(b.updated_at ?? 0).getTime() : new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime())
  }, [items, search, category, status, sort])
  return <>
    <AdminPageHeader title="Blog & Content" description="Create and manage stories for the Percent Journal." />
    <div className="admin-stats blog-stats"><AdminStatCard label="All Articles" value={String(items.length)} note="Draft and published" icon={BookOpen}/><AdminStatCard label="Drafts" value={String(items.filter(item => item.status === 'draft').length)} note="Not visible on the Journal" icon={BookOpen}/><AdminStatCard label="Published" value={String(items.filter(item => item.status === 'published').length)} note="Live stories" icon={BookOpen}/></div>
    <section className="admin-panel blog-list"><header><div><h2>Articles</h2><p>Editorial drafts stay private until you publish them.</p></div><div><button className="admin-icon-button" aria-label="Refresh articles" onClick={() => { setLoading(true); setRevision(value => value + 1) }}><RefreshCw/></button><Link className="admin-button blog-primary" to="/admin/blog/new"><Plus/> New Article</Link></div></header>
      <div className="blog-toolbar"><label className="blog-search"><Search/><span className="sr-only">Search articles</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search title, slug or category"/></label><label>Category<select value={category} onChange={event => setCategory(event.target.value)}><option value="all">All categories</option>{blogCategories.map(value => <option key={value}>{value}</option>)}</select></label><label>Status<select value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option><option value="draft">Draft</option><option value="published">Published</option></select></label><label>Sort<select value={sort} onChange={event => setSort(event.target.value)}><option value="updated">Recently updated</option><option value="oldest">Oldest updated</option><option value="title">Title A–Z</option></select></label></div>
      {loading ? <p className="blog-state" role="status">Loading articles…</p> : error ? <div className="blog-state" role="alert">{error}<button className="admin-button" onClick={() => { setLoading(true); setRevision(value => value + 1) }}>Retry</button></div> : filtered.length === 0 ? <AdminEmptyState icon={BookOpen} title={items.length ? 'No matching articles.' : 'No articles yet.'} description={items.length ? 'Try different filters.' : 'Start with a draft article.'}/> : <div className="blog-table-wrap" role="region" aria-label="Blog articles" tabIndex={0}><table><thead><tr><th scope="col">Article</th><th scope="col">Category</th><th scope="col">Status</th><th scope="col">Featured</th><th scope="col">Published</th><th scope="col">Updated</th><th scope="col">Action</th></tr></thead><tbody>{filtered.map(item => <tr key={item.id}><td><div className="blog-identity">{item.image?.preview || item.image?.url.startsWith('https://') ? <img src={item.image.preview ?? item.image.url} alt="" loading="lazy"/> : <span aria-hidden="true"><BookOpen/></span>}<div><strong>{item.title}</strong><small>{item.slug}</small></div></div></td><td>{item.category}</td><td><span className={`admin-badge is-${item.status === 'published' ? 'success' : 'neutral'}`}>{item.status}</span></td><td>{item.featured ? 'Featured' : '—'}</td><td>{formatDate(item.published_at)}</td><td>{formatDate(item.updated_at)}</td><td><Link className="admin-button" to={`/admin/blog/${item.id}/edit`}>Edit</Link></td></tr>)}</tbody></table></div>}
      <footer>{filtered.length} of {items.length} articles</footer>
    </section>
  </>
}
