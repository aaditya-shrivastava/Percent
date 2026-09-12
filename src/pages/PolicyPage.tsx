import { ArrowLeft, ArrowRight, Headphones } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { policies, policyById, type PolicyId } from '../data/policies'

export function PolicyPage({ policyId }: { policyId: PolicyId }) {
  const navigate = useNavigate()
  const policy = policyById[policyId]
  const policyIndex = policies.findIndex((item) => item.id === policyId)
  const previousPolicy = policies[(policyIndex - 1 + policies.length) % policies.length]
  const nextPolicy = policies[(policyIndex + 1) % policies.length]

  useEffect(() => {
    const previousTitle = document.title
    document.title = `${policy.title} | Percent`
    return () => { document.title = previousTitle }
  }, [policy.title])

  return <main className="policy-page">
    <section className="policy-hero" aria-labelledby="policy-title">
      <p>Percent Policies</p>
      <h1 id="policy-title">{policy.title}</h1>
      <span>{policy.introduction}</span>
      <small>Frontend policy preview — final commercial and legal review required before launch.</small>
    </section>

    <section className="policy-layout">
      <aside className="policy-sidebar">
        <p>Policy Library</p>
        <nav aria-label="Policy pages">{policies.map((item) => <Link className={item.id === policyId ? 'is-active' : ''} to={`/policies/${item.id}`} aria-current={item.id === policyId ? 'page' : undefined} key={item.id}>{item.shortTitle}<ArrowRight /></Link>)}</nav>
        <div className="policy-table-of-contents"><p>On This Page</p><nav aria-label={`${policy.title} sections`}>{policy.sections.map((section, index) => <a href={`#${section.id}`} key={section.id}><span>{String(index + 1).padStart(2, '0')}</span>{section.title}</a>)}</nav></div>
      </aside>

      <article className="policy-article">
        <label className="policy-mobile-selector"><span>Policy</span><select value={policyId} onChange={(event) => navigate(`/policies/${event.target.value}`)}>{policies.map((item) => <option value={item.id} key={item.id}>{item.shortTitle}</option>)}</select></label>
        <nav className="policy-mobile-contents" aria-label={`${policy.title} sections`}>{policy.sections.map((section) => <a href={`#${section.id}`} key={section.id}>{section.title}</a>)}</nav>

        <div className="policy-copy">{policy.sections.map((section, index) => <section id={section.id} key={section.id}><span>{String(index + 1).padStart(2, '0')}</span><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>)}</div>

        <nav className="policy-pagination" aria-label="Previous and next policies">
          <Link to={`/policies/${previousPolicy.id}`}><ArrowLeft /><span><small>Previous Policy</small>{previousPolicy.shortTitle}</span></Link>
          <Link to={`/policies/${nextPolicy.id}`}><span><small>Next Policy</small>{nextPolicy.shortTitle}</span><ArrowRight /></Link>
        </nav>

        <section className="policy-contact" aria-labelledby="policy-contact-title"><Headphones /><div><p>Have a Question?</p><h2 id="policy-contact-title">Contact Support</h2></div><Link to="/contact">Contact Support <ArrowRight /></Link></section>
      </article>
    </section>
  </main>
}
