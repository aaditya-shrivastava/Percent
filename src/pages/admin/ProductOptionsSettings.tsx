import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, Palette, Pencil, Plus, Power, Ruler, X } from 'lucide-react'
import {
  listProductOptions,
  ProductOptionsFailure,
  reorderProductOptions,
  saveProductColorOption,
  saveProductSizeOption,
  type ProductColorOption,
  type ProductOptionsDocument,
  type ProductSizeOption,
} from '../../backend/admin/productOptions'
import { AdminStatusBadge } from '../../components/admin/AdminComponents'

type Editor = { kind: 'color'; option?: ProductColorOption } | { kind: 'size'; option?: ProductSizeOption }

const messageFor = (error: unknown) => {
  if (!(error instanceof ProductOptionsFailure)) return 'Product Options could not be updated. Reload and retry.'
  if (error.kind === 'conflict') return 'This option changed after the page loaded. Latest options have been reloaded.'
  if (error.kind === 'duplicate') return 'An option with this name already exists.'
  if (error.kind === 'used') return 'This color is used by existing product variants. Keep its name and disable it instead.'
  if (error.kind === 'denied') return 'Your current account is not authorized to manage Product Options.'
  if (error.kind === 'invalid') return 'Review the option values and try again.'
  return 'Product Options are temporarily unavailable. Reload and retry.'
}

function OptionDialog({ editor, busy, onClose, onSaved }: { editor: Editor; busy: boolean; onClose: () => void; onSaved: () => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const existing = editor.option
  const isColor = editor.kind === 'color'
  const existingColor = editor.kind === 'color' ? editor.option : undefined
  const existingSize = editor.kind === 'size' ? editor.option : undefined
  const [name, setName] = useState(isColor ? existingColor?.name ?? '' : existingSize?.label ?? '')
  const [hex, setHex] = useState(isColor ? existingColor?.hex_code ?? '#333333' : '')
  const [enabled, setEnabled] = useState(existing?.enabled ?? true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const nameLocked = isColor && !!existing?.usage_count

  useEffect(() => { dialog.current?.showModal() }, [])
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const clean = name.trim().replace(/\s+/g, ' ')
    if (!clean || clean.length > (isColor ? 80 : 40)) return setError(`Enter a ${isColor ? 'color name up to 80' : 'size label up to 40'} characters.`)
    if (isColor && !/^#[0-9A-Fa-f]{6}$/.test(hex.trim())) return setError('Enter a six-digit hex color such as #711D32.')
    setError(''); setSaving(true)
    try {
      if (isColor) {
        const option = existing as ProductColorOption | undefined
        await saveProductColorOption(option ? { ...option, name: clean, hex_code: hex.toUpperCase(), enabled } : { name: clean, hex_code: hex.toUpperCase(), enabled, sort_order: 1000000 })
      } else {
        const option = existing as ProductSizeOption | undefined
        await saveProductSizeOption(option ? { ...option, label: clean, enabled } : { label: clean, enabled, sort_order: 1000000 })
      }
      await onSaved()
    } catch (reason) { setError(messageFor(reason)); setSaving(false) }
  }

  return <dialog ref={dialog} className="product-option-dialog" aria-labelledby="product-option-dialog-title" onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <form onSubmit={event => void submit(event)}>
      <header><div><span>{existing ? 'Edit option' : 'New option'}</span><h2 id="product-option-dialog-title">{existing ? 'Edit' : 'Add'} {isColor ? 'Color' : 'Size'}</h2></div><button type="button" aria-label="Close option editor" disabled={busy || saving} onClick={onClose}><X/></button></header>
      <div className="product-option-fields">
        <label>{isColor ? 'Color name' : 'Size label'}<input autoFocus value={name} maxLength={isColor ? 80 : 40} disabled={busy || saving || nameLocked} onChange={event => setName(event.target.value)} aria-describedby={nameLocked ? 'used-color-name-note' : undefined}/></label>
        {nameLocked&&<p id="used-color-name-note" className="product-option-note">This color is used by {existing?.usage_count} existing variants. Its name is preserved; you may update its swatch or availability.</p>}
        {isColor&&<label>Hex color<div className="product-option-hex"><span aria-hidden="true" style={{ background: /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : '#333333' }}/><input value={hex} maxLength={7} disabled={busy || saving} placeholder="#711D32" onChange={event => setHex(event.target.value)}/></div></label>}
        <label className="product-option-check"><input type="checkbox" checked={enabled} disabled={busy || saving} onChange={event => setEnabled(event.target.checked)}/> Enabled for new variants</label>
      </div>
      {error&&<p className="product-option-error" role="alert">{error}</p>}
      <footer><button type="button" className="admin-button" disabled={busy || saving} onClick={onClose}>Cancel</button><button className="admin-button product-option-primary" disabled={busy || saving}>{saving ? 'Saving…' : 'Save Option'}</button></footer>
    </form>
  </dialog>
}

export function ProductOptionsSettings() {
  const [options, setOptions] = useState<ProductOptionsDocument>()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editor, setEditor] = useState<Editor>()

  const load = async (signal?: AbortSignal) => {
    const result = await listProductOptions(signal)
    setOptions(result); setError(''); setLoading(false)
  }
  useEffect(() => {
    const controller = new AbortController()
    void listProductOptions(controller.signal).then(result => {
      if (controller.signal.aborted) return
      setOptions(result)
      setError('')
      setLoading(false)
    }).catch(reason => {
      if (controller.signal.aborted) return
      setError(messageFor(reason))
      setLoading(false)
    })
    return () => controller.abort()
  }, [])

  const action = async (work: () => Promise<void>, success: string) => {
    setBusy(true); setError(''); setNotice('')
    try { await work(); await load(); setNotice(success) }
    catch (reason) { setError(messageFor(reason)); if (reason instanceof ProductOptionsFailure && reason.kind === 'conflict') await load().catch(() => undefined) }
    finally { setBusy(false) }
  }
  const toggleColor = (option: ProductColorOption) => action(() => saveProductColorOption({ ...option, enabled: !option.enabled }), `${option.name} ${option.enabled ? 'disabled' : 're-enabled'}.`)
  const toggleSize = (option: ProductSizeOption) => action(() => saveProductSizeOption({ ...option, enabled: !option.enabled }), `${option.label} ${option.enabled ? 'disabled' : 're-enabled'}.`)
  const move = (kind: 'color' | 'size', index: number, direction: -1 | 1) => {
    if (!options) return
    const source = kind === 'color' ? options.colors : options.sizes
    const reordered = [...source]
    ;[reordered[index], reordered[index + direction]] = [reordered[index + direction], reordered[index]]
    void action(() => reorderProductOptions(kind, reordered), `${kind === 'color' ? 'Color' : 'Size'} order updated.`)
  }
  const saved = async () => { setEditor(undefined); setBusy(false); await load(); setNotice('Option saved.') }

  const activeColors = options?.colors.filter(option => option.enabled).length ?? 0
  const activeSizes = options?.sizes.filter(option => option.enabled).length ?? 0
  return <section id="product-options" className="admin-panel settings-section settings-wide product-options" aria-labelledby="settings-product-options">
    <header><span><Palette/></span><div><h2 id="settings-product-options">Product Options</h2><p>Manage the colors and sizes available when creating product variants.</p></div></header>
    {notice&&<p className="product-option-success" role="status">{notice}</p>}
    {error&&<div className="product-option-error" role="alert"><span>{error}</span><button className="admin-button" disabled={busy} onClick={() => { setLoading(true); void load().catch(reason => { setError(messageFor(reason)); setLoading(false) }) }}>Reload</button></div>}
    {loading?<div className="product-option-state" role="status">Loading Product Options…</div>:options&&<div className="product-option-groups">
      <section aria-labelledby="product-colors-title"><header><div><h3 id="product-colors-title"><Palette/> Colors</h3><p>{activeColors} active / {options.colors.length} total</p></div><button className="admin-button" disabled={busy} onClick={() => setEditor({ kind: 'color' })}><Plus/> Add Color</button></header>
        {!options.colors.length?<div className="product-option-empty">No colors configured.</div>:<div className="product-option-list">{options.colors.map((option, index) => <article key={option.id} className={!option.enabled ? 'is-disabled' : ''}>
          <span className="product-color-swatch" role="img" aria-label={`${option.name} swatch ${option.hex_code}`} style={{ background: option.hex_code }}/><div className="product-option-copy"><strong>{option.name}</strong><small>{option.hex_code} · Used by {option.usage_count} variant{option.usage_count === 1 ? '' : 's'}</small></div><AdminStatusBadge status={option.enabled ? 'active' : 'disabled'}/>
          <div className="product-option-actions"><button aria-label={`Move ${option.name} up`} title="Move up" disabled={busy || index === 0} onClick={() => move('color', index, -1)}><ArrowUp/></button><button aria-label={`Move ${option.name} down`} title="Move down" disabled={busy || index === options.colors.length - 1} onClick={() => move('color', index, 1)}><ArrowDown/></button><button aria-label={`Edit ${option.name}`} title="Edit" disabled={busy} onClick={() => setEditor({ kind: 'color', option })}><Pencil/></button><button className="product-option-toggle" disabled={busy} aria-label={`${option.enabled ? 'Disable' : 'Re-enable'} ${option.name}`} onClick={() => void toggleColor(option)}><Power/>{option.enabled ? 'Disable' : 'Re-enable'}</button></div>
        </article>)}</div>}
      </section>
      <section aria-labelledby="product-sizes-title"><header><div><h3 id="product-sizes-title"><Ruler/> Sizes</h3><p>{activeSizes} active / {options.sizes.length} total</p></div><button className="admin-button" disabled={busy} onClick={() => setEditor({ kind: 'size' })}><Plus/> Add Size</button></header>
        {!options.sizes.length?<div className="product-option-empty">No sizes configured.</div>:<div className="product-option-list">{options.sizes.map((option, index) => <article key={option.id} className={!option.enabled ? 'is-disabled' : ''}>
          <span className="product-size-chip" aria-hidden="true">{option.label.slice(0, 4)}</span><div className="product-option-copy"><strong>{option.label}</strong><small>Used by {option.usage_count} variant{option.usage_count === 1 ? '' : 's'}</small></div><AdminStatusBadge status={option.enabled ? 'active' : 'disabled'}/>
          <div className="product-option-actions"><button aria-label={`Move ${option.label} up`} title="Move up" disabled={busy || index === 0} onClick={() => move('size', index, -1)}><ArrowUp/></button><button aria-label={`Move ${option.label} down`} title="Move down" disabled={busy || index === options.sizes.length - 1} onClick={() => move('size', index, 1)}><ArrowDown/></button><button aria-label={`Edit ${option.label}`} title="Edit" disabled={busy} onClick={() => setEditor({ kind: 'size', option })}><Pencil/></button><button className="product-option-toggle" disabled={busy} aria-label={`${option.enabled ? 'Disable' : 'Re-enable'} ${option.label}`} onClick={() => void toggleSize(option)}><Power/>{option.enabled ? 'Disable' : 'Re-enable'}</button></div>
        </article>)}</div>}
      </section>
    </div>}
    <p className="product-option-footnote">Disabling an option removes it from new variant choices. Existing product variants retain their saved color or size.</p>
    {editor&&<OptionDialog editor={editor} busy={busy} onClose={() => setEditor(undefined)} onSaved={saved}/>} 
  </section>
}
