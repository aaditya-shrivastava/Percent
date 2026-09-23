/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { Link, useBeforeUnload, useBlocker } from 'react-router-dom'
import {
  ArrowDown, ArrowLeft, ArrowUp, Eye, GripVertical,
  ImagePlus, Monitor, Plus, Save, Smartphone, Tablet, Trash2, X,
} from 'lucide-react'
import {
  cleanupWebsiteImage, loadWebsiteEditor, saveWebsite, uploadWebsiteImage,
  validateWebsiteDocument, type WebsiteBanner, type WebsiteDocument, type WebsiteSection,
} from '../../backend/website'
import { pageKeys, type PageKey } from '../../backend/websitePages'
import { AdminWebsitePageEditor, WebsiteEditorNav, type WebsiteModule } from './AdminWebsitePageEditor'
import './website-editor.css'

type EditorTarget = { kind: 'banner'; index: number } | { kind: 'section'; index: number }
type Device = 'desktop' | 'tablet' | 'mobile'
const nullable = (value: string) => value.trim() || null
const snapshot = (value: WebsiteDocument | null) => value ? JSON.stringify(value, (key, item) => ['updated_at', 'media_url', 'image_url', 'mobile_image_url', 'bootstrap_preview_url'].includes(key) ? undefined : item) : ''
const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : fallback
const dimensions = (file: File) => new Promise<{ width: number; height: number }>((resolve, reject) => {
  const image = new Image(), url = URL.createObjectURL(file)
  image.onload = () => { resolve({ width: image.naturalWidth, height: image.naturalHeight }); URL.revokeObjectURL(url) }
  image.onerror = () => { reject(new Error('The selected file is not a readable image.')); URL.revokeObjectURL(url) }
  image.src = url
})
const reorder = <T extends { sort_order: number }>(items: T[], index: number, direction: number) => {
  const target = index + direction
  if (target < 0 || target >= items.length) return items
  const next = items.slice()
  ;[next[index], next[target]] = [next[target], next[index]]
  return next.map((item, itemIndex) => ({ ...item, sort_order: itemIndex + 1 }))
}
const titleCase = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())

export function AdminWebsiteEditor() {
  const [document, setDocument] = useState<WebsiteDocument | null>(null)
  const [baseline, setBaseline] = useState('')
  const [module, setModule] = useState<WebsiteModule>(() => { const requested = new URLSearchParams(window.location.search).get('section'); return requested === 'footer' || pageKeys.includes(requested as PageKey) ? requested as WebsiteModule : 'home' })
  const [target, setTarget] = useState<EditorTarget>({ kind: 'banner', index: 0 })
  const [device, setDevice] = useState<Device>('desktop')
  const [busy, setBusy] = useState(true)
  const [message, setMessage] = useState('')
  const [messageKind, setMessageKind] = useState<'success' | 'error'>('success')
  const [showErrors, setShowErrors] = useState(false)
  const [obsolete, setObsolete] = useState<string[]>([])
  const allowNavigation = useRef(false)
  const dirty = !!document && snapshot(document) !== baseline
  const blocked = useBlocker(({ currentLocation, nextLocation }) => !allowNavigation.current && (dirty || busy) && currentLocation.pathname + currentLocation.search !== nextLocation.pathname + nextLocation.search)
  useBeforeUnload(event => { if (dirty || busy) { event.preventDefault(); event.returnValue = '' } })

  const load = async () => {
    setBusy(true)
    try {
      const result = await loadWebsiteEditor()
      setDocument(result.document)
      setBaseline(snapshot(result.document))
      setMessage('')
      setShowErrors(false)
    } catch (error) {
      setMessageKind('error')
      setMessage(errorMessage(error, 'Unable to load content.'))
    } finally { setBusy(false) }
  }
  useEffect(() => { void load() }, [])

  const updateBanner = (index: number, patch: Partial<WebsiteBanner>) => setDocument(current => {
    if (!current) return current
    const banners = current.banners.slice()
    banners[index] = { ...banners[index], ...patch }
    return { ...current, banners }
  })
  const updateSection = (index: number, patch: Partial<WebsiteSection>) => setDocument(current => {
    if (!current) return current
    const sections = current.sections.slice()
    sections[index] = { ...sections[index], ...patch }
    return { ...current, sections }
  })
  const upload = async (event: ChangeEvent<HTMLInputElement>, kind: 'banner' | 'section', id: string, index: number, mobile = false) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    setMessage('')
    try {
      const size = await dimensions(file)
      const result = await uploadWebsiteImage(file, kind, id, size)
      if (kind === 'banner') {
        const oldPath = mobile ? document?.banners[index].mobile_image_path : document?.banners[index].image_path
        if (oldPath) setObsolete(value => [...value, oldPath])
        updateBanner(index, mobile ? {
          mobile_image_path: result.path, mobile_image_url: result.preview_url,
          mobile_width: result.width, mobile_height: result.height,
        } : {
          image_path: result.path, image_url: result.preview_url, bootstrap_preview_url: undefined,
          width: result.width, height: result.height,
        })
      } else {
        updateSection(index, {
          media_path: result.path, media_url: result.preview_url,
          media_width: result.width, media_height: result.height,
          media_alt: document?.sections[index].media_alt || document?.sections[index].heading,
        })
      }
      setMessageKind('success')
      setMessage('Image ready. Save changes to publish this update.')
    } catch (error) {
      setMessageKind('error')
      setMessage(errorMessage(error, 'Upload failed.'))
    } finally { setBusy(false) }
  }
  const save = async () => {
    if (!document) return
    setShowErrors(true)
    if (validateWebsiteDocument(document).length) return
    setBusy(true)
    setMessage('')
    try {
      await saveWebsite(document)
      const refreshed = await loadWebsiteEditor()
      setDocument(refreshed.document)
      setBaseline(snapshot(refreshed.document))
      setShowErrors(false)
      setMessageKind('success')
      setMessage('Website changes saved.')
      await Promise.allSettled([...new Set(obsolete)].filter(Boolean).map(cleanupWebsiteImage))
      setObsolete([])
    } catch (error) {
      const text = errorMessage(error, 'Save failed.')
      setMessageKind('error')
      setMessage(text.toLowerCase().includes('changed') ? 'Stale version detected. Refresh the latest content before saving again.' : text)
    } finally { setBusy(false) }
  }

  if (module !== 'home' && module !== 'footer') return <AdminWebsitePageEditor pageKey={module} onChange={setModule} />
  if (!document) return <section className="website-editor website-loading"><h1>Website Editor</h1><p>{busy ? 'Loading your storefront…' : message}</p></section>
  const errors = validateWebsiteDocument(document)
  const status = busy ? 'Saving…' : messageKind === 'error' && message ? 'Save failed' : dirty ? 'Unsaved changes' : 'Saved'
  const bannerIndex = target.kind === 'banner' ? Math.min(target.index, Math.max(0, document.banners.length - 1)) : 0
  const selectedBanner = document.banners[bannerIndex]
  const selectedSection = target.kind === 'section' ? document.sections[target.index] : undefined

  return <section className="website-editor">
    <header className="website-page-head"><div><h1>Website Editor</h1><p>Build and customize your storefront experience.</p></div><p>Your brand. Your rules.<br />Design. Edit. Preview. All in one place.</p></header>
    <div className="website-toolbar">
      <div className="website-toolbar-title"><span><ArrowLeft /> Website Editor</span><strong>{module === 'home' ? 'Home Page' : 'Footer'}</strong></div>
      <div className="website-toolbar-actions"><span className={`save-state ${dirty ? 'is-dirty' : messageKind === 'error' ? 'is-error' : ''}`}><i />{status}</span><Link className="website-button" to="/" target="_blank"><Eye /> Preview</Link><button className="website-button primary" disabled={busy || !dirty} onClick={() => void save()}><Save />{busy ? 'Saving…' : 'Save Changes'}</button></div>
    </div>
    {message && <p className={`website-notice ${messageKind}`} role={messageKind === 'error' ? 'alert' : 'status'}>{message}</p>}
    {showErrors && errors.length > 0 && <div className="website-errors" role="alert"><b>Review these fields before saving:</b><ul>{errors.map(error => <li key={error}>{error}</li>)}</ul></div>}

    <div className="designer-grid">
      <WebsiteEditorNav module={module} onChange={next => { if (dirty && !window.confirm('Discard unsaved Website Editor changes?')) return; setModule(next); if (next === 'home') setTarget({ kind: 'banner', index: 0 }) }} />
      <main className="designer-editor">
        {module === 'footer'
          ? <FooterEditor document={document} setDocument={setDocument} />
          : selectedSection
            ? <SectionEditor section={selectedSection} index={target.index} update={patch => updateSection(target.index, patch)} upload={upload} onBack={() => setTarget({ kind: 'banner', index: bannerIndex })} />
            : <BannerEditor document={document} index={bannerIndex} banner={selectedBanner} setDocument={setDocument} update={patch => updateBanner(bannerIndex, patch)} upload={upload} setTarget={setTarget} setObsolete={setObsolete} />}
      </main>
      <LivePreview document={document} device={device} setDevice={setDevice} />
    </div>
    {module === 'home' && <SectionManager document={document} setDocument={setDocument} setTarget={setTarget} updateSection={updateSection} />}
    {blocked.state === 'blocked' && <ConfirmDialog onStay={() => blocked.reset()} onDiscard={() => { allowNavigation.current = true; blocked.proceed() }} />}
  </section>
}

function BannerEditor({ document, index, banner, setDocument, update, upload, setTarget, setObsolete }: {
  document: WebsiteDocument; index: number; banner?: WebsiteBanner; setDocument: (document: WebsiteDocument) => void
  update: (patch: Partial<WebsiteBanner>) => void
  upload: (event: ChangeEvent<HTMLInputElement>, kind: 'banner' | 'section', id: string, index: number, mobile?: boolean) => Promise<void>
  setTarget: (target: EditorTarget) => void; setObsolete: React.Dispatch<React.SetStateAction<string[]>>
}) {
  if (!banner) return <div className="designer-empty"><h2>Hero banners</h2><p>Add your first campaign banner.</p><button className="website-button primary" onClick={() => { const next = newBanner(1); setDocument({ ...document, banners: [next] }); setTarget({ kind: 'banner', index: 0 }) }}><Plus />Add Banner</button></div>
  const remove = () => {
    setObsolete(value => [...value, banner.image_path, banner.mobile_image_path ?? ''])
    const banners = document.banners.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, sort_order: itemIndex + 1 }))
    setDocument({ ...document, banners })
    setTarget({ kind: 'banner', index: Math.max(0, index - 1) })
  }
  return <div className="designer-card">
    <div className="designer-card-head"><div><h2>Hero Banners</h2><p>Select one campaign to edit.</p></div><button className="icon-action" aria-label="Remove selected banner" onClick={remove}><Trash2 /></button></div>
    <div className="banner-selector" role="tablist" aria-label="Hero banners">
      {document.banners.map((item, itemIndex) => <button role="tab" aria-selected={itemIndex === index} className={itemIndex === index ? 'active' : ''} key={item.id} onClick={() => setTarget({ kind: 'banner', index: itemIndex })}>
        <img src={item.image_url ?? item.bootstrap_preview_url} alt="" /><span>Banner {itemIndex + 1}<small>{item.enabled ? 'Visible' : 'Hidden'}</small></span>
      </button>)}
      <button className="banner-add" disabled={document.banners.length >= 10} onClick={() => { const next = newBanner(document.banners.length + 1); setDocument({ ...document, banners: [...document.banners, next] }); setTarget({ kind: 'banner', index: document.banners.length }) }}><Plus /><span>Add</span></button>
    </div>
    <div className="selected-banner-head"><div><b>Banner {index + 1}</b><small>Edit campaign content and imagery.</small></div><Toggle checked={banner.enabled} label="Show on homepage" onChange={enabled => update({ enabled })} /></div>
    <div className="designer-fields">
      <Field label="Eyebrow"><input value={banner.eyebrow ?? ''} onChange={event => update({ eyebrow: nullable(event.target.value) })} /></Field>
      <Field label="Heading"><textarea rows={2} value={banner.heading} onChange={event => update({ heading: event.target.value })} /></Field>
      <Field label="Description"><textarea rows={3} value={banner.description ?? ''} onChange={event => update({ description: nullable(event.target.value) })} /></Field>
      <div className="field-pair"><Field label="CTA Label"><input value={banner.cta_label ?? ''} onChange={event => update({ cta_label: nullable(event.target.value) })} /></Field><Field label="CTA Path"><input value={banner.cta_path ?? ''} onChange={event => update({ cta_path: nullable(event.target.value) })} /></Field></div>
      <div className="image-pair">
        <ImageCard title="Desktop Image" preview={banner.image_url ?? banner.bootstrap_preview_url} width={banner.width} height={banner.height} path={banner.image_path} helper="Recommended 1920 × 1080 · JPG, PNG or WebP" onChange={event => void upload(event, 'banner', banner.id, index)} />
        <ImageCard title="Mobile Image" optional preview={banner.mobile_image_url} width={banner.mobile_width} height={banner.mobile_height} path={banner.mobile_image_path} helper="Optional · Uses desktop image when empty" onChange={event => void upload(event, 'banner', banner.id, index, true)} fallback={banner.image_url ?? banner.bootstrap_preview_url} />
      </div>
      <Field label="Alt Text"><input value={banner.alt} onChange={event => update({ alt: event.target.value })} /></Field>
      <div className="editor-order-actions"><button className="website-button" disabled={!index} onClick={() => { setDocument({ ...document, banners: reorder(document.banners, index, -1) }); setTarget({ kind: 'banner', index: index - 1 }) }}><ArrowUp />Move Earlier</button><button className="website-button" disabled={index === document.banners.length - 1} onClick={() => { setDocument({ ...document, banners: reorder(document.banners, index, 1) }); setTarget({ kind: 'banner', index: index + 1 }) }}><ArrowDown />Move Later</button></div>
    </div>
  </div>
}

function ImageCard({ title, optional, preview, fallback, width, height, path, helper, onChange }: { title: string; optional?: boolean; preview?: string; fallback?: string; width: number | null; height: number | null; path?: string | null; helper: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return <div className="image-editor"><div className="image-editor-title"><b>{title}</b>{optional && <span>Optional</span>}</div><div className={`image-editor-preview ${!preview ? 'is-fallback' : ''}`}>{(preview ?? fallback) ? <img src={preview ?? fallback} alt="" /> : <ImagePlus />}{!preview && fallback && <span>Desktop image fallback</span>}</div><label className="image-change"><ImagePlus />Change Image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={onChange} /></label><small>{width && height ? `${width} × ${height}px · ` : ''}{helper}</small>{path && <details><summary>Media details</summary><code>{path}</code></details>}</div>
}

function SectionEditor({ section, index, update, upload, onBack }: { section: WebsiteSection; index: number; update: (patch: Partial<WebsiteSection>) => void; upload: (event: ChangeEvent<HTMLInputElement>, kind: 'banner' | 'section', id: string, index: number, mobile?: boolean) => Promise<void>; onBack: () => void }) {
  return <div className="designer-card"><button className="editor-back-link" onClick={onBack}><ArrowLeft />Hero banners</button><div className="selected-banner-head"><div><h2>{titleCase(section.section_key)}</h2><small>Presentation content for this homepage section.</small></div><Toggle checked={section.enabled} label="Show on homepage" onChange={enabled => update({ enabled })} /></div><div className="designer-fields">
    <Field label="Heading"><input value={section.heading} onChange={event => update({ heading: event.target.value })} /></Field>
    <Field label="Subheading"><textarea rows={2} value={section.subheading ?? ''} onChange={event => update({ subheading: nullable(event.target.value) })} /></Field>
    <Field label="Body"><textarea rows={4} value={section.body ?? ''} onChange={event => update({ body: nullable(event.target.value) })} /></Field>
    <div className="field-pair"><Field label="CTA Label"><input value={section.cta_label ?? ''} onChange={event => update({ cta_label: nullable(event.target.value) })} /></Field><Field label="CTA Path"><input value={section.cta_path ?? ''} onChange={event => update({ cta_path: nullable(event.target.value) })} /></Field></div>
    {section.section_key === 'oversized_fit' && <ImageCard title="Section Image" optional preview={section.media_url} width={section.media_width} height={section.media_height} path={section.media_path} helper="Optional section campaign image" onChange={event => void upload(event, 'section', section.section_key, index)} />}
  </div></div>
}

function SectionManager({ document, setDocument, setTarget, updateSection }: { document: WebsiteDocument; setDocument: (document: WebsiteDocument) => void; setTarget: (target: EditorTarget) => void; updateSection: (index: number, patch: Partial<WebsiteSection>) => void }) {
  return <section className="section-manager"><div className="section-manager-head"><div><h2>Page Sections</h2><p>Organize and control the sections on your homepage.</p></div></div><div className="section-rows">{document.sections.map((section, index) => <div className="section-row" key={section.section_key}>
    <GripVertical /><span className="section-number">{index + 1}</span><button className="section-name" onClick={() => setTarget({ kind: 'section', index })}>{titleCase(section.section_key)}</button>
    <Toggle checked={section.enabled} label={section.enabled ? 'Visible' : 'Hidden'} compact onChange={enabled => updateSection(index, { enabled })} />
    <button aria-label={`Move ${titleCase(section.section_key)} up`} disabled={!index} onClick={() => setDocument({ ...document, sections: reorder(document.sections, index, -1) })}><ArrowUp /></button>
    <button aria-label={`Move ${titleCase(section.section_key)} down`} disabled={index === document.sections.length - 1} onClick={() => setDocument({ ...document, sections: reorder(document.sections, index, 1) })}><ArrowDown /></button>
    <button onClick={() => setTarget({ kind: 'section', index })}>Edit</button>
  </div>)}</div></section>
}

function LivePreview({ document, device, setDevice }: { document: WebsiteDocument; device: Device; setDevice: (device: Device) => void }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [geometry, setGeometry] = useState({ scale: 1, height: 720 })
  const viewportWidth = { desktop: 1440, tablet: 768, mobile: 390 }[device]
  const sendDraft = useCallback(() => frameRef.current?.contentWindow?.postMessage({ type: 'percent-website-preview-draft', document }, window.location.origin), [document])
  useEffect(() => { sendDraft() }, [sendDraft])
  useEffect(() => {
    const receive = (event: MessageEvent) => { if (event.origin === window.location.origin && event.source === frameRef.current?.contentWindow && event.data?.type === 'percent-website-preview-ready') sendDraft() }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [sendDraft])
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const update = () => { const width = Math.max(1, stage.clientWidth - 24), height = Math.max(1, stage.clientHeight - 24); const scale = Math.min(1, width / viewportWidth); setGeometry({ scale, height: height / scale }) }
    const observer = new ResizeObserver(update)
    observer.observe(stage); update()
    return () => observer.disconnect()
  }, [viewportWidth])
  return <aside className="live-preview"><div className="live-preview-head"><div><h2>Live Preview</h2><p>The real Percent storefront, using your unsaved draft.</p></div><div className="device-switcher" aria-label="Preview device">{([['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]] as const).map(([name, Icon]) => <button key={name} className={device === name ? 'active' : ''} aria-pressed={device === name} onClick={() => setDevice(name)}><Icon /><span>{titleCase(name)}</span></button>)}</div></div>
    <div ref={stageRef} className={`preview-stage is-${device}`}><div className="preview-canvas" style={{ width: viewportWidth * geometry.scale, height: '100%' }}><div className="preview-browser" style={{ width: viewportWidth, height: geometry.height, transform: `scale(${geometry.scale})` }}><div className="browser-bar"><i /><i /><i /><span>percent.store preview</span></div><iframe ref={frameRef} title="Percent storefront live preview" src="/admin/website/preview" onLoad={sendDraft} /></div></div></div>
  </aside>
}
function FooterEditor({ document, setDocument }: { document: WebsiteDocument; setDocument: (document: WebsiteDocument) => void }) { return <div className="designer-card footer-editor"><div className="designer-card-head"><div><h2>Footer</h2><p>Set the message that closes every storefront page.</p></div></div><div className="designer-fields"><Field label="Footer Tagline"><input maxLength={80} value={document.settings.footer_tagline} onChange={event => setDocument({ ...document, settings: { ...document.settings, footer_tagline: event.target.value } })} /></Field><Field label="Footer Description"><textarea rows={4} maxLength={200} value={document.settings.footer_description} onChange={event => setDocument({ ...document, settings: { ...document.settings, footer_description: event.target.value } })} /></Field></div></div> }
function Toggle({ checked, label, onChange, compact = false }: { checked: boolean; label: string; onChange: (checked: boolean) => void; compact?: boolean }) { return <label className={`website-toggle ${compact ? 'compact' : ''}`}><span>{label}</span><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /><i><b /></i></label> }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="designer-field"><span>{label}</span>{children}</label> }
function ConfirmDialog({ onStay, onDiscard }: { onStay: () => void; onDiscard: () => void }) { const ref = useRef<HTMLDialogElement>(null); useEffect(() => { ref.current?.showModal() }, []); return <dialog ref={ref} className="website-dialog" onCancel={event => { event.preventDefault(); onStay() }}><button className="dialog-close" aria-label="Close" onClick={onStay}><X /></button><h2>Discard unsaved changes?</h2><p>Your Website Editor changes have not been saved.</p><div><button className="website-button" onClick={onStay}>Stay</button><button className="website-button danger" onClick={onDiscard}>Discard Changes</button></div></dialog> }
function newBanner(sortOrder: number): WebsiteBanner { return { id: crypto.randomUUID(), image_path: '', mobile_image_path: null, alt: '', width: 0, height: 0, mobile_width: null, mobile_height: null, eyebrow: 'NEW DROP', heading: 'New campaign', description: null, cta_label: 'SHOP NOW', cta_path: '/shop', enabled: false, sort_order: sortOrder } }
