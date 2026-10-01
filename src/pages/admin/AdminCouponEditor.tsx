import { ArrowLeft, Save, Tag } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getCoupon, paiseToInput, parseInrToPaise, parsePercentToBps, percentToInput, saveCoupon, type CouponKind } from '../../backend/admin/coupons'
import { AdminPageHeader } from '../../components/admin/AdminComponents'
import './coupons.css'

interface FormState {code:string;description:string;kind:CouponKind;value:string;minimum:string;maximum:string;startsAt:string;endsAt:string;totalLimit:string;customerLimit:string;enabled:boolean;updatedAt?:string}
const empty:FormState={code:'',description:'',kind:'percentage',value:'',minimum:'0',maximum:'',startsAt:'',endsAt:'',totalLimit:'',customerLimit:'',enabled:false}
const localDate=(value:string|null)=>value?new Date(new Date(value).getTime()-new Date(value).getTimezoneOffset()*60000).toISOString().slice(0,16):''
const iso=(value:string)=>value?new Date(value).toISOString():null
const optionalPositive=(value:string,label:string)=>{if(!value.trim())return null;if(!/^\d+$/.test(value)||Number(value)<=0)throw new Error(`${label} must be a positive whole number.`);return Number(value)}

export function AdminCouponEditor(){
  const {id}=useParams(),editing=Boolean(id),navigate=useNavigate()
  const [form,setForm]=useState<FormState>(empty),[loading,setLoading]=useState(editing),[saving,setSaving]=useState(false),[error,setError]=useState('')
  useEffect(()=>{if(!id)return;let active=true;void getCoupon(id).then(c=>{if(active)setForm({code:c.code,description:c.description,kind:c.kind,value:c.kind==='fixed'?paiseToInput(c.amount_paise):percentToInput(c.percent_bps),minimum:paiseToInput(c.minimum_subtotal_paise),maximum:paiseToInput(c.maximum_discount_paise),startsAt:localDate(c.starts_at),endsAt:localDate(c.ends_at),totalLimit:c.total_usage_limit?.toString()??'',customerLimit:c.per_customer_usage_limit?.toString()??'',enabled:c.active,updatedAt:c.updated_at})}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Unable to load coupon.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[id])
  const set=<K extends keyof FormState>(key:K,value:FormState[K])=>setForm(current=>({...current,[key]:value}))
  const submit=async(event:FormEvent)=>{event.preventDefault();if(saving)return;setError('');setSaving(true);try{
    const minimum=parseInrToPaise(form.minimum),fixed=form.kind==='fixed'?parseInrToPaise(form.value):null,percentage=form.kind==='percentage'?parsePercentToBps(form.value):null,maximum=form.kind==='percentage'?parseInrToPaise(form.maximum,true):null
    if(form.endsAt&&form.startsAt&&new Date(form.endsAt)<=new Date(form.startsAt))throw new Error('Valid until must be after valid from.')
    await saveCoupon({id,code:form.code,description:form.description,kind:form.kind,amountPaise:fixed,percentBps:percentage,minimumOrderPaise:minimum??0,maximumDiscountPaise:maximum,startsAt:iso(form.startsAt),endsAt:iso(form.endsAt),totalUsageLimit:optionalPositive(form.totalLimit,'Total usage limit'),perCustomerUsageLimit:optionalPositive(form.customerLimit,'Per-customer limit'),enabled:form.enabled,expectedUpdatedAt:form.updatedAt})
    navigate('/admin/coupons',{replace:true})
  }catch(e){setError(e instanceof Error?e.message:'Unable to save coupon.')}finally{setSaving(false)}}
  if(loading)return <div className="admin-loading" aria-busy="true"><div className="admin-skeleton admin-skeleton-panel"/></div>
  return <>
    <AdminPageHeader title={editing?'Edit Coupon':'Create Coupon'} description="Configure future checkout eligibility and server-calculated discounts."/>
    <Link className="coupon-back" to="/admin/coupons"><ArrowLeft/> Back to Coupons</Link>
    <form className="admin-panel coupon-editor" onSubmit={submit}>
      <header><Tag/><div><h2>{editing?'Coupon settings':'New coupon'}</h2><p>Amounts are entered in INR and stored as integer paise.</p></div></header>
      {error&&<p className="coupon-form-error" role="alert">{error}</p>}
      <div className="coupon-form-grid">
        <label>Coupon code<input required maxLength={40} autoComplete="off" value={form.code} onChange={e=>set('code',e.target.value.toUpperCase())} pattern="[A-Z0-9][A-Z0-9_-]{0,39}" aria-describedby="coupon-code-help"/><small id="coupon-code-help">Letters, numbers, underscores and hyphens.</small></label>
        <label>Description<input maxLength={240} value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Internal campaign description"/></label>
        <label>Discount type<select value={form.kind} onChange={e=>{set('kind',e.target.value as CouponKind);set('value','');set('maximum','')}}><option value="percentage">Percentage</option><option value="fixed">Fixed amount</option></select></label>
        <label>{form.kind==='fixed'?'Discount value (INR)':'Discount value (%)'}<input required inputMode="decimal" value={form.value} onChange={e=>set('value',e.target.value)} placeholder={form.kind==='fixed'?'500.00':'10'}/></label>
        <label>Minimum order (INR)<input required inputMode="decimal" value={form.minimum} onChange={e=>set('minimum',e.target.value)} /></label>
        {form.kind==='percentage'&&<label>Maximum discount (INR, optional)<input inputMode="decimal" value={form.maximum} onChange={e=>set('maximum',e.target.value)} /></label>}
        <label>Valid from (optional)<input type="datetime-local" value={form.startsAt} onChange={e=>set('startsAt',e.target.value)}/></label>
        <label>Valid until (optional)<input type="datetime-local" value={form.endsAt} onChange={e=>set('endsAt',e.target.value)}/></label>
        <label>Total usage limit (optional)<input inputMode="numeric" value={form.totalLimit} onChange={e=>set('totalLimit',e.target.value)}/></label>
        <label>Per-customer limit (optional)<input inputMode="numeric" value={form.customerLimit} onChange={e=>set('customerLimit',e.target.value)}/></label>
      </div>
      <label className="coupon-enabled"><input type="checkbox" checked={form.enabled} onChange={e=>set('enabled',e.target.checked)}/><span><strong>Enable coupon</strong><small>Eligibility also depends on dates, subtotal and usage limits.</small></span></label>
      <footer><Link className="admin-button" to="/admin/coupons">Cancel</Link><button className="admin-button coupon-save" disabled={saving} type="submit"><Save/>{saving?'Saving…':'Save Coupon'}</button></footer>
    </form>
  </>
}
