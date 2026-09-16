import { useEffect, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Archive, CheckCircle, FileText, Package, Plus, Search, SlidersHorizontal, MoreHorizontal, X, RefreshCw } from 'lucide-react'
import { AdminEmptyState, AdminPageHeader, AdminStatCard, AdminStatusBadge } from '../../components/admin/AdminComponents'
import type { AdminIdentity } from '../../components/admin/AdminRouteGuard'
import { archiveAdminProduct, listAdminProducts } from '../../backend/admin/products'
import { canArchive, emptyProductFilters, filterProducts, formatINR, runMetrics, type AdminProduct, type ProductFilters } from '../../backend/admin/product-model'
import { publicationReadiness } from '../../backend/admin/publication-model'

const readinessFor=(p:AdminProduct)=>publicationReadiness({name:p.name,slug:p.slug,designCode:p.design_code,pricePaise:p.price_paise,productionLimit:p.production_limit,fitType:p.fit_type,categoryActive:p.categoryActive,enabledVariants:p.enabledVariants,invalidEnabledVariants:p.invalidEnabledVariants,primaryImageUrl:p.primaryImageUrl,produced:p.allocated,eligible:p.eligible,sold:p.sold,status:p.status,archived:p.status==='archived',soldOut:!!p.sold_out_at})

function Thumbnail({product}:{product:AdminProduct}){
  const [failed,setFailed]=useState(false)
  return <span className="admin-product-thumb">{product.image&&!failed?<img src={product.image.url} alt={product.image.alt} loading="lazy" onError={()=>setFailed(true)}/>:<Package aria-label="No product image"/>}</span>
}
function Progress({product:p}:{product:AdminProduct}) {return <div className="admin-production"><span>{p.sold} / {p.production_limit}</span><progress value={runMetrics(p.production_limit,p.sold).progress} max={100} aria-label={`${p.name}: ${p.sold} of ${p.production_limit} pieces sold`}/></div>}
function Actions({product:p,onArchive}:{product:AdminProduct;onArchive:(p:AdminProduct)=>void}) {
  const details=useRef<HTMLDetailsElement>(null)
  const publication=readinessFor(p)
  return <details ref={details} className="admin-product-actions" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))e.currentTarget.open=false}} onKeyDown={e=>{if(e.key==='Escape'){e.currentTarget.open=false;e.currentTarget.querySelector('summary')?.focus()}}}><summary aria-label={`Actions for ${p.name}`}><MoreHorizontal/></summary><div>
    {p.status!=='draft'&&p.is_visible?<Link to={`/product/${p.slug}`} target="_blank" rel="noopener noreferrer">Preview storefront</Link>:<p>{p.status==='draft'?'Draft products cannot be previewed publicly yet.':'This product is hidden from the storefront.'}</p>}
    <Link to={`/admin/products/${p.id}/edit`}>Edit product</Link>
    {p.status==='draft'&&<Link to={`/admin/products/${p.id}/edit`}>{publication.ready?'Review & publish':'Review publication requirements'}</Link>}
    {canArchive(p)?<button onClick={()=>{if(details.current)details.current.open=false;onArchive(p)}}>Archive product</button>:p.status!=='archived'?<p>Archive requires a fully allocated production run.</p>:<p>Archived designs are permanent.</p>}
  </div></details>
}
const statusOptions=[['all','All'],['draft','Draft'],['active','Active'],['sold-out','Sold Out'],['archived','Archived']]
export function AdminProducts(){
  const {user}=useOutletContext<AdminIdentity>()
  const [revision,setRevision]=useState(0),[data,setData]=useState<{userId:string;products:AdminProduct[]}>(),[error,setError]=useState(false),[loading,setLoading]=useState(true)
  const [filters,setFilters]=useState<ProductFilters>(emptyProductFilters),[search,setSearch]=useState(''),[showFilters,setShowFilters]=useState(false)
  const [selected,setSelected]=useState<AdminProduct>(),[saving,setSaving]=useState(false),[archiveError,setArchiveError]=useState(false),[notice,setNotice]=useState('')
  const dialog=useRef<HTMLDialogElement>(null)
  useEffect(()=>{const timer=setTimeout(()=>setFilters(f=>({...f,search})),200);return()=>clearTimeout(timer)},[search])
  useEffect(()=>{const controller=new AbortController();void listAdminProducts(user.id,controller.signal).then(products=>{if(!controller.signal.aborted){setData({userId:user.id,products});setError(false);setLoading(false)}}).catch(()=>{if(!controller.signal.aborted){setError(true);setLoading(false)}});return()=>controller.abort()},[user.id,revision])
  const refresh=()=>{setLoading(true);setRevision(r=>r+1)}
  const products=data?.userId===user.id?data.products:[],rows=filterProducts(products,filters)
  const setFilter=(key:keyof ProductFilters,value:string)=>setFilters(f=>({...f,[key]:value}))
  const reset=()=>{setSearch('');setFilters(emptyProductFilters)}
  const categories=[...new Map(products.filter(p=>p.category_id).map(p=>[p.category_id!,p.category])).entries()]
  const startArchive=(p:AdminProduct)=>{setSelected(p);setArchiveError(false);dialog.current?.showModal()}
  const confirmArchive=async()=>{if(!selected||saving)return;setSaving(true);try{await archiveAdminProduct(user.id,selected);dialog.current?.close();setNotice(`“${selected.name}” archived.`);refresh()}catch{setArchiveError(true)}finally{setSaving(false)}}
  return <>
    <AdminPageHeader title="Products" description="Manage Percent designs, availability and production runs."/>
    <section className="admin-panel admin-product-toolbar"><h2>All Products</h2><label className="admin-product-search"><Search/><span className="sr-only">Search products</span><input aria-label="Search products" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search products, tags, or slug…"/></label><Link className="admin-button admin-product-add" to="/admin/products/new"><Plus/> Add Product</Link></section>
    {notice&&<p className="admin-product-notice" role="status">{notice}</p>}
    {loading?<div className="admin-loading" aria-busy="true"><p role="status" className="sr-only">Loading products…</p><div className="admin-stats">{[0,1,2,3].map(i=><div key={i} className="admin-skeleton admin-stat"/>)}</div><div className="admin-skeleton admin-skeleton-panel"/></div>:error?<section className="admin-panel admin-dashboard-error" role="alert"><AdminEmptyState icon={Package} title="Unable to load products."/><button className="admin-button" onClick={refresh}>Retry <RefreshCw/></button></section>:<>
    <div className="admin-stats admin-product-stats"><AdminStatCard label="Total Products" value={String(products.length)} note="All catalog designs" icon={Package}/><AdminStatCard label="Active" value={String(products.filter(p=>p.status==='active').length)} note="Active lifecycle" icon={CheckCircle}/><AdminStatCard label="Draft" value={String(products.filter(p=>p.status==='draft').length)} note="Pending approval" icon={FileText}/><AdminStatCard label="Sold Out / Archived" value={String(products.filter(p=>p.displayStatus==='sold-out'||p.status==='archived').length)} note="Permanent designs" icon={Archive}/></div>
    <section className="admin-panel admin-product-list">
      <div className="admin-product-statuses" aria-label="Product status filters">{statusOptions.map(([value,label])=><button key={value} aria-pressed={filters.status===value} onClick={()=>setFilter('status',value)}>{label}<span>{value==='all'?products.length:products.filter(p=>p.displayStatus===value).length}</span></button>)}<button className="admin-icon-button" aria-label="Refresh products" onClick={refresh}><RefreshCw/></button></div>
      <button className="admin-button admin-product-filter-toggle" aria-expanded={showFilters} aria-controls="product-filters" onClick={()=>setShowFilters(v=>!v)}><SlidersHorizontal/> Filters &amp; sort</button>
      <div id="product-filters" className={`admin-product-filters ${showFilters?'is-open':''}`}>
        <label>Category<select value={filters.category} onChange={e=>setFilter('category',e.target.value)}><option value="all">All categories</option>{categories.map(([id,name])=><option value={id} key={id}>{name}</option>)}</select></label>
        <label>Fit<select value={filters.fit} onChange={e=>setFilter('fit',e.target.value)}><option value="all">All fits</option>{[...new Set(products.map(p=>p.fit_type))].sort().map(f=><option key={f} value={f}>{f==='standard'?'Standard':'Oversized'}</option>)}</select></label>
        <label>Availability<select value={filters.availability} onChange={e=>setFilter('availability',e.target.value)}><option value="all">All production states</option><option value="available">Available to sell</option><option value="empty">No available stock</option><option value="near">Near production limit</option></select></label>
        <label>Sort by<select value={filters.sort} onChange={e=>setFilter('sort',e.target.value)}>{[['newest','Newest'],['oldest','Oldest'],['az','Name A–Z'],['za','Name Z–A'],['price-low','Price Low–High'],['price-high','Price High–Low'],['sold','Most Sold'],['remaining','Lowest Run Remaining']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button className="admin-small-button" onClick={reset}>Clear filters</button>
      </div>
      {!products.length?<><AdminEmptyState icon={Package} title="No products yet." description="Create your first Percent design."/><Link className="admin-button" to="/admin/products/new">Add Product</Link></>:!rows.length?<><AdminEmptyState icon={Search} title="No matching products."/><button className="admin-button" onClick={reset}>Clear filters</button></>:<>
      <div className="admin-product-table-scroll" tabIndex={0} role="region" aria-label="Products table"><table className="admin-product-table"><thead><tr>{['Product','Status','Category / Fit','Price','Variants','Production','Run Remaining','Updated','Actions'].map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{rows.map(p=><tr key={p.id}><td><div className="admin-product-identity"><Thumbnail product={p}/><div><Link to={`/admin/products/${p.id}/edit`}>{p.name}</Link><small>{p.slug}</small></div></div></td><td><AdminStatusBadge status={p.displayStatus==='sold-out'?'Sold Out':p.status}/></td><td>{p.category}<small>{p.fit_type==='standard'?'Standard':'Oversized'}</small></td><td>{formatINR(p.price_paise)}</td><td>{p.variants}</td><td><Progress product={p}/></td><td>{p.remaining}<small>{p.available} available to sell</small></td><td><time dateTime={p.updated_at}>{new Date(p.updated_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</time></td><td><Actions product={p} onArchive={startArchive}/></td></tr>)}</tbody></table></div>
      <div className="admin-product-cards">{rows.map(p=><article className="admin-product-card" key={p.id}><div className="admin-product-card-top"><Thumbnail product={p}/><div><Link to={`/admin/products/${p.id}/edit`}>{p.name}</Link><small>{p.slug}</small><AdminStatusBadge status={p.displayStatus==='sold-out'?'Sold Out':p.status}/></div><Actions product={p} onArchive={startArchive}/></div><div className="admin-product-card-meta"><strong>{formatINR(p.price_paise)}</strong><span>{p.variants} variants · {p.fit_type==='standard'?'Standard':'Oversized'}</span></div><Progress product={p}/><div className="admin-product-card-meta"><span>{p.remaining} run remaining</span><span>{p.available} available to sell</span></div></article>)}</div>
      </>}
      <footer className="admin-product-list-footer">Showing {rows.length} of {products.length} products<span>Run remaining = production limit − sold. Available stock is tracked separately.</span></footer>
    </section></>}
    <dialog ref={dialog} className="admin-archive-dialog" onCancel={e=>{if(saving)e.preventDefault()}} onKeyDown={e=>{if(e.key!=='Tab')return;const buttons=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons.at(-1)?.focus()}else if(!e.shiftKey&&document.activeElement===buttons.at(-1)){e.preventDefault();buttons[0]?.focus()}}} aria-labelledby="archive-product-title"><h2 id="archive-product-title">Archive “{selected?.name}”?</h2><p>This removes the design from the storefront permanently. Archived designs cannot be restored.</p>{archiveError&&<p role="alert">Unable to archive this product. Refresh the list and try again.</p>}<div><button className="admin-button" disabled={saving} onClick={()=>dialog.current?.close()} autoFocus><X/> Cancel</button><button className="admin-button" disabled={saving} onClick={()=>void confirmArchive()}>{saving?'Archiving…':'Archive permanently'}</button></div></dialog>
  </>
}
