import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowUp, Eye, Image as ImageIcon, Plus, Save, Trash2 } from 'lucide-react'
import type { AdminIdentity } from '../../components/admin/AdminRouteGuard'
import { AdminPageHeader } from '../../components/admin/AdminComponents'
import { blogCategories, blogSlug, cleanupBlogImage, emptyBlogDocument, getBlogPost, managedBlogPath, saveBlogPost, signBlogImages, uploadBlogImage, type BlogDocument, type BlogImage } from '../../backend/admin/blog'
import { mergeBlogImagesForSave } from '../../backend/admin/blogImages'
import './blog.css'

const dateInput = (value: string | null) => value ? value.slice(0, 10) : ''
const obsoleteLimitedStory = (draft: BlogDocument) => draft.slug === 'the-story-behind-100-pieces' && /(?:one hundred|hundredth|100 pieces|why 100)/i.test([draft.title, draft.excerpt, draft.introduction, draft.pull_quote, ...draft.sections.flatMap(section => [section.heading, ...section.paragraphs])].join(' '))

export function AdminBlogEditor() {
  const { user } = useOutletContext<AdminIdentity>(), { id } = useParams(), navigate = useNavigate()
  const fresh = !id, [draft, setDraft] = useState<BlogDocument>(emptyBlogDocument), [loading, setLoading] = useState(!fresh), [error, setError] = useState(''), [notice, setNotice] = useState(''), [saving, setSaving] = useState(false), [uploading, setUploading] = useState(false), [previewOpen, setPreviewOpen] = useState(false), [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const preview = useRef<HTMLIFrameElement>(null)
  const previewTrigger = useRef<HTMLButtonElement>(null)
  const previewClose = useRef<HTMLButtonElement>(null)
  const pendingCleanup = useRef<string[]>([])
  const removedImageRoles = useRef<Set<BlogImage['role']>>(new Set())
  useEffect(() => { if (!id) return; let active = true; getBlogPost(user.id, id).then(async article => { const images = await signBlogImages(id, article.images, true); if (active) { removedImageRoles.current.clear(); setDraft({ ...article, images }); setLoading(false) } }).catch(() => { if (active) { setError('Unable to load this article.'); setLoading(false) } }); return () => { active = false } }, [id, user.id])
  const update = <K extends keyof BlogDocument>(key: K, value: BlogDocument[K]) => setDraft(current => ({ ...current, [key]: value }))
  const updateSection = (index: number, heading: string) => setDraft(current => ({ ...current, sections: current.sections.map((section, position) => position === index ? { ...section, heading } : section) }))
  const updateParagraph = (sectionIndex: number, paragraphIndex: number, value: string) => setDraft(current => ({ ...current, sections: current.sections.map((section, index) => index === sectionIndex ? { ...section, paragraphs: section.paragraphs.map((paragraph, position) => position === paragraphIndex ? value : paragraph) } : section) }))
  const moveSection = (index: number, shift: number) => setDraft(current => { const sections = [...current.sections]; const [section] = sections.splice(index, 1); sections.splice(index + shift, 0, section); return { ...current, sections } })
  const onTitle = (value: string) => setDraft(current => ({ ...current, title: value, slug: !current.id && (!current.slug || current.slug === blogSlug(current.title)) ? blogSlug(value) : current.slug }))
  const setImage = (role: BlogImage['role'], image: BlogImage | null) => setDraft(current => ({ ...current, images: image ? [...current.images.filter(candidate => candidate.role !== role), { ...image, role }] : current.images.filter(candidate => candidate.role !== role) }))
  const upload = async (role: BlogImage['role'], event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; event.target.value = ''; if (!file || !draft.id) return; setUploading(true); setError(''); try { const old = draft.images.find(image => image.role === role); const uploaded = await uploadBlogImage(draft.id, file); if (old && managedBlogPath(old.url)) pendingCleanup.current.push(old.url); removedImageRoles.current.delete(role); setImage(role, uploaded) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Upload failed') } finally { setUploading(false) } }
  const removeImage = async (role: BlogImage['role']) => { const current = draft.images.find(image => image.role === role); if (!current) return; removedImageRoles.current.add(role); setImage(role, null); if (draft.id && managedBlogPath(current.url)) { try { await cleanupBlogImage(draft.id, current.url) } catch { pendingCleanup.current.push(current.url) } } }
  const save = async (status: BlogDocument['status']) => {
    if (saving) return
    setError(''); setNotice('')
    if (fresh && status === 'published') { setError('Save this article as a draft before publishing.'); return }
    if (status === 'published' && obsoleteLimitedStory(draft)) { setError('This draft still claims a universal 100-piece run. Reconcile its copy before publishing; keep the existing permalink.'); return }
    if (status === 'published' && (!draft.sections.some(section => section.heading.trim() && section.paragraphs.some(paragraph => paragraph.trim())) || !draft.pull_quote.trim() || !draft.images.some(image => image.role === 'primary' && managedBlogPath(image.url)))) { setError('Publishing needs a complete section, a pull quote and a managed primary image.'); return }
    setSaving(true)
    try {
      const existing = draft.id ? (await getBlogPost(user.id, draft.id)).images : []
      const images = mergeBlogImagesForSave(draft.images, existing, removedImageRoles.current)
      const result = await saveBlogPost(user.id, { ...draft, images, status })
      removedImageRoles.current.clear()
      setDraft(current => ({ ...current, id: result.id, updated_at: result.updated_at, status }))
      setNotice(status === 'published' ? 'Article published.' : 'Draft saved.')
      if (fresh) { navigate(`/admin/blog/${result.id}/edit`, { replace: true }); return }
      try {
        const latest = await getBlogPost(user.id, result.id)
        const signed = await signBlogImages(result.id, latest.images, true)
        setDraft({ ...latest, images: signed })
      } catch { setNotice('Saved. Reload this article to refresh its details.') }
      const stale = [...new Set(pendingCleanup.current)]; pendingCleanup.current = []
      await Promise.all(stale.map(url => cleanupBlogImage(result.id, url).catch(() => undefined)))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Article could not be saved.') } finally { setSaving(false) }
  }
  useEffect(() => {
    if (!previewOpen) return
    const send = () => preview.current?.contentWindow?.postMessage({ type: 'percent-blog-preview-draft', article: draft }, window.location.origin)
    const receive = (event: MessageEvent) => { if (event.origin === window.location.origin && event.source === preview.current?.contentWindow && event.data?.type === 'percent-blog-preview-ready') send() }
    window.addEventListener('message', receive); send(); return () => window.removeEventListener('message', receive)
  }, [draft, previewOpen])
  useEffect(() => {
    if (!previewOpen) return
    const trigger = previewTrigger.current
    const frame = requestAnimationFrame(() => previewClose.current?.focus())
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setPreviewOpen(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('keydown', closeOnEscape); requestAnimationFrame(() => trigger?.focus()) }
  }, [previewOpen])
  if (loading) return <div className="admin-loading" role="status">Loading article…</div>
  return <><AdminPageHeader title={fresh ? 'New Article' : 'Edit Article'} description="Shape a story for the Percent Journal."/>
    <div className="blog-editor-top"><Link to="/admin/blog"><ArrowLeft/> All articles</Link><div><button ref={previewTrigger} className="admin-button" type="button" onClick={() => setPreviewOpen(true)}><Eye/> Preview</button><button className="admin-button" type="button" disabled={saving} onClick={() => void save('draft')}><Save/> {saving ? 'Saving…' : 'Save Draft'}</button>{!fresh && <button className="admin-button blog-primary" type="button" disabled={saving} onClick={() => void save(draft.status === 'published' ? 'draft' : 'published')}>{draft.status === 'published' ? 'Unpublish' : 'Publish'}</button>}</div></div>
    {error && <p className="blog-message is-error" role="alert">{error}</p>}{notice && <p className="blog-message" role="status">{notice}</p>}
    {obsoleteLimitedStory(draft) && <p className="blog-message is-error" role="status">This hosted draft has outdated 100-piece wording. The public Journal still uses the corrected source article. Review this copy during content acceptance before publication.</p>}
    <div className="blog-editor-grid"><div className="blog-editor-main">
      <section className="admin-panel blog-editor-section"><h2>Article</h2><label>Title<input value={draft.title} maxLength={180} onChange={event => onTitle(event.target.value)}/></label><label>Slug<input value={draft.slug} maxLength={120} readOnly={!!draft.first_published_at} onChange={event => update('slug', blogSlug(event.target.value))}/></label>{draft.first_published_at && <p className="blog-help">The public URL is permanent after first publication.</p>}<div className="blog-field-pair"><label>Category<select value={draft.category} onChange={event => update('category', event.target.value)}>{blogCategories.map(category => <option key={category}>{category}</option>)}</select></label><label>Author<input value={draft.author} maxLength={120} onChange={event => update('author', event.target.value)}/></label></div><label>Excerpt<textarea rows={3} maxLength={600} value={draft.excerpt} onChange={event => update('excerpt', event.target.value)}/></label><label className="blog-checkbox"><input type="checkbox" checked={draft.featured} onChange={event => update('featured', event.target.checked)}/> Featured story</label></section>
      <section className="admin-panel blog-editor-section"><h2>Content</h2><label>Introduction<textarea rows={4} maxLength={1200} value={draft.introduction} onChange={event => update('introduction', event.target.value)}/></label><label>Pull quote<textarea rows={3} maxLength={600} value={draft.pull_quote} onChange={event => update('pull_quote', event.target.value)}/></label><div className="blog-section-heading"><h3>Sections</h3><button className="admin-button" type="button" disabled={draft.sections.length >= 30} onClick={() => update('sections', [...draft.sections, { heading: '', paragraphs: [''] }])}><Plus/> Add section</button></div>{draft.sections.map((section, sectionIndex) => <div className="blog-content-block" key={sectionIndex}><div className="blog-content-heading"><strong>Section {sectionIndex + 1}</strong><div><button aria-label="Move section up" disabled={sectionIndex === 0} onClick={() => moveSection(sectionIndex, -1)}><ArrowUp/></button><button aria-label="Move section down" disabled={sectionIndex === draft.sections.length - 1} onClick={() => moveSection(sectionIndex, 1)}><ArrowDown/></button><button aria-label="Remove section" onClick={() => update('sections', draft.sections.filter((_, index) => index !== sectionIndex))}><Trash2/></button></div></div><label>Heading<input value={section.heading} maxLength={180} onChange={event => updateSection(sectionIndex, event.target.value)}/></label>{section.paragraphs.map((paragraph, paragraphIndex) => <label key={paragraphIndex}>Paragraph {paragraphIndex + 1}<textarea rows={4} maxLength={3000} value={paragraph} onChange={event => updateParagraph(sectionIndex, paragraphIndex, event.target.value)}/><button className="blog-text-button" type="button" disabled={section.paragraphs.length === 1} onClick={() => setDraft(current => ({ ...current, sections: current.sections.map((entry, index) => index === sectionIndex ? { ...entry, paragraphs: entry.paragraphs.filter((_, position) => position !== paragraphIndex) } : entry) }))}>Remove paragraph</button></label>)}<button className="admin-button" type="button" disabled={section.paragraphs.length >= 20} onClick={() => setDraft(current => ({ ...current, sections: current.sections.map((entry, index) => index === sectionIndex ? { ...entry, paragraphs: [...entry.paragraphs, ''] } : entry) }))}><Plus/> Add paragraph</button></div>)}</section>
    </div><aside className="blog-editor-side"><section className="admin-panel blog-editor-section"><h2>Media</h2>{(['primary', 'secondary'] as const).map(role => { const image = draft.images.find(item => item.role === role); return <div className="blog-image-slot" key={role}><h3>{role === 'primary' ? 'Primary image' : 'Secondary image (optional)'}</h3>{image?.preview || image?.url.startsWith('https://') ? <img src={image.preview ?? image.url} alt={image.alt || ''}/> : <div className="blog-image-empty"><ImageIcon/><span>No image selected</span></div>}<label className="admin-button">{uploading ? 'Uploading…' : image ? 'Replace image' : 'Choose image'}<input type="file" hidden accept="image/jpeg,image/png,image/webp" disabled={!draft.id || uploading} onChange={event => void upload(role, event)}/></label>{!draft.id && <p className="blog-help">Save a draft first to add managed media.</p>}{image && <><label>Alt text<input value={image.alt} maxLength={300} onChange={event => setImage(role, { ...image, alt: event.target.value })}/></label><p className="blog-help">{image.width} × {image.height} px</p><button className="blog-text-button" type="button" onClick={() => void removeImage(role)}>Remove image</button></>}</div> })}</section><section className="admin-panel blog-editor-section"><h2>Publication</h2><p><span className={`admin-badge is-${draft.status === 'published' ? 'success' : 'neutral'}`}>{draft.status}</span></p><label>Publication date<input type="date" value={dateInput(draft.published_at)} disabled={!!draft.first_published_at} onChange={event => update('published_at', event.target.value ? `${event.target.value}T00:00:00.000Z` : null)}/></label>{draft.first_published_at && <p className="blog-help">Original publication date remains fixed after unpublishing.</p>}<p className="blog-help">New stories must be saved as drafts first. Publishing requires a complete story and managed primary image.</p></section></aside></div>
    {previewOpen && <div className="blog-preview-overlay" role="dialog" aria-modal="true" aria-label="Article preview"><div className="blog-preview-head"><strong>Article preview</strong><div>{(['desktop', 'tablet', 'mobile'] as const).map(option => <button key={option} type="button" aria-pressed={device === option} onClick={() => setDevice(option)}>{option}</button>)}</div><button ref={previewClose} type="button" onClick={() => setPreviewOpen(false)}>Close</button></div><iframe ref={preview} title="Unsaved article preview" className={`blog-preview-frame is-${device}`} src="/admin/blog/preview" sandbox="allow-same-origin allow-scripts"/></div>}
  </>
}
