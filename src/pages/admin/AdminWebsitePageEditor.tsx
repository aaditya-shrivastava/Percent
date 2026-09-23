/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { useBeforeUnload, useBlocker } from 'react-router-dom'
import { ArrowDown, ArrowUp, ChevronRight, Eye, ImagePlus, Monitor, PanelBottom, Save, Smartphone, Tablet, Trash2 } from 'lucide-react'
import { supabase } from '../../backend/client'
import { cleanupWebsiteImage } from '../../backend/website'
import { fallbackPageDocument, loadPageEditor, savePage, uploadPageImage, validatePage, type PageDocument, type PageKey, type PageSection, type FaqCategory, type FaqItem, type PolicySection } from '../../backend/websitePages'
import './website-editor.css'

export type WebsiteModule = 'home' | 'footer' | PageKey
const modules: Array<{ key: WebsiteModule; label: string }> = [
  { key: 'home', label: 'Home' }, { key: 'shop', label: 'Shop' }, { key: 'product_details', label: 'Product Details' },
  { key: 'sold_out', label: 'Sold Out' }, { key: 'about', label: 'About' }, { key: 'contact', label: 'Contact' },
  { key: 'faq', label: 'FAQ' }, { key: 'policy_shipping', label: 'Shipping Policy' }, { key: 'policy_returns', label: 'Returns Policy' },
  { key: 'policy_privacy', label: 'Privacy Policy' }, { key: 'policy_terms', label: 'Terms' },
]
const label = (key: string) => modules.find(item => item.key === key)?.label ?? key.replaceAll('_', ' ').replace(/\b\w/g, match => match.toUpperCase())
const clean = (value: string) => value.trim() || null
const snapshot = (document: PageDocument) => JSON.stringify(document, (key, value) => ['updated_at', 'media_url'].includes(key) ? undefined : value)
const move = <T extends { sort_order: number }>(items: T[], index: number, offset: number) => { const next = items.slice(); const target = index + offset; if (target < 0 || target >= next.length) return items; [next[index], next[target]] = [next[target], next[index]]; return next.map((item, position) => ({ ...item, sort_order: position + 1 })) }
const getError = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const details = error as { code?: unknown; message?: unknown }
    if (details.code === 'PT409') return 'PT409'
    if (typeof details.message === 'string') return details.message
  }
  return 'Unable to save this page.'
}
const dimensions = (file: File) => new Promise<{ width: number; height: number }>((resolve, reject) => { const image = new Image(); const url = URL.createObjectURL(file); image.onload = () => { resolve({ width: image.naturalWidth, height: image.naturalHeight }); URL.revokeObjectURL(url) }; image.onerror = () => { reject(new Error('Invalid image file.')); URL.revokeObjectURL(url) }; image.src = url })
type Device = 'desktop' | 'tablet' | 'mobile'
type Selected = { kind: 'page' } | { kind: 'section'; index: number } | { kind: 'faq'; category: number; item?: number } | { kind: 'policy'; index: number }

export function WebsiteEditorNav({ module, onChange }: { module: WebsiteModule; onChange: (key: WebsiteModule) => void }) {
  return <nav className="designer-nav" aria-label="Website editor modules">
    <div><span>Pages</span>{modules.filter(item => item.key !== 'footer').map(item => <button type="button" key={item.key} className={module === item.key ? 'active' : ''} onClick={() => onChange(item.key)}><span className="nav-marker" aria-hidden="true" />{item.label}<ChevronRight /></button>)}</div>
    <div><span>Global</span><button type="button" className={module === 'footer' ? 'active' : ''} onClick={() => onChange('footer')}><PanelBottom />Footer<ChevronRight /></button></div>
  </nav>
}

export function AdminWebsitePageEditor({ pageKey, onChange }: { pageKey: PageKey; onChange: (key: WebsiteModule) => void }) {
  const [document, setDocument] = useState<PageDocument>(() => fallbackPageDocument(pageKey))
  const [baseline, setBaseline] = useState('')
  const [selected, setSelected] = useState<Selected>({ kind: 'page' })
  const [device, setDevice] = useState<Device>('desktop')
  const [busy, setBusy] = useState(true)
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [previewProducts, setPreviewProducts] = useState<Array<{ slug: string; name: string }>>([])
  const [previewSlug, setPreviewSlug] = useState('')
  const mediaReady = true
  const [obsolete, setObsolete] = useState<string[]>([])
  const allowRoute = useRef(false)
  const dirty = Boolean(baseline) && snapshot(document) !== baseline
  const canSave = Boolean(baseline) && (dirty || !document.updated_at)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => !allowRoute.current && (dirty || busy) && currentLocation.pathname + currentLocation.search !== nextLocation.pathname + nextLocation.search)
  useBeforeUnload(event => { if (dirty || busy) { event.preventDefault(); event.returnValue = '' } })

  useEffect(() => {
    let active = true
    setBusy(true)
    setSelected({ kind: 'page' })
    void loadPageEditor(pageKey).then(result => { if (active) { setDocument(result.document); setBaseline(snapshot(result.document)); setMessage(''); setErrors([]) } }).catch(error => { if (active) setMessage(getError(error)) }).finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [pageKey])
  useEffect(() => {
    if (pageKey !== 'product_details') return
    let active = true
    void supabase.from('products').select('slug,name').eq('is_visible', true).in('status', ['active', 'archived']).order('display_order').then(({ data, error }) => {
      if (error || !active) return
      const products = (data ?? []).map(item => ({ slug: item.slug, name: item.name }))
      setPreviewProducts(products)
      setPreviewSlug(current => current || products[0]?.slug || '')
    })
    return () => { active = false }
  }, [pageKey])

  const choose = (next: WebsiteModule) => { if (next === pageKey) return; if (dirty && !window.confirm('Discard unsaved Website Editor changes?')) return; onChange(next) }
  const patchPage = (patch: Partial<PageDocument>) => setDocument(current => ({ ...current, ...patch }))
  const patchSection = (index: number, patch: Partial<PageSection>) => setDocument(current => ({ ...current, sections: current.sections.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }))
  const patchFaqCategory = (index: number, patch: Partial<FaqCategory>) => setDocument(current => ({ ...current, faq_categories: current.faq_categories.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }))
  const patchFaqItem = (category: number, index: number, patch: Partial<FaqItem>) => setDocument(current => ({ ...current, faq_categories: current.faq_categories.map((group, groupIndex) => groupIndex === category ? { ...group, items: group.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) } : group) }))
  const patchPolicy = (index: number, patch: Partial<PolicySection>) => setDocument(current => ({ ...current, policy_sections: current.policy_sections.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }))

  const upload = async (event: ChangeEvent<HTMLInputElement>, sectionIndex?: number) => {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file || !mediaReady || !['about', 'contact'].includes(pageKey)) return
    setBusy(true)
    try {
      const result = await uploadPageImage(file, pageKey as 'about' | 'contact', await dimensions(file))
      if (sectionIndex === undefined) {
        if (document.media_path) setObsolete(current => [...current, document.media_path!])
        patchPage({ media_path: result.path, media_url: result.preview_url, media_width: result.width, media_height: result.height, media_alt: document.media_alt || label(pageKey) })
      } else {
        const item = document.sections[sectionIndex]
        if (item.media_path) setObsolete(current => [...current, item.media_path!])
        patchSection(sectionIndex, { media_path: result.path, media_url: result.preview_url, media_width: result.width, media_height: result.height, media_alt: item.media_alt || item.heading || label(pageKey) })
      }
      setMessage('Image ready. Save Changes to make it live.')
    } catch (error) { setMessage(getError(error)) } finally { setBusy(false) }
  }
  const save = async () => {
    const issues = validatePage(document); setErrors(issues)
    if (issues.length) return
    setBusy(true); setMessage('')
    try {
      await savePage(document)
      const refreshed = await loadPageEditor(pageKey)
      setDocument(refreshed.document); setBaseline(snapshot(refreshed.document)); setErrors([])
      setMessage('Page changes saved.')
      await Promise.allSettled([...new Set(obsolete)].filter(Boolean).map(cleanupWebsiteImage)); setObsolete([])
    } catch (error) {
      const text = getError(error)
      setMessage(text.includes('PT409') || text.toLowerCase().includes('changed') ? 'This page changed elsewhere. Reload the latest version before saving again.' : text)
    } finally { setBusy(false) }
  }

  const status = busy ? 'Loading…' : dirty ? 'Unsaved changes' : document.updated_at ? 'Saved' : 'Source content preview'
  return <section className="website-editor">
    <header className="website-page-head"><div><h1>Website Editor</h1><p>Build and customize your storefront experience.</p></div><p>Your brand. Your rules.<br />Design. Edit. Preview. All in one place.</p></header>
    <div className="website-toolbar"><div className="website-toolbar-title"><span>Website Editor</span><strong>{label(pageKey)}</strong></div><div className="website-toolbar-actions"><span className={'save-state ' + (dirty ? 'is-dirty' : '')}><i />{status}</span><button className="website-button" onClick={() => window.document.getElementById('page-preview')?.scrollIntoView({ block: 'start' })}><Eye /> Preview</button><button className="website-button primary" disabled={busy || !canSave} onClick={() => void save()}><Save />Save Changes</button></div></div>
    {message && <p className={'website-notice ' + (message.includes('saved') ? 'success' : 'error')} role="status">{message}</p>}
    {errors.length > 0 && <div className="website-errors" role="alert"><b>Review these fields:</b><ul>{errors.map(item => <li key={item}>{item}</li>)}</ul></div>}
    <div className="designer-grid"><WebsiteEditorNav module={pageKey} onChange={choose} /><main className="designer-editor"><div className="designer-card">
      {selected.kind !== 'page' && <button className="editor-back-link" onClick={() => setSelected({ kind: 'page' })}>← {label(pageKey)}</button>}
      {selected.kind === 'page' && <><div className="designer-card-head"><div><h2>{label(pageKey)}</h2><p>Presentation content for the real storefront page.</p></div></div><div className="designer-fields">
        {pageKey !== 'product_details' && <><Field label="Eyebrow"><input value={document.eyebrow ?? ''} maxLength={60} onChange={event => patchPage({ eyebrow: clean(event.target.value) })} /></Field><Field label="Heading"><textarea rows={2} maxLength={160} value={document.heading ?? ''} onChange={event => patchPage({ heading: clean(event.target.value) })} /></Field><Field label={pageKey.startsWith('policy_') ? 'Introduction' : 'Description / Subheading'}><textarea rows={3} maxLength={300} value={document.subheading ?? ''} onChange={event => patchPage({ subheading: clean(event.target.value) })} /></Field><Field label="Supporting copy"><textarea rows={4} maxLength={1500} value={document.body ?? ''} onChange={event => patchPage({ body: clean(event.target.value) })} /></Field></>}
        {pageKey === 'sold_out' && <div className="field-pair"><Field label="CTA text"><input value={document.cta_label ?? ''} onChange={event => patchPage({ cta_label: clean(event.target.value) })} /></Field><Field label="CTA route"><input value={document.cta_path ?? ''} onChange={event => patchPage({ cta_path: clean(event.target.value) })} /></Field></div>}
        {['about', 'contact'].includes(pageKey) && <MediaEditor title="Editorial image" preview={document.media_url} alt={document.media_alt} onAlt={value => patchPage({ media_alt: clean(value) })} onUpload={upload} enabled={mediaReady} />}
      </div></>}
      {selected.kind === 'section' && <SectionFields item={document.sections[selected.index]} pageKey={pageKey} update={patch => patchSection(selected.index, patch)} onUpload={event => void upload(event, selected.index)} mediaReady={mediaReady} />}
      {selected.kind === 'faq' && <FaqFields category={document.faq_categories[selected.category]} item={selected.item === undefined ? undefined : document.faq_categories[selected.category]?.items[selected.item]} updateCategory={patch => patchFaqCategory(selected.category, patch)} updateItem={patch => selected.item !== undefined && patchFaqItem(selected.category, selected.item, patch)} removeItem={() => { if (selected.item === undefined) return; const group = document.faq_categories[selected.category]; patchFaqCategory(selected.category, { items: group.items.filter((_, index) => index !== selected.item).map((item, index) => ({ ...item, sort_order: index + 1 })) }); setSelected({ kind: 'faq', category: selected.category }) }} />}
      {selected.kind === 'policy' && <PolicyFields item={document.policy_sections[selected.index]} update={patch => patchPolicy(selected.index, patch)} remove={() => { setDocument(current => ({ ...current, policy_sections: current.policy_sections.filter((_, index) => index !== selected.index).map((item, index) => ({ ...item, sort_order: index + 1 })) })); setSelected({ kind: 'page' }) }} />}
      {selected.kind === 'page' && <div className="page-editor-list">
        {document.sections.length > 0 && <><h3>Page Sections</h3>{document.sections.map((item, index) => <Row key={item.section_key} label={label(item.section_key)} order={item.sort_order} enabled={item.enabled} onEdit={() => setSelected({ kind: 'section', index })} onToggle={() => patchSection(index, { enabled: !item.enabled })} onUp={() => setDocument(current => ({ ...current, sections: move(current.sections, index, -1) }))} onDown={() => setDocument(current => ({ ...current, sections: move(current.sections, index, 1) }))} first={index === 0} last={index === document.sections.length - 1} />)}</>}
        {pageKey === 'faq' && <><h3>FAQ Categories</h3>{document.faq_categories.map((group, index) => <div key={group.category_key}><Row label={group.label} order={group.sort_order} enabled={group.enabled} onEdit={() => setSelected({ kind: 'faq', category: index })} onToggle={() => patchFaqCategory(index, { enabled: !group.enabled })} onUp={() => setDocument(current => ({ ...current, faq_categories: move(current.faq_categories, index, -1) }))} onDown={() => setDocument(current => ({ ...current, faq_categories: move(current.faq_categories, index, 1) }))} first={index === 0} last={index === document.faq_categories.length - 1} />{group.items.map((item, itemIndex) => <button className="page-editor-subrow" key={item.item_key} onClick={() => setSelected({ kind: 'faq', category: index, item: itemIndex })}>{item.question}</button>)}</div>)}<button className="website-button" onClick={() => { const free = ['Orders', 'Shipping', 'Returns', 'Sizing', 'Payments', 'Policies'].find(key => !document.faq_categories.some(item => item.category_key === key)); if (!free) return; setDocument(current => ({ ...current, faq_categories: [...current.faq_categories, { category_key: free, label: free, enabled: true, sort_order: current.faq_categories.length + 1, items: [] }] })) }} disabled={document.faq_categories.length >= 6}>Add Category</button></>}
        {pageKey.startsWith('policy_') && <><h3>Policy Sections</h3>{document.policy_sections.map((item, index) => <Row key={item.section_key} label={item.heading} order={item.sort_order} onEdit={() => setSelected({ kind: 'policy', index })} onUp={() => setDocument(current => ({ ...current, policy_sections: move(current.policy_sections, index, -1) }))} onDown={() => setDocument(current => ({ ...current, policy_sections: move(current.policy_sections, index, 1) }))} first={index === 0} last={index === document.policy_sections.length - 1} />)}<button className="website-button" onClick={() => setDocument(current => ({ ...current, policy_sections: [...current.policy_sections, { section_key: 'section-' + crypto.randomUUID().slice(0, 8), heading: 'New section', paragraphs: ['Add policy text.'], sort_order: current.policy_sections.length + 1 }] }))}>Add Section</button></>}
      </div>}
    </div></main><PageLivePreview page={document} device={device} setDevice={setDevice} previewSlug={previewSlug} previewProducts={previewProducts} setPreviewSlug={setPreviewSlug} /></div>
    {blocker.state === 'blocked' && <div className="website-blocker" role="dialog" aria-modal="true"><p>Discard unsaved changes?</p><button className="website-button" onClick={() => blocker.reset()}>Stay</button><button className="website-button danger" onClick={() => { allowRoute.current = true; blocker.proceed() }}>Discard</button></div>}
  </section>
}

function Field({ label: title, children }: { label: string; children: ReactNode }) { return <label className="designer-field"><span>{title}</span>{children}</label> }
function Row({ label: title, order, enabled, onEdit, onToggle, onUp, onDown, first, last }: { label: string; order: number; enabled?: boolean; onEdit: () => void; onToggle?: () => void; onUp: () => void; onDown: () => void; first: boolean; last: boolean }) { return <div className="page-editor-row"><span>{order}</span><button onClick={onEdit}>{title}</button>{onToggle && <label><input type="checkbox" checked={enabled} onChange={onToggle} /> Visible</label>}<button aria-label={'Move ' + title + ' up'} disabled={first} onClick={onUp}><ArrowUp /></button><button aria-label={'Move ' + title + ' down'} disabled={last} onClick={onDown}><ArrowDown /></button></div> }
function MediaEditor({ title, preview, alt, onAlt, onUpload, enabled }: { title: string; preview?: string; alt: string | null; onAlt: (value: string) => void; onUpload: (event: ChangeEvent<HTMLInputElement>) => void; enabled: boolean }) { return <div className="page-media-editor"><strong>{title}</strong>{preview && <img src={preview} alt={alt ?? ''} />}{enabled ? <label className="website-button"><ImagePlus />Change Image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={onUpload} /></label> : <p>Image changes will be available after media security verification.</p>}<Field label="Image alt text"><input value={alt ?? ''} maxLength={160} onChange={event => onAlt(event.target.value)} /></Field></div> }
function SectionFields({ item, pageKey, update, onUpload, mediaReady }: { item?: PageSection; pageKey: PageKey; update: (patch: Partial<PageSection>) => void; onUpload: (event: ChangeEvent<HTMLInputElement>) => void; mediaReady: boolean }) { if (!item) return null; return <><h2>{label(item.section_key)}</h2><div className="designer-fields"><label className="page-check"><input type="checkbox" checked={item.enabled} onChange={event => update({ enabled: event.target.checked })} /> Show section</label><Field label="Heading"><textarea rows={2} maxLength={160} value={item.heading ?? ''} onChange={event => update({ heading: clean(event.target.value) })} /></Field><Field label="Body"><textarea rows={4} maxLength={1500} value={item.body ?? ''} onChange={event => update({ body: clean(event.target.value) })} /></Field>{item.cta_label !== null || item.cta_path !== null ? <div className="field-pair"><Field label="CTA text"><input value={item.cta_label ?? ''} onChange={event => update({ cta_label: clean(event.target.value) })} /></Field><Field label="CTA route"><input value={item.cta_path ?? ''} onChange={event => update({ cta_path: clean(event.target.value) })} /></Field></div> : null}{pageKey === 'about' && ['live', 'craft', 'identity'].includes(item.section_key) && <MediaEditor title="Section image" preview={item.media_url} alt={item.media_alt} onAlt={value => update({ media_alt: clean(value) })} onUpload={onUpload} enabled={mediaReady} />}</div></> }
function FaqFields({ category, item, updateCategory, updateItem, removeItem }: { category?: FaqCategory; item?: FaqItem; updateCategory: (patch: Partial<FaqCategory>) => void; updateItem: (patch: Partial<FaqItem>) => void; removeItem: () => void }) { if (!category) return null; if (item) return <><h2>FAQ Question</h2><div className="designer-fields"><Field label="Question"><textarea value={item.question} maxLength={240} onChange={event => updateItem({ question: event.target.value })} /></Field><Field label="Answer"><textarea rows={7} value={item.answer} maxLength={2000} onChange={event => updateItem({ answer: event.target.value })} /></Field><label className="page-check"><input type="checkbox" checked={item.enabled} onChange={event => updateItem({ enabled: event.target.checked })} /> Visible</label><button className="website-button danger" onClick={removeItem}><Trash2 />Remove Question</button></div></>; return <><h2>{category.label}</h2><div className="designer-fields"><Field label="Display name"><input value={category.label} maxLength={60} onChange={event => updateCategory({ label: event.target.value })} /></Field><label className="page-check"><input type="checkbox" checked={category.enabled} onChange={event => updateCategory({ enabled: event.target.checked })} /> Visible</label><button className="website-button" onClick={() => updateCategory({ items: [...category.items, { item_key: 'question-' + crypto.randomUUID().slice(0, 8), question: 'New question?', answer: 'Add an answer.', enabled: true, sort_order: category.items.length + 1 }] })}>Add Question</button></div></> }
function PolicyFields({ item, update, remove }: { item?: PolicySection; update: (patch: Partial<PolicySection>) => void; remove: () => void }) { if (!item) return null; return <><h2>Policy Section</h2><div className="designer-fields"><Field label="Heading"><input value={item.heading} maxLength={160} onChange={event => update({ heading: event.target.value })} /></Field>{item.paragraphs.map((paragraph, index) => <div className="page-paragraph" key={index}><Field label={'Paragraph ' + (index + 1)}><textarea rows={5} maxLength={3000} value={paragraph} onChange={event => update({ paragraphs: item.paragraphs.map((value, position) => position === index ? event.target.value : value) })} /></Field><button className="website-button" disabled={item.paragraphs.length === 1} onClick={() => update({ paragraphs: item.paragraphs.filter((_, position) => position !== index) })}><Trash2 />Remove</button></div>)}<button className="website-button" disabled={item.paragraphs.length >= 20} onClick={() => update({ paragraphs: [...item.paragraphs, 'New paragraph.'] })}>Add Paragraph</button><button className="website-button danger" onClick={remove}><Trash2 />Remove Section</button></div></> }
function PageLivePreview({ page, device, setDevice, previewSlug, previewProducts, setPreviewSlug }: { page: PageDocument; device: Device; setDevice: (device: Device) => void; previewSlug: string; previewProducts: Array<{ slug: string; name: string }>; setPreviewSlug: (slug: string) => void }) {
  const stage = useRef<HTMLDivElement>(null), frame = useRef<HTMLIFrameElement>(null)
  const [geometry, setGeometry] = useState({ scale: 1, height: 720 })
  const width = { desktop: 1440, tablet: 768, mobile: 390 }[device]
  const url = '/admin/website/preview?page=' + encodeURIComponent(page.page_key) + (page.page_key === 'product_details' && previewSlug ? '&product=' + encodeURIComponent(previewSlug) : '')
  const send = useCallback(() => frame.current?.contentWindow?.postMessage({ type: 'percent-website-preview-page-draft', pageDocument: page }, window.location.origin), [page])
  useEffect(() => { send() }, [send])
  useEffect(() => { const listener = (event: MessageEvent) => { if (event.origin === window.location.origin && event.source === frame.current?.contentWindow && event.data?.type === 'percent-website-preview-ready') send() }; window.addEventListener('message', listener); return () => window.removeEventListener('message', listener) }, [send])
  useEffect(() => { if (!stage.current) return; const node = stage.current; const update = () => { const scale = Math.min(1, Math.max(1, node.clientWidth - 24) / width); setGeometry({ scale, height: Math.max(1, node.clientHeight - 24) / scale }) }; const observer = new ResizeObserver(update); observer.observe(node); update(); return () => observer.disconnect() }, [width])
  return <aside className="live-preview" id="page-preview"><div className="live-preview-head"><div><h2>Live Preview</h2><p>The real storefront page with unsaved edits.</p></div><div className="device-switcher">{([['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]] as const).map(([name, Icon]) => <button key={name} type="button" className={device === name ? 'active' : ''} aria-label={label(name)} aria-pressed={device === name} onClick={() => setDevice(name)}><Icon /><span>{label(name)}</span></button>)}</div></div>{page.page_key === 'product_details' && <label className="preview-product-selector">Preview product <select value={previewSlug} onChange={event => setPreviewSlug(event.target.value)}>{previewProducts.map(product => <option value={product.slug} key={product.slug}>{product.name}</option>)}</select></label>}<div ref={stage} className={'preview-stage is-' + device}><div className="preview-canvas" style={{ width: width * geometry.scale, height: '100%' }}><div className="preview-browser" style={{ width, height: geometry.height, transform: 'scale(' + geometry.scale + ')' }}><div className="browser-bar"><i /><i /><i /><span>percent.store preview</span></div><iframe ref={frame} title={label(page.page_key) + ' live preview'} src={url} onLoad={send} /></div></div></div></aside>
}
