import { CalendarClock, CheckCircle, CircleOff, Plus, RefreshCw, Search, Tag } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listCoupons, type AdminCoupon, type CouponStatus } from '../../backend/admin/coupons'
import { formatInrFromPaise } from '../../data/money'
import { AdminEmptyState, AdminPageHeader, AdminStatCard, AdminStatusBadge } from '../../components/admin/AdminComponents'
import './coupons.css'

const statusOptions:[CouponStatus|'all',string][]=[['all','All'],['active','Active'],['scheduled','Scheduled'],['expired','Expired'],['disabled','Disabled'],['exhausted','Exhausted']]
const date=(value:string|null)=>value?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'No limit'
const value=(coupon:AdminCoupon)=>coupon.kind==='fixed'?formatInrFromPaise(coupon.amount_paise??0):`${(coupon.percent_bps??0)/100}%${coupon.maximum_discount_paise?` · max ${formatInrFromPaise(coupon.maximum_discount_paise)}`:''}`

export function AdminCoupons(){
  const [items,setItems]=useState<AdminCoupon[]>([]),[search,setSearch]=useState(''),[query,setQuery]=useState(''),[status,setStatus]=useState<CouponStatus|'all'>('all'),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0)
  useEffect(()=>{const timer=setTimeout(()=>setQuery(search),250);return()=>clearTimeout(timer)},[search])
  useEffect(()=>{let active=true;void listCoupons(query,status).then(page=>{if(active){setItems(page.items);setError('')}}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Unable to load coupons.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[query,status,revision])
  const activeCount=items.filter(c=>c.effective_status==='active').length,totalUses=items.reduce((sum,c)=>sum+Number(c.redemption_count),0)
  return <>
    <AdminPageHeader title="Coupons" description="Create and manage server-authoritative Percent discount codes."/>
    <section className="admin-panel coupon-toolbar"><div><h2>All Coupons</h2><p>Coupon changes affect future checkouts only.</p></div><label><Search/><span className="sr-only">Search coupons</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search code or description…"/></label><Link className="admin-button coupon-create" to="/admin/coupons/new"><Plus/> Create Coupon</Link></section>
    <div className="admin-stats coupon-stats"><AdminStatCard label="Coupons" value={String(items.length)} note="Matching current filters" icon={Tag}/><AdminStatCard label="Active" value={String(activeCount)} note="Usable right now" icon={CheckCircle}/><AdminStatCard label="Redemptions" value={String(totalUses)} note="Authoritative order usage" icon={CalendarClock}/><AdminStatCard label="Unavailable" value={String(items.length-activeCount)} note="Scheduled, disabled or ended" icon={CircleOff}/></div>
    <section className="admin-panel coupon-list">
      <div className="coupon-statuses" aria-label="Coupon status filters">{statusOptions.map(([key,label])=><button key={key} aria-pressed={status===key} onClick={()=>setStatus(key)}>{label}</button>)}<button className="admin-icon-button" aria-label="Refresh coupons" onClick={()=>setRevision(v=>v+1)}><RefreshCw/></button></div>
      {loading?<div className="admin-loading" aria-busy="true"><div className="admin-skeleton admin-skeleton-panel"/></div>:error?<div role="alert" className="coupon-error"><p>{error}</p><button className="admin-button" onClick={()=>setRevision(v=>v+1)}>Retry</button></div>:!items.length?<AdminEmptyState icon={Tag} title="No coupons found." description="Create a coupon or adjust the current filters."/>:<>
        <div className="coupon-table-wrap" role="region" aria-label="Coupons table" tabIndex={0}><table><thead><tr><th>Code</th><th>Type / Value</th><th>Status</th><th>Validity</th><th>Usage</th><th>Minimum order</th><th>Updated</th><th>Action</th></tr></thead><tbody>{items.map(c=><tr key={c.id}><td><strong>{c.code}</strong><small>{c.description||'No description'}</small></td><td><strong>{value(c)}</strong><small>{c.kind==='fixed'?'Fixed amount':'Percentage'}</small></td><td><AdminStatusBadge status={c.effective_status}/></td><td><span>{date(c.starts_at)}</span><small>to {date(c.ends_at)}</small></td><td><strong>{c.redemption_count}{c.total_usage_limit!==null?` / ${c.total_usage_limit}`:''}</strong><small>{c.per_customer_usage_limit?`${c.per_customer_usage_limit} per customer`:'No customer limit'}</small></td><td>{formatInrFromPaise(c.minimum_subtotal_paise)}</td><td>{date(c.updated_at)}</td><td><Link className="admin-small-button" to={`/admin/coupons/${c.id}/edit`}>Edit</Link></td></tr>)}</tbody></table></div>
        <div className="coupon-cards">{items.map(c=><article key={c.id}><header><div><strong>{c.code}</strong><small>{c.description||'No description'}</small></div><AdminStatusBadge status={c.effective_status}/></header><dl><div><dt>Value</dt><dd>{value(c)}</dd></div><div><dt>Usage</dt><dd>{c.redemption_count}{c.total_usage_limit!==null?` / ${c.total_usage_limit}`:''}</dd></div><div><dt>Minimum</dt><dd>{formatInrFromPaise(c.minimum_subtotal_paise)}</dd></div><div><dt>Ends</dt><dd>{date(c.ends_at)}</dd></div></dl><Link className="admin-button" to={`/admin/coupons/${c.id}/edit`}>Edit coupon</Link></article>)}</div>
      </>}
    </section>
  </>
}
