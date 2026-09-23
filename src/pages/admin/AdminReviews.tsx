import { useEffect,useRef,useState } from 'react'
import { Link,useOutletContext } from 'react-router-dom'
import { Eye,EyeOff,Image as ImageIcon,MessageSquare,RefreshCw,Search,Sparkles,Star } from 'lucide-react'
import type { AdminIdentity } from '../../components/admin/AdminRouteGuard'
import { AdminEmptyState,AdminPageHeader,AdminStatCard } from '../../components/admin/AdminComponents'
import { listAdminReviews,loadAdminReviewImages,setReviewVisibility } from '../../backend/admin/reviews'
import { emptyReviewFilters,reviewPageSize,reviewVisibility,type AdminReview,type ReviewFilters,type ReviewListResult,type ReviewStatus } from '../../backend/admin/review-model'
import './reviews.css'

const date=(value:string)=>new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))
const statusFilters:Array<[ReviewFilters['status'],string]>=[['all','All'],['approved','Shown'],['rejected','Hidden'],['pending','New']]
const sorts:Array<[ReviewFilters['sort'],string]>=[['newest','Newest'],['oldest','Oldest'],['highest_rating','Highest Rating'],['lowest_rating','Lowest Rating']]

function Rating({value}:{value:number}){
 return <span className="review-rating" aria-label={`${value} out of 5 stars`}><span aria-hidden="true">{'★'.repeat(value)}{'☆'.repeat(5-value)}</span><small>{value}/5</small></span>
}

function VisibilityBadge({status}:{status:ReviewStatus}){
 const visibility=reviewVisibility(status),label=visibility==='shown'?'Shown':visibility==='hidden'?'Hidden':'New'
 const tone=visibility==='shown'?'success':visibility==='hidden'?'danger':'warning'
 return <span className={`admin-badge is-${tone}`}>{label}</span>
}

function ReviewInspection({review,onClose,onChanged}:{review:AdminReview;onClose:()=>void;onChanged:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),close=useRef<HTMLButtonElement>(null),returnFocus=useRef<HTMLElement|null>(document.activeElement as HTMLElement|null)
 const [images,setImages]=useState(review.images),[imageError,setImageError]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const visible=review.status==='approved',actionLabel=visible?'Hide Review':'Show Review'
 useEffect(()=>{const node=dialog.current,focusTarget=returnFocus.current;node?.showModal();close.current?.focus();return()=>{if(node?.open)node.close();focusTarget?.focus()}},[])
 useEffect(()=>{let active=true;if(review.images.length)loadAdminReviewImages(review.id).then(next=>{if(active)setImages(next)}).catch(()=>{if(active)setImageError(true)});return()=>{active=false}},[review.id,review.images.length])
 const apply=async()=>{if(busy)return;setBusy(true);setError('');try{await setReviewVisibility(review,!visible);onChanged()}catch(e){setError(e instanceof Error?e.message:'Visibility update failed');if((e as {code?:string}).code==='PT409')onChanged()}finally{setBusy(false)}}
 return <dialog ref={dialog} className="review-dialog" aria-labelledby="review-inspection-title" onCancel={e=>{e.preventDefault();onClose()}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
  <div className="review-dialog-card">
   <header><div><p>Review inspection</p><h2 id="review-inspection-title">{review.title||'Untitled review'}</h2></div><button ref={close} type="button" aria-label="Close review inspection" onClick={onClose}>×</button></header>
   <div className="review-dialog-meta"><VisibilityBadge status={review.status}/><Rating value={review.rating}/><time dateTime={review.created_at}>{date(review.created_at)}</time></div>
   <dl><div><dt>Customer</dt><dd><Link to={`/admin/customers/${review.user_id}`}>{review.customer_name}</Link></dd></div><div><dt>Product</dt><dd><Link to={`/admin/products/${review.product_id}/edit`}>{review.product_name}</Link></dd></div></dl>
   <section><h3>Customer review</h3><p>{review.body}</p></section>
   <section><h3>Submitted images <span>{review.images.length}</span></h3>{imageError?<p className="review-error" role="alert">Review images could not be securely loaded.</p>:review.images.length&&!images.some(image=>image.src)?<p role="status">Signing review images…</p>:images.length?<div className="review-images">{images.map(image=><a key={image.id} href={image.src} target="_blank" rel="noreferrer"><img src={image.src} alt={image.alt||`Customer review image ${image.slot}`}/></a>)}</div>:<p>No images submitted.</p>}</section>
   {error&&<p className="review-error" role="alert">{error}</p>}
   <footer><button className="admin-button" type="button" onClick={onClose}>Close</button><button className={`admin-button ${visible?'review-hide':'review-show'}`} type="button" disabled={busy} onClick={()=>void apply()}>{busy?'Working…':actionLabel}</button></footer>
  </div>
 </dialog>
}

function ReviewCards({items,onOpen}:{items:AdminReview[];onOpen:(review:AdminReview,trigger:HTMLElement)=>void}){
 return <div className="review-cards">{items.map(review=><article key={review.id}><header><div><strong>{review.customer_name}</strong><Link to={`/admin/products/${review.product_id}/edit`}>{review.product_name}</Link></div><VisibilityBadge status={review.status}/></header><Rating value={review.rating}/><h3>{review.title||'Untitled review'}</h3><p>{review.body}</p><dl><div><dt>Submitted</dt><dd>{date(review.created_at)}</dd></div><div><dt>Images</dt><dd>{review.images.length}</dd></div></dl><button className="admin-button" onClick={e=>onOpen(review,e.currentTarget)}>Inspect review</button></article>)}</div>
}

export function AdminReviews(){
 const {user}=useOutletContext<AdminIdentity>(),[search,setSearch]=useState(''),[filters,setFilters]=useState(emptyReviewFilters),[page,setPage]=useState(1),[revision,setRevision]=useState(0),[result,setResult]=useState<ReviewListResult>(),[error,setError]=useState(false),[selected,setSelected]=useState<AdminReview|null>(null)
 const trigger=useRef<HTMLElement|null>(null)
 useEffect(()=>{const timer=setTimeout(()=>{setResult(undefined);setFilters(current=>({...current,search}));setPage(1)},250);return()=>clearTimeout(timer)},[search])
 useEffect(()=>{const controller=new AbortController();listAdminReviews(user.id,filters,page,controller.signal).then(data=>{if(!controller.signal.aborted){setResult(data);setError(false);setSelected(current=>current?data.items.find(item=>item.id===current.id)??null:null)}}).catch(()=>{if(!controller.signal.aborted)setError(true)});return()=>controller.abort()},[user.id,filters,page,revision])
 const update=<K extends keyof ReviewFilters>(key:K,value:ReviewFilters[K])=>{setResult(undefined);setFilters(current=>({...current,[key]:value}));setPage(1)}
 const open=(review:AdminReview,element:HTMLElement)=>{trigger.current=element;setSelected(review)}
 const close=()=>{setSelected(null);requestAnimationFrame(()=>trigger.current?.focus())}
 const pages=Math.max(1,Math.ceil((result?.count??0)/reviewPageSize)),metrics=result?.metrics
 return <><AdminPageHeader title="Reviews" description="Inspect customer feedback and control what appears publicly."/>
  <div className="admin-stats review-stats"><AdminStatCard label="Total Reviews" value={String(metrics?.total??0)} note="All submitted reviews" icon={MessageSquare}/><AdminStatCard label="Shown" value={String(metrics?.approved??0)} note="Visible when product rules allow" icon={Eye}/><AdminStatCard label="Hidden" value={String(metrics?.rejected??0)} note="Not visible on the storefront" icon={EyeOff}/><AdminStatCard label="New / Not Shown" value={String(metrics?.pending??0)} note="Awaiting a visibility decision" icon={Sparkles}/><AdminStatCard label="Average Rating" value={metrics?.approved_average_rating==null?'—':metrics.approved_average_rating.toFixed(1)} note="Shown reviews only" icon={Star}/></div>
  <section className="admin-panel review-list"><header><div><h2>Customer Reviews</h2><p>Customer content is read-only. Show or hide reviews without changing their submission.</p></div><button className="admin-icon-button" aria-label="Refresh reviews" onClick={()=>{setResult(undefined);setRevision(value=>value+1)}}><RefreshCw/></button></header>
   <div className="review-toolbar"><label className="review-search"><Search/><span className="sr-only">Search reviews</span><input aria-label="Search reviews" placeholder="Customer, product, title, or review…" value={search} onChange={e=>setSearch(e.target.value)}/></label><label><span>Visibility</span><select value={filters.status} onChange={e=>update('status',e.target.value as ReviewFilters['status'])}>{statusFilters.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label><span>Rating</span><select value={filters.rating} onChange={e=>update('rating',e.target.value==='all'?'all':Number(e.target.value) as ReviewFilters['rating'])}><option value="all">All Ratings</option>{[5,4,3,2,1].map(value=><option key={value} value={value}>{value} stars</option>)}</select></label><label><span>Sort</span><select value={filters.sort} onChange={e=>update('sort',e.target.value as ReviewFilters['sort'])}>{sorts.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>
   {!result&&!error?<div className="admin-loading" aria-busy="true"><p role="status">Loading reviews…</p></div>:error?<div className="review-state" role="alert"><AdminEmptyState icon={MessageSquare} title="Unable to load reviews."/><button className="admin-button" onClick={()=>{setError(false);setResult(undefined);setRevision(value=>value+1)}}>Retry</button></div>:result&&!result.items.length?<AdminEmptyState icon={MessageSquare} title={filters.search||filters.status!=='all'||filters.rating!=='all'?'No matching reviews.':'No reviews submitted yet.'} description="Real customer submissions will appear here."/>:result&&<><div className="review-table" role="region" aria-label="Reviews table" tabIndex={0}><table><thead><tr>{['Customer / Product','Rating','Review','Visibility','Submitted','Images',''].map(label=><th key={label} scope="col">{label||<span className="sr-only">Action</span>}</th>)}</tr></thead><tbody>{result.items.map(review=><tr key={review.id}><td><strong>{review.customer_name}</strong><Link to={`/admin/products/${review.product_id}/edit`}>{review.product_name}</Link></td><td><Rating value={review.rating}/></td><td><strong>{review.title||'Untitled review'}</strong><p>{review.body}</p></td><td><VisibilityBadge status={review.status}/></td><td><time dateTime={review.created_at}>{date(review.created_at)}</time></td><td><span className="review-image-count"><ImageIcon/>{review.images.length}</span></td><td><button className="admin-button" onClick={e=>open(review,e.currentTarget)}>Inspect</button></td></tr>)}</tbody></table></div><ReviewCards items={result.items} onOpen={open}/><footer><span>{result.count?`Showing ${(page-1)*reviewPageSize+1}–${Math.min(page*reviewPageSize,result.count)} of ${result.count}`:'0 reviews'}</span><nav aria-label="Reviews pagination"><button disabled={page<=1} onClick={()=>{setResult(undefined);setPage(value=>value-1)}}>Previous</button><span>Page {page} of {pages}</span><button disabled={page>=pages} onClick={()=>{setResult(undefined);setPage(value=>value+1)}}>Next</button></nav></footer></>}
  </section>{selected&&<ReviewInspection key={`${selected.id}:${selected.updated_at}`} review={selected} onClose={close} onChanged={()=>{setResult(undefined);setRevision(value=>value+1)}}/>}</>
}
