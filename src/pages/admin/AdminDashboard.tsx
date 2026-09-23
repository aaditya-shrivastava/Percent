import { useEffect, useState } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, BarChart3, CalendarDays, CircleCheck, Image, IndianRupee, Package, Plus, ReceiptText, RefreshCw, ShoppingBag, Users, Activity, MoreVertical } from 'lucide-react'
import { AdminEmptyState, AdminPageHeader, AdminStatCard, AdminStatusBadge } from '../../components/admin/AdminComponents'
import type { AdminIdentity } from '../../components/admin/AdminRouteGuard'
import { loadDashboard, startOfRange, type DashboardData, type DateRange } from '../../backend/admin/dashboard'

import { formatInrFromPaise as money } from '../../data/money'
const number=(value:number)=>new Intl.NumberFormat('en-IN').format(value)
const shortDate=(value:string)=>new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric'}).format(new Date(value))
const rangeLabels:Record<DateRange,string>={'7':'Last 7 days','30':'Last 30 days','90':'Last 90 days',all:'All time'}

function SalesChart({sales}:{sales:DashboardData['sales']}) {
  const max=Math.max(...sales.map(s=>s.paise),1)
  return <div className="admin-real-chart" aria-label="Revenue from completed, paid orders by day"><div className="admin-chart-bars">{sales.map(s=><div className="admin-chart-column" key={s.date}><span className="admin-chart-value">{money(s.paise)}</span><div className="admin-chart-bar" style={{height:`${Math.max(2,s.paise/max*100)}%`}} title={`${shortDate(s.date)}: ${money(s.paise)}`}/><time dateTime={s.date}>{new Date(s.date).toLocaleDateString('en-IN',{month:'short',day:'numeric'})}</time></div>)}</div></div>
}

function DashboardContent({data,range}:{data:DashboardData;range:DateRange}) {
  return <>
    <div className="admin-stats">
      <AdminStatCard icon={IndianRupee} label="Revenue" value={money(data.revenuePaise)} note="Completed, paid orders"/>
      <AdminStatCard icon={ShoppingBag} label="Orders" value={number(data.orderCount)} note={rangeLabels[range]}/>
      <AdminStatCard icon={Users} label="Registered Accounts" value={number(data.registeredAccounts)} note="All time · includes staff"/>
      <AdminStatCard icon={Package} label="Products Live" value={number(data.liveProducts)} note={`${number(data.draftProducts)} draft designs · current`}/>
    </div>
    <div className="admin-dashboard-grid">
      <div className="admin-dashboard-main">
        <section className="admin-panel admin-sales"><header className="admin-panel-header"><h2>Sales Overview</h2><span className="admin-period-label">{rangeLabels[range]}</span></header><div className="admin-sales-total"><span>Total revenue</span><strong>{money(data.revenuePaise)}</strong><small>Completed, paid orders</small></div>
          {data.sales.length?<SalesChart sales={data.sales}/>:<div className="admin-chart-empty"><div className="admin-chart-grid" aria-hidden="true"/><AdminEmptyState icon={BarChart3} title="No sales data yet." description="Revenue analytics will appear after live checkout begins."/></div>}
        </section>
        <section className="admin-panel admin-orders"><header className="admin-panel-header"><h2>Recent Orders</h2><Link to="/admin/orders">View All <ArrowRight/></Link></header><div className="admin-table-wrap" tabIndex={0} role="region" aria-label="Recent orders table"><table className="admin-table"><thead><tr><th>Order #</th><th>Customer</th><th>Products</th><th>Amount</th><th>Status</th><th>Date</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{data.recentOrders.map(o=><tr key={o.id}><td>{o.order_reference}</td><td>{o.customer}</td><td title={o.products}>{o.products}</td><td>{money(o.total_paise)}</td><td><AdminStatusBadge status={o.status}/></td><td>{shortDate(o.created_at)}</td><td><details className="admin-row-menu"><summary aria-label={`Actions for ${o.order_reference}`}><MoreVertical/></summary><Link to={`/admin/orders?order=${encodeURIComponent(o.id)}`}>View order <ArrowUpRight/></Link></details></td></tr>)}</tbody></table></div>{!data.recentOrders.length&&<AdminEmptyState icon={ReceiptText} title="No orders yet." description="Your latest orders will appear here."/>}</section>
      </div>
      <div className="admin-dashboard-aside">
        <section className="admin-panel admin-quick"><header className="admin-panel-header"><h2>Quick Actions</h2></header><div className="admin-quick-grid">{[{title:'Add Product',description:'Create a new product in your catalog',path:'/admin/products',icon:Package},{title:'Publish Banner',description:'Update your homepage or collection banner',path:'/admin/website',icon:Image},{title:'Review Orders',description:'Check and process pending orders',path:'/admin/orders',icon:ReceiptText}].map(({title,description,path,icon:Icon})=><Link className="admin-quick-action" key={path} to={path}><Icon/><strong>{title}</strong><p>{description}</p><span><ArrowRight/></span></Link>)}</div></section>
        <section className="admin-panel admin-stock"><header className="admin-panel-header"><h2>Alerts &amp; Stock</h2><Link to="/admin/inventory">View All <ArrowRight/></Link></header>{data.alerts.length?<div className="admin-stock-list">{data.alerts.slice(0,3).map(a=><article key={a.id} className="admin-stock-row"><span className="admin-stock-icon"><Package/></span><div><strong>{a.name}</strong><AdminStatusBadge status={a.kind}/><p>{a.sold} / {a.limit} sold · {a.remaining} remaining</p><small>{a.allocated} allocated</small></div><Link className="admin-small-button" to={`/admin/inventory?product=${a.id}`}>View stock</Link></article>)}</div>:<AdminEmptyState icon={CircleCheck} title="No stock alerts." description="Stock alerts appear when approved designs have inventory."/>}<div className="admin-stock-summary"><Link to="/admin/products"><span>{data.draftProducts}</span> draft designs <ArrowUpRight/></Link><Link to="/admin/reviews"><span>{data.pendingReviews}</span> pending reviews <ArrowUpRight/></Link></div></section>
        <section className="admin-panel admin-activity"><header className="admin-panel-header"><h2>Recent Activity</h2><span className="admin-muted">Not connected</span></header><AdminEmptyState icon={Activity} title="No recent administrative activity to display." description="The activity feed is not connected yet."/></section>
      </div>
    </div>
  </>
}

export function AdminDashboard() {
  const {user}=useOutletContext<AdminIdentity>()
  const [params,setParams]=useSearchParams()
  const requestedRange=params.get('range')
  const range:DateRange=requestedRange==='7'||requestedRange==='90'||requestedRange==='all'?requestedRange:'30'
  const setRange=(value:DateRange)=>setParams(previous=>{previous.set('range',value);return previous},{replace:true})
  const [revision,setRevision]=useState(0)
  const [state,setState]=useState<{range:DateRange;revision:number;userId:string;data?:DashboardData;error?:boolean}>()
  useEffect(()=>{
    const controller=new AbortController()
    void loadDashboard(user.id,range,controller.signal).then(data=>{if(!controller.signal.aborted)setState({range,revision,userId:user.id,data})}).catch(()=>{if(!controller.signal.aborted)setState({range,revision,userId:user.id,error:true})})
    return()=>controller.abort()
  },[user.id,range,revision])
  const current=state?.range===range&&state.revision===revision&&state.userId===user.id?state:undefined
  const start=startOfRange(range)
  return <>
    <AdminPageHeader title="Dashboard" description={`Welcome back, ${user.displayName}. Here’s what's happening with Percent today.`}><label className="admin-date-select"><CalendarDays/><span className="sr-only">Dashboard date range</span><select aria-label="Dashboard date range" value={range} onChange={e=>setRange(e.target.value as DateRange)}>{Object.entries(rangeLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></AdminPageHeader>
    <div className="admin-data-caption"><span>{start?`${shortDate(start)} – ${shortDate(new Date().toISOString())}`:'All recorded history'} · sales and orders</span><button className="admin-icon-button" aria-label="Refresh dashboard" onClick={()=>setRevision(r=>r+1)}><RefreshCw/></button></div>
    {current?.error?<section className="admin-panel admin-dashboard-error" role="alert"><AdminEmptyState icon={BarChart3} title="Unable to load dashboard data." description="Please try again in a moment."/><button className="admin-button" onClick={()=>setRevision(r=>r+1)}>Retry <RefreshCw/></button></section>:current?.data?<DashboardContent data={current.data} range={range}/>:<div className="admin-loading" aria-busy="true"><p className="sr-only" role="status">Loading dashboard data…</p><div className="admin-stats">{[0,1,2,3].map(i=><div key={i} className="admin-skeleton admin-stat"/>)}</div><div className="admin-dashboard-grid"><div className="admin-skeleton admin-skeleton-panel"/><div className="admin-skeleton admin-skeleton-panel"/></div></div>}
    <Link className="admin-mobile-add" to="/admin/products"><Plus/> Add Product</Link>
  </>
}
