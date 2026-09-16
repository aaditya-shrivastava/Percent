import { useEffect, useRef, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { ArrowLeft, Box, CreditCard, MapPin, PackageSearch, RefreshCw, Truck, UserRound } from 'lucide-react'
import type { AdminIdentity } from '../../components/admin/AdminRouteGuard'
import { AdminEmptyState, AdminPageHeader } from '../../components/admin/AdminComponents'
import { loadAdminOrder, loadOrderHistory, OrderConflict, updateOrderLifecycle } from '../../backend/admin/orders'
import { money, orderCustomer, orderLifecycleActions, shippingAddress, type AdminOrder, type LifecycleAction, type OrderHistoryRow } from '../../backend/admin/order-model'
import './orders.css'
import './order-lifecycle.css'

const pretty = (value:string) => value.replaceAll('_', ' ')
const fullDate = (value:string) => new Intl.DateTimeFormat('en-IN', { dateStyle:'long', timeStyle:'short' }).format(new Date(value))

function LifecycleDialog({order,action,reason,note,error,busy,onReason,onNote,onClose,onConfirm}:{
 order:AdminOrder;action:LifecycleAction;reason:string;note:string;error:string;busy:boolean
 onReason:(value:string)=>void;onNote:(value:string)=>void;onClose:()=>void;onConfirm:()=>void
}){
 const dialog=useRef<HTMLDialogElement>(null)
 useEffect(()=>{const previous=document.activeElement;dialog.current?.showModal();return()=>{if(previous instanceof HTMLElement)previous.focus()}},[])
 const cancellation=action.next==='cancelled'
 return <dialog ref={dialog} className="order-lifecycle-dialog" aria-labelledby="lifecycle-dialog-title"
  onCancel={event=>{event.preventDefault();if(!busy)onClose()}}
  onKeyDown={event=>{
   if(event.key!=='Tab')return
   const targets=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled)'))
   if(event.shiftKey&&document.activeElement===targets[0]){event.preventDefault();targets.at(-1)?.focus()}
   else if(!event.shiftKey&&document.activeElement===targets.at(-1)){event.preventDefault();targets[0]?.focus()}
  }}>
  <h2 id="lifecycle-dialog-title">{action.label}?</h2>
  <p>Order {order.order_reference}</p>
  <dl><div><dt>Current</dt><dd>{pretty(action.dimension==='order_status'?order.status:order.fulfillment_status)}</dd></div><div><dt>Next</dt><dd>{pretty(action.next)}</dd></div></dl>
  {cancellation&&<p className="order-cancel-warning">Cancellation does not issue a refund, restore inventory, or cancel a shipment automatically.</p>}
  <label htmlFor="lifecycle-reason">{cancellation?'Cancellation reason':'Reason (optional)'}</label>
  <input id="lifecycle-reason" value={reason} maxLength={500} aria-invalid={!!error} aria-describedby={error?'lifecycle-reason-error':undefined} onChange={event=>onReason(event.target.value)}/>
  {error&&<p id="lifecycle-reason-error" role="alert">{error}</p>}
  <label htmlFor="lifecycle-note">Internal Admin note (optional)</label>
  <textarea id="lifecycle-note" value={note} maxLength={2000} rows={3} onChange={event=>onNote(event.target.value)}/>
  <small>Visible only to administrators and immutable after submission.</small>
  <div className="order-dialog-actions"><button autoFocus className="admin-button" disabled={busy} onClick={onClose}>Cancel</button><button className="admin-button order-confirm-action" disabled={busy} onClick={onConfirm}>{busy?'Saving…':action.label}</button></div>
 </dialog>
}

function OrderHistory({order,history}:{order:AdminOrder;history:OrderHistoryRow[]}){
 const events=[
  {id:'created',at:order.created_at,label:'Order created',previous:'',next:'',actor:'',reason:'',note:''},
  ...history.map(row=>({id:row.id,at:row.created_at,label:row.dimension==='order_status'?'Order status changed':'Fulfillment status changed',previous:row.previous_value,next:row.next_value,actor:row.actor_name,reason:row.reason??'',note:row.internal_note??''})),
  ...(order.delivered_at?[{id:'delivery',at:order.delivered_at,label:'Delivery timestamp recorded',previous:'',next:'',actor:'',reason:'',note:''}]:[]),
 ].sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id))
 return <section className="admin-panel order-section"><header><PackageSearch/><div><h2>Order History</h2><p>Stored lifecycle changes and explicit order timestamps.</p></div></header>
  <ol className="order-history">{events.map(event=><li key={event.id}><div><strong>{event.label}</strong><time dateTime={event.at}>{fullDate(event.at)}</time></div>{event.previous&&<p>{pretty(event.previous)} → {pretty(event.next)}</p>}{event.actor&&<small>By {event.actor}</small>}{event.reason&&<small>Reason: {event.reason}</small>}{event.note&&<details><summary>Internal Admin note</summary><p>{event.note}</p></details>}</li>)}</ol>
  {!history.length&&<p>No Phase 4B lifecycle changes have been recorded for this order.</p>}
 </section>
}

export function AdminOrderDetail(){
 const {id=''}=useParams(),{user}=useOutletContext<AdminIdentity>()
 const [order,setOrder]=useState<AdminOrder|null>(),[history,setHistory]=useState<OrderHistoryRow[]>([]),[loadError,setLoadError]=useState(false),[revision,setRevision]=useState(0)
 const [action,setAction]=useState<LifecycleAction>(),[reason,setReason]=useState(''),[note,setNote]=useState(''),[reasonError,setReasonError]=useState(''),[busy,setBusy]=useState(false)
 const [mutationError,setMutationError]=useState(''),[conflict,setConflict]=useState(false),[notice,setNotice]=useState('')
 const actionTrigger=useRef<HTMLButtonElement>(null)
 const refresh=()=>{setOrder(undefined);setRevision(value=>value+1)}
 useEffect(()=>{
  const controller=new AbortController()
  Promise.all([loadAdminOrder(user.id,id,controller.signal),loadOrderHistory(user.id,id,controller.signal)])
   .then(([nextOrder,nextHistory])=>{if(!controller.signal.aborted){setOrder(nextOrder);setHistory(nextHistory);setLoadError(false)}})
   .catch(()=>{if(!controller.signal.aborted){setOrder(null);setLoadError(true)}})
  return()=>controller.abort()
 },[user.id,id,revision])
 const closeAction=()=>{setAction(undefined);requestAnimationFrame(()=>actionTrigger.current?.focus())}
 const selectAction=(next:LifecycleAction,trigger:HTMLButtonElement)=>{actionTrigger.current=trigger;setAction(next);setReason('');setNote('');setReasonError('');setMutationError('');setConflict(false)}
 const submit=async()=>{
  if(!order||!action||busy)return
  if(action.next==='cancelled'&&!reason.trim()){setReasonError('A cancellation reason is required.');return}
  setReasonError('');setBusy(true)
  try{
   await updateOrderLifecycle(user.id,order,action.dimension,action.next,reason,note)
   closeAction();setNotice('Order lifecycle updated.');setMutationError('');setConflict(false);refresh()
  }catch(error){
   setMutationError(error instanceof Error?error.message:'Lifecycle action failed.')
   setConflict(error instanceof OrderConflict);closeAction()
  }finally{setBusy(false)}
 }
 if(order===undefined)return <div className="admin-loading" aria-busy="true"><p role="status">Loading order…</p></div>
 if(loadError)return <section className="admin-panel order-detail-state" role="alert"><AdminEmptyState icon={PackageSearch} title="Unable to load this order."/><button className="admin-button" onClick={refresh}>Retry <RefreshCw/></button></section>
 if(!order)return <section className="admin-panel order-detail-state"><AdminEmptyState icon={PackageSearch} title="Order not found." description="The order ID is invalid or the record is unavailable."/><Link className="admin-button" to="/admin/orders"><ArrowLeft/> Back to Orders</Link></section>

 const customer=orderCustomer(order),address=shippingAddress(order),actions=orderLifecycleActions(order)
 return <>
  <AdminPageHeader title={order.order_reference} description="Order lifecycle and purchase-time records."/>
  <Link className="order-back" to="/admin/orders"><ArrowLeft/> Back to Orders</Link>
  {notice&&<p className="order-lifecycle-notice" role="status">{notice}</p>}
  {mutationError&&<div className="order-lifecycle-error" role="alert"><p>{mutationError}</p>{conflict&&<div><button className="admin-button" onClick={()=>{setConflict(false);setMutationError('');refresh()}}>Reload Latest</button><button className="admin-button" onClick={()=>{setConflict(false);setMutationError('')}}>Stay on Page</button></div>}</div>}
  <section className="admin-panel order-hero"><div><span>Placed {fullDate(order.created_at)}</span><h2>{customer.name}</h2><strong>{money(order.total_paise,order.currency)}</strong></div><div className="order-current-statuses"><span>Order: {pretty(order.status)}</span><span>Payment: {pretty(order.payment_status)}</span><span>Fulfillment: {pretty(order.fulfillment_status)}</span></div></section>
  <div className="order-detail-grid">
   <main>
    <section className="admin-panel order-section"><header><Box/><div><h2>Order Items</h2><p>Purchase-time item snapshots</p></div></header>
     {order.items.length?<div className="order-items">{order.items.map(item=><article key={item.id}>{item.image_url?<img src={item.image_url} alt=""/>:<span className="order-image-missing" aria-hidden="true">%</span>}<div><strong>{item.product_name}</strong><span>{item.colour} · {item.size}</span><small>SKU {item.sku} · Quantity {item.quantity}</small></div><div><span>{money(item.unit_price_paise,order.currency)} each</span><strong>{money(Number(item.line_total_paise??item.unit_price_paise*item.quantity),order.currency)}</strong></div></article>)}</div>:<p>No item records are attached to this order.</p>}
    </section>
    <section className="admin-panel order-section order-lifecycle-actions"><header><PackageSearch/><div><h2>Order Actions</h2><p>Only valid internal lifecycle steps are available.</p></div></header>
     <dl><div><dt>Order status</dt><dd>{pretty(order.status)}</dd></div><div><dt>Payment status</dt><dd>{pretty(order.payment_status)} · read-only until trusted payment integration</dd></div><div><dt>Fulfillment status</dt><dd>{pretty(order.fulfillment_status)}</dd></div></dl>
     {actions.length?<div className="order-action-buttons">{actions.map(next=><button className="admin-button" key={next.dimension+next.next} disabled={busy} onClick={event=>selectAction(next,event.currentTarget)}>{next.label}</button>)}</div>:<p>No Admin lifecycle actions are available for this state.</p>}
    </section>
    <section className="admin-panel order-section"><header><CreditCard/><div><h2>Pricing</h2><p>Stored historical totals</p></div></header><dl className="order-pricing"><div><dt>Subtotal</dt><dd>{money(order.subtotal_paise,order.currency)}</dd></div><div><dt>Discount{order.coupon_code_snapshot?` · ${order.coupon_code_snapshot}`:''}</dt><dd>− {money(order.discount_paise,order.currency)}</dd></div><div><dt>Shipping</dt><dd>{money(order.shipping_paise,order.currency)}</dd></div><div><dt>Tax</dt><dd>{money(order.tax_paise,order.currency)}</dd></div><div><dt>Total</dt><dd>{money(order.total_paise,order.currency)}</dd></div></dl></section>
   </main>
   <aside>
    <section className="admin-panel order-section"><header><UserRound/><div><h2>Customer</h2><p>Order-time contact</p></div></header><dl><div><dt>Name</dt><dd>{customer.name}</dd></div><div><dt>Email</dt><dd>{customer.email||'Unavailable'}</dd></div><div><dt>Phone</dt><dd>{customer.phone||'Unavailable'}</dd></div></dl></section>
    <section className="admin-panel order-section"><header><MapPin/><div><h2>Delivery Address</h2><p>Immutable order snapshot</p></div></header>{address?<address>{address.full_name}<br/>{address.address_line1}<br/>{address.address_line2&&<>{address.address_line2}<br/></>}{address.city}, {address.state} {address.pin_code}<br/>{address.country}</address>:<p>No delivery address record.</p>}</section>
    <section className="admin-panel order-section"><header><CreditCard/><div><h2>Payment</h2><p>Read-only payment record</p></div></header><dl><div><dt>Status</dt><dd>{pretty(order.payment_status)}</dd></div><div><dt>Provider</dt><dd>{order.payment_provider??'No payment provider'}</dd></div><div><dt>Reference</dt><dd>{order.payment_reference??'No payment record'}</dd></div></dl></section>
    <section className="admin-panel order-section"><header><Truck/><div><h2>Shipping</h2><p>Read-only fulfillment record</p></div></header><dl><div><dt>Status</dt><dd>{pretty(order.fulfillment_status)}</dd></div><div><dt>Provider</dt><dd>{order.shipping_provider??'Shipping integration not connected'}</dd></div><div><dt>Tracking</dt><dd>{order.tracking_number??'No tracking number'}</dd></div><div><dt>Estimated delivery</dt><dd>{order.estimated_delivery??'Not available'}</dd></div></dl></section>
    <OrderHistory order={order} history={history}/>
   </aside>
  </div>
  {action&&<LifecycleDialog order={order} action={action} reason={reason} note={note} error={reasonError} busy={busy} onReason={value=>{setReason(value);setReasonError('')}} onNote={setNote} onClose={closeAction} onConfirm={()=>void submit()}/>}
 </>
}
