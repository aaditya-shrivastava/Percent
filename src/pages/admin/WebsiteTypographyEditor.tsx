/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import type { TypographySettings, WebsiteDocument } from '../../backend/website'
import { cleanupFontFamily, deleteFontFamily, loadFontLibrary, previewFontFace, saveFontFamily, toggleFontFamily, type FontDraftFace } from '../../backend/websiteFonts'
import { builtinNames, fontStack, type FontFamilyRecord, type FontReference } from '../../typography/fontRegistry'
import { useFontRules } from '../../typography/useFontRules'
import './website-typography.css'

const roles=['display_family','heading_family','body_family','ui_family'] as const
const roleLabels=['Display Font','Heading Font','Body Font','UI Font']
const weights=['Thin','Extra Light','Light','Regular','Medium','Semi Bold','Bold','Extra Bold','Black']
const message=(error:unknown)=>error instanceof Error?error.message:'The request failed. Try again.'
type Props={document:WebsiteDocument;patch:(value:Partial<WebsiteDocument['settings']>)=>void;onFamilies:(value:FontFamilyRecord[])=>void;busy:boolean;onBusy:(value:boolean)=>void}

function FontOptions({families}:{families:FontFamilyRecord[]}){return <><optgroup label="Built-in fonts">{builtinNames.map(name=><option key={name} value={name}>{name}</option>)}</optgroup><optgroup label="Custom fonts">{families.filter(f=>f.enabled!==false).map(f=><option key={f.id} value={`custom:${f.id}`}>{f.family_name}</option>)}</optgroup></>}

export function WebsiteTypographyEditor({document,patch,onFamilies,busy,onBusy}:Props){
 const t=document.settings.typography,families=document.font_families??[]
 const [apply,setApply]=useState<FontReference>(t.heading_family),[preview,setPreview]=useState<FontReference|null>(null),[editing,setEditing]=useState<FontFamilyRecord|null|false>(false),[notice,setNotice]=useState(''),[failed,setFailed]=useState(false),[cleanupId,setCleanupId]=useState<string|null>(null)
 const previewFamilies=families.map(f=>({...f,enabled:true}))
 const previewError=useFontRules([...roles.map(key=>t[key]),...(preview?[preview]:[])],previewFamilies,true,[t.heading_weight,t.body_weight,400,600])
 const update=(value:Partial<TypographySettings>)=>patch({typography:{...t,...value}})
 const applyAll=(value:FontReference)=>{update({display_family:value,heading_family:value,body_family:value,ui_family:value});setApply(value);setNotice('Applied to the draft. Save Changes to publish.');setFailed(false)}
 const run=async(task:()=>Promise<void>)=>{onBusy(true);setNotice('');try{await task();setFailed(false)}catch(error){setNotice(message(error));setFailed(true)}finally{onBusy(false)}}
 const remove=(family:FontFamilyRecord)=>{if(!window.confirm(`Delete “${family.family_name}” and its unused font files?`))return;void run(async()=>{const result=await deleteFontFamily(family);onFamilies(result.families);setCleanupId(result.warning?family.id:null);setNotice(result.warning??'Font family deleted.');if(preview===`custom:${family.id}`)setPreview(null)})}
 const sample=(reference:FontReference,weight:number):CSSProperties=>({fontFamily:fontStack(reference,previewFamilies),fontWeight:weight})
 return <div className="typography-editor">
  <div className="designer-card-head"><div><h2>Typography Roles</h2><p>Choose your storefront fonts. Changes stay in this draft until you save.</p></div></div>
  <div className="font-role-grid">{roles.map((key,index)=><label className="designer-field" key={key}><span>{roleLabels[index]}</span><select disabled={busy} value={t[key]} onChange={event=>update({[key]:event.target.value as FontReference})}><FontOptions families={families}/></select></label>)}</div>
  <div className="font-weight-grid"><label className="designer-field"><span>Heading weight</span><select value={t.heading_weight} disabled={busy} onChange={e=>update({heading_weight:Number(e.target.value) as TypographySettings['heading_weight']})}>{[400,500,600,700,800].map(v=><option key={v}>{v}</option>)}</select></label><label className="designer-field"><span>Body weight</span><select value={t.body_weight} disabled={busy} onChange={e=>update({body_weight:Number(e.target.value) as TypographySettings['body_weight']})}>{[400,500,600,700].map(v=><option key={v}>{v}</option>)}</select></label></div>
  <label className="designer-field"><span>Letter spacing ({t.letter_spacing.toFixed(2)}em)</span><input type="range" min="-0.05" max="0.30" step="0.01" value={t.letter_spacing} disabled={busy} onChange={e=>update({letter_spacing:Number(e.target.value)})}/></label>
  <div className="font-apply"><label className="designer-field"><span>One font for all four roles</span><select value={apply} disabled={busy} onChange={e=>setApply(e.target.value as FontReference)}><FontOptions families={families}/></select></label><button className="website-button" disabled={busy||!builtinNames.includes(apply as typeof builtinNames[number])&&!families.some(f=>`custom:${f.id}`===apply&&f.enabled!==false)} onClick={()=>applyAll(apply)}>Apply Everywhere</button></div>
  {notice&&<p className={`website-notice ${failed?'error':'success'}`} role={failed?'alert':'status'}>{notice}</p>}
  <section className="font-live-preview" aria-label="Live typography preview"><h3>Live Preview</h3><small>DISPLAY SAMPLE</small><div className="font-display-sample" style={sample(t.display_family,t.heading_weight)}>Percent</div><small>HEADING SAMPLE</small><div className="font-heading-sample" style={sample(t.heading_family,t.heading_weight)}>Less Ordinary. More You.</div><small>BODY SAMPLE</small><p style={sample(t.body_family,t.body_weight)}>The quick brown fox jumps over the lazy dog.<br/>1234567890</p><small>BUTTON / UI SAMPLE</small><button type="button" style={sample(t.ui_family,600)}>Explore the collection</button>{previewError&&<p role="status">{previewError}</p>}</section>
  <details className="font-builtins"><summary>Built-in Font Library · 12 families</summary><p>Preview a family without changing your draft.</p><div>{builtinNames.map(name=><button className="website-button" disabled={busy} key={name} onClick={()=>setPreview(name)}>{name}</button>)}</div></details>
  {preview&&<section className="font-library-preview" aria-label="Library font preview"><div><strong>{families.find(f=>`custom:${f.id}`===preview)?.family_name??preview}</strong><button className="website-button" onClick={()=>setPreview(null)}>Close preview</button></div><p style={sample(preview,400)}>Percent · Less Ordinary. More You.<br/>The quick brown fox jumps over the lazy dog. 1234567890</p></section>}
  <section className="font-library"><div className="font-library-head"><div><h3>Custom Font Library</h3><p>Upload licensed WOFF2 files, then choose where to use them.</p></div><button className="website-button" disabled={busy} onClick={()=>setEditing(null)}>+ Upload Font Family</button></div><button className="website-button" disabled={busy} onClick={()=>void run(async()=>{onFamilies(await loadFontLibrary());setNotice('Font library reloaded. Your typography draft is unchanged.')})}>Reload library</button>
   {!families.length&&<p className="font-empty">No custom families yet. Start with a family name and one font file.</p>}
   <div className="font-cards">{families.map(family=>{const draftUsed=roles.some(role=>t[role]===`custom:${family.id}`),protectedFamily=!!family.in_use||draftUsed;return <article className="font-card" key={family.id}><header><h4>{family.family_name}</h4><span>{family.enabled?'Enabled':'Disabled'}{family.in_use?' · In use':draftUsed?' · In draft':''}</span></header><p>{family.faces.length} {family.faces.length===1?'face':'faces'} · {family.faces.map(face=>`${face.weight} ${face.style}`).join(', ')}</p><div className="font-card-actions"><button className="website-button" disabled={busy} onClick={()=>setPreview(`custom:${family.id}`)}>Preview</button><button className="website-button" disabled={busy||!family.enabled} onClick={()=>applyAll(`custom:${family.id}`)}>Apply Everywhere</button><button className="website-button" disabled={busy} onClick={()=>setEditing(family)}>Manage</button><button className="website-button" disabled={busy||!!family.enabled&&protectedFamily} title={protectedFamily?'Choose another font before disabling this family':undefined} onClick={()=>void run(async()=>{onFamilies(await toggleFontFamily(family));setNotice(family.enabled?'Family disabled.':'Family enabled.')})}>{family.enabled?'Disable':'Enable'}</button><button className="website-button danger" disabled={busy||protectedFamily} title={protectedFamily?'Choose another font before deleting this family':undefined} onClick={()=>remove(family)}>Delete</button><button className="website-button" disabled={busy} onClick={()=>void run(async()=>{await cleanupFontFamily(family.id);setNotice('Unused font files removed.')})}>Clean up unused files</button></div>{protectedFamily&&<small>Live or draft usage protects this family. Choose another font before disabling or deleting it.</small>}</article>})}</div>
   {cleanupId&&<button className="website-button" disabled={busy} onClick={()=>void run(async()=>{await cleanupFontFamily(cleanupId);setCleanupId(null);setNotice('Unused font files removed.')})}>Clean up deleted family files</button>}
  </section>
  {editing!==false&&<FontFamilyDialog key={editing?.id??'new'} family={editing} busy={busy} onBusy={onBusy} onClose={()=>setEditing(false)} onSaved={(result,warning)=>{onFamilies(result);setEditing(false);setNotice(warning??'Font family saved. Select it in a role and Save Changes to publish.');setFailed(false)}}/>}
 </div>
}

function FontFamilyDialog({family,busy,onBusy,onClose,onSaved}:{family:FontFamilyRecord|null;busy:boolean;onBusy:(value:boolean)=>void;onClose:()=>void;onSaved:(families:FontFamilyRecord[],warning?:string)=>void}){
 const dialog=useRef<HTMLDialogElement>(null),[id]=useState(()=>family?.id??crypto.randomUUID())
 const [name,setName]=useState(family?.family_name??''),[license,setLicense]=useState(!!family),[faces,setFaces]=useState<FontDraftFace[]>(family?.faces.map(f=>({...f,key:crypto.randomUUID()}))??[{key:crypto.randomUUID(),weight:400,style:'normal'}]),[error,setError]=useState(''),[previewError,setPreviewError]=useState('')
 const alias=`PercentUpload_${id.replaceAll('-','_')}`
 useEffect(()=>{const element=dialog.current;element?.showModal();return()=>element?.close()},[])
 const signature=faces.map(face=>`${face.key}:${face.weight}:${face.style}:${face.file?.name??face.asset_id}:${face.file?.lastModified}:${face.selection??''}`).join('|')
 useEffect(()=>{
  let cancelled=false;const loaded:FontFace[]=[],urls:string[]=[]
  setPreviewError('')
  const load=async()=>{try{
   for(const face of faces){let source:ArrayBuffer|string
    if(face.file)source=await face.file.arrayBuffer()
    else if(face.asset_id){const url=await previewFontFace({asset_id:face.asset_id,weight:face.weight,style:face.style});urls.push(url);source=`url("${url}")`}
    else continue
    const font=new FontFace(alias,source,{weight:String(face.weight),style:face.style,display:'swap'});await font.load();if(cancelled)break;document.fonts.add(font);loaded.push(font)
   }
  }catch{if(!cancelled)setPreviewError('This font preview could not load. Check that the file is a valid WOFF2 font.')}finally{if(cancelled){loaded.forEach(font=>document.fonts.delete(font));urls.forEach(URL.revokeObjectURL)}}}
  void load();return()=>{cancelled=true;loaded.forEach(font=>document.fonts.delete(font));urls.forEach(URL.revokeObjectURL)}
 // Files are identified by their stable row and selection timestamp.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[signature,alias])
 const change=(key:string,patch:Partial<FontDraftFace>)=>setFaces(current=>current.map(f=>f.key===key?{...f,...patch}:f))
 const choose=(face:FontDraftFace,file?:File)=>{setError('');if(!file)return;if(!file.name.toLowerCase().endsWith('.woff2')||file.size>2*1024*1024){setError('Choose a WOFF2 file no larger than 2 MB.');return}change(face.key,{file,asset_id:undefined,selection:crypto.randomUUID()})}
 const submit=async(event:FormEvent)=>{
  event.preventDefault();setError('')
  if(!license){setError('Confirm your webfont permission before saving.');return}
  if(new Set(faces.map(face=>`${face.weight}:${face.style}`)).size!==faces.length){setError('Each weight and style can appear only once.');return}
  if(faces.reduce((sum,face)=>sum+(face.file?.size??0),0)>10*1024*1024){setError('Upload up to 10 MB at a time. Save this batch, then add more faces.');return}
  onBusy(true)
  try{const result=await saveFontFamily({id,family_name:name,enabled:family?.enabled??true,updated_at:family?.updated_at},faces,license);onSaved(result.families,result.warning)}catch(error){setError(message(error))}finally{onBusy(false)}
 }
 return <dialog className="font-upload-dialog" ref={dialog} aria-labelledby="font-dialog-title" onCancel={event=>{if(busy)event.preventDefault();else onClose()}}><form onSubmit={event=>void submit(event)}><header><div><h2 id="font-dialog-title">{family?'Manage Font Family':'Upload Font Family'}</h2><p>WOFF2 only · up to 2 MB per file</p></div><button type="button" className="website-button" disabled={busy} onClick={onClose}>Close</button></header>
  <label className="designer-field"><span>Font family name</span><input autoFocus required maxLength={80} value={name} disabled={busy} placeholder="e.g. Satoshi" onChange={e=>setName(e.target.value)}/></label>
  <div className="font-face-rows">{faces.map((face,index)=>{const locked=!!family?.in_use&&!!face.asset_id;return <fieldset className="font-face-row" key={face.key}><legend>Font file {index+1}</legend><label className="designer-field font-file-field"><span>{face.file?.name??(face.asset_id?`${face.weight} ${face.style} · saved face`:'Choose a WOFF2 file')}</span><input type="file" accept=".woff2,font/woff2" disabled={busy||locked} onChange={e=>choose(face,e.target.files?.[0])}/></label><div className="font-face-controls"><label className="designer-field"><span>Weight</span><select value={face.weight} disabled={busy||!!face.asset_id} onChange={e=>change(face.key,{weight:Number(e.target.value)})}>{weights.map((name,index)=><option key={name} value={(index+1)*100}>{(index+1)*100} · {name}</option>)}</select></label><label className="designer-field"><span>Style</span><select value={face.style} disabled={busy||!!face.asset_id} onChange={e=>change(face.key,{style:e.target.value as 'normal'|'italic'})}><option value="normal">Normal</option><option value="italic">Italic</option></select></label><button type="button" className="website-button danger" disabled={busy||locked||faces.length===1} onClick={()=>setFaces(current=>current.filter(f=>f.key!==face.key))}>Remove</button></div>{locked&&<small>This face is used by the live storefront and cannot be replaced or removed.</small>}</fieldset>})}</div>
  <button type="button" className="website-button" disabled={busy||faces.length>=18} onClick={()=>setFaces(current=>[...current,{key:crypto.randomUUID(),weight:[100,200,300,400,500,600,700,800,900].find(w=>!current.some(f=>f.weight===w&&f.style==='normal'))??400,style:'normal'}])}>+ Add Another Font File</button>
  <section className="font-upload-preview" aria-label="Uploaded font preview" style={{fontFamily:`"${alias}", system-ui, sans-serif`}}><h3>Percent</h3><p>Less Ordinary. More You.</p><p>The quick brown fox jumps over the lazy dog.</p><p>1234567890</p></section>
  {previewError&&<p className="website-notice error" role="status">{previewError}</p>}
  <label className="font-license"><input type="checkbox" checked={license} disabled={busy} onChange={e=>setLicense(e.target.checked)}/><span>I confirm that Percent has permission to use this font as a webfont.</span></label>
  {error&&<p className="website-notice error" role="alert">{error}</p>}
  <footer><button type="button" className="website-button" disabled={busy} onClick={onClose}>Cancel</button><button className="website-button primary" type="submit" disabled={busy||!license||!name.trim()||faces.some(face=>!face.file&&!face.asset_id)}>{busy?'Saving…':'Save Font Family'}</button></footer>
 </form></dialog>
}
