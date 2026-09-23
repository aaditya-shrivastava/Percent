import { ArrowRight, CircleCheck, ClipboardList, HelpCircle, PackageSearch, Ruler, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { inquiryTypes, supportHeroImage, supportTopics, type InquiryType } from '../data/support'
import { pageSection, useWebsitePage, WebsitePageError } from '../components/layout/WebsitePageContext'

interface InquiryForm {
  fullName: string
  email: string
  phone: string
  inquiryType: '' | InquiryType
  orderNumber: string
  subject: string
  message: string
  agreement: boolean
}

const emptyInquiry: InquiryForm = { fullName: '', email: '', phone: '', inquiryType: '', orderNumber: '', subject: '', message: '', agreement: false }

export function ContactPage() {
  const { page, error: pageError } = useWebsitePage('contact')
  const [searchParams] = useSearchParams()
  const requestedType = searchParams.get('type')
  const initialType = inquiryTypes.find((type) => type === requestedType) ?? ''
  const [form, setForm] = useState<InquiryForm>({ ...emptyInquiry, inquiryType: initialType })
  const [errors, setErrors] = useState<Partial<Record<keyof InquiryForm, string>>>({})
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle')
  const submitTimer = useRef<number | null>(null)

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Contact & Support | Percent'
    return () => { document.title = previousTitle; if (submitTimer.current !== null) window.clearTimeout(submitTimer.current) }
  }, [])

  const update = <Key extends keyof InquiryForm>(key: Key, value: InquiryForm[Key]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (status === 'submitting') return
    const nextErrors: Partial<Record<keyof InquiryForm, string>> = {}
    if (!form.fullName.trim()) nextErrors.fullName = 'Enter your full name.'
    if (!/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.email = 'Enter a valid email address.'
    if (!form.inquiryType) nextErrors.inquiryType = 'Select an inquiry type.'
    if (!form.subject.trim()) nextErrors.subject = 'Enter a subject.'
    if (form.message.trim().length < 10) nextErrors.message = 'Tell us a little more about your inquiry.'
    if (!form.agreement) nextErrors.agreement = 'Confirm that we may contact you about this inquiry.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setStatus('submitting')
    submitTimer.current = window.setTimeout(() => { setStatus('success'); submitTimer.current = null }, 650)
  }

  if (pageError) return <WebsitePageError />
  return <main className="support-page">
    <section className="support-hero" aria-labelledby="support-title"><div><p>{page.eyebrow}</p><h1 id="support-title">{page.heading}</h1><span>{page.subheading}</span><strong>{page.body}</strong></div><img src={page.media_url ?? supportHeroImage.src} alt={page.media_alt ?? supportHeroImage.alt} width={page.media_width ?? supportHeroImage.width} height={page.media_height ?? supportHeroImage.height} /></section>

    <section className="support-main" aria-label="Percent support inquiry">
      <div className="support-form-panel">
        {status === 'success' ? <div className="support-success" role="status"><CircleCheck /><p>Percent Support</p><h2>Inquiry Received</h2><span>Thanks for reaching out.<br />Our team will get back to you as soon as possible.</span><small>This frontend confirmation does not create a support ticket or send an email.</small><button type="button" onClick={() => { setForm(emptyInquiry); setErrors({}); setStatus('idle') }}>Submit Another Inquiry <ArrowRight /></button></div> : <>
          <header><p>Tell us what you need</p><h2>Submit an Inquiry</h2></header>
          <form className="support-form" onSubmit={submit} noValidate>
            <label>Full Name *<input value={form.fullName} onChange={(event) => update('fullName', event.target.value)} aria-invalid={Boolean(errors.fullName)} />{errors.fullName && <small>{errors.fullName}</small>}</label>
            <label>Email Address *<input type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(event) => update('email', event.target.value)} aria-invalid={Boolean(errors.email)} />{errors.email && <small>{errors.email}</small>}</label>
            <label>Phone Number <span>(optional)</span><input type="tel" inputMode="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} /></label>
            <label>Inquiry Type *<select value={form.inquiryType} onChange={(event) => update('inquiryType', event.target.value as InquiryForm['inquiryType'])} aria-invalid={Boolean(errors.inquiryType)}><option value="">Select a topic</option>{inquiryTypes.map((type) => <option value={type} key={type}>{type}</option>)}</select>{errors.inquiryType && <small>{errors.inquiryType}</small>}</label>
            <label className={form.inquiryType === 'Order Support' ? 'is-emphasized' : ''}>Order Number <span>(optional)</span><input value={form.orderNumber} placeholder="#PCT123456" onChange={(event) => update('orderNumber', event.target.value)} /></label>
            <label>Subject *<input value={form.subject} onChange={(event) => update('subject', event.target.value)} aria-invalid={Boolean(errors.subject)} />{errors.subject && <small>{errors.subject}</small>}</label>
            <label className="support-message">Message *<textarea rows={7} value={form.message} onChange={(event) => update('message', event.target.value)} aria-invalid={Boolean(errors.message)} />{errors.message && <small>{errors.message}</small>}</label>
            <label className="support-agreement"><input type="checkbox" checked={form.agreement} onChange={(event) => update('agreement', event.target.checked)} /><span>I agree to be contacted regarding this inquiry.</span>{errors.agreement && <small>{errors.agreement}</small>}</label>
            <button className="support-submit" type="submit" disabled={status === 'submitting'}>{status === 'submitting' ? 'Sending…' : 'Send Inquiry'} <ArrowRight /></button>
          </form>
        </>}
      </div>
      <aside className="support-information"><header><p>Support Topics</p><h2>{pageSection(page, 'support')?.heading}</h2></header><div>{supportTopics.map((topic, index) => <article key={topic.title}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{topic.title}</h3><p>{topic.copy}</p></div></article>)}</div><footer><strong>Support response</strong><p>{pageSection(page, 'support')?.body}</p></footer></aside>
    </section>

    <section className="support-quick" aria-labelledby="quick-help-title"><header><p>Start Here</p><h2 id="quick-help-title">{pageSection(page, 'quick_help')?.heading}</h2></header><div><Link to="/profile/orders"><PackageSearch /><span><strong>Track My Order</strong><small>Open your current order history.</small></span><ArrowRight /></Link><Link to="/contact?type=Returns%20%26%20Exchanges"><RotateCcw /><span><strong>Start a Return</strong><small>Send a return or exchange inquiry.</small></span><ArrowRight /></Link><Link to="/faq?topic=Sizing"><Ruler /><span><strong>Size Guide</strong><small>Find sizing help and product guidance.</small></span><ArrowRight /></Link><Link to="/faq"><ClipboardList /><span><strong>FAQ &amp; Policies</strong><small>Browse quick answers and policies.</small></span><ArrowRight /></Link></div></section>

    <section className="support-faq-cta"><HelpCircle /><div><p>Prefer to browse answers first?</p><h2>Find the Help You Need.</h2></div><Link to="/faq">Visit FAQ &amp; Policies <ArrowRight /></Link></section>
  </main>
}
