import { ArrowRight, ChevronDown, Headphones } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { policyCards } from '../data/support'
import { pageSection, useWebsitePage, WebsitePageError } from '../components/layout/WebsitePageContext'

type FaqSelection = string

export function FaqPage() {
  const { page, error: pageError } = useWebsitePage('faq')
  const visibleCategories = page.faq_categories.filter(item => item.enabled).sort((a, b) => a.sort_order - b.sort_order)
  const categories = ['All', ...visibleCategories.map(item => item.category_key)]
  const items = visibleCategories.flatMap(group => group.items.filter(item => item.enabled).sort((a, b) => a.sort_order - b.sort_order).map(item => ({ ...item, category: group.category_key })))
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTopic = searchParams.get('topic')
  const initialCategory = categories.find(category => category === requestedTopic) ?? 'All'
  const [category, setCategory] = useState<FaqSelection>(initialCategory)
  const [openQuestion, setOpenQuestion] = useState<string | null>(null)
  const questions = items.filter(item => category === 'All' || item.category === category)

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'FAQ & Policies | Percent'
    return () => { document.title = previousTitle }
  }, [])

  const selectCategory = (nextCategory: FaqSelection) => {
    setCategory(nextCategory)
    setOpenQuestion(null)
    if (nextCategory === 'All') setSearchParams({}, { replace: true })
    else setSearchParams({ topic: nextCategory }, { replace: true })
  }

  if (pageError) return <WebsitePageError />
  return <main className="faq-page">
    <section className="faq-hero" aria-labelledby="faq-title"><p>{page.eyebrow}</p><h1 id="faq-title">{page.heading}</h1><span>{page.subheading}</span></section>

    <section className="faq-browser" aria-label="Frequently asked questions">
      <aside><p>Browse by Topic</p><nav aria-label="FAQ topics">{categories.map(topic => <button className={category === topic ? 'is-active' : ''} type="button" key={topic} aria-pressed={category === topic} onClick={() => selectCategory(topic)}>{topic === 'All' ? 'All' : visibleCategories.find(item => item.category_key === topic)?.label}<span>{topic === 'All' ? items.length : items.filter(item => item.category === topic).length}</span></button>)}</nav></aside>
      <div className="faq-content"><header><div><p>Quick Answers</p><h2>Frequently Asked Questions</h2></div><label><span>Browse by Topic</span><select value={category} onChange={(event) => selectCategory(event.target.value as FaqSelection)}>{categories.map(topic => <option value={topic} key={topic}>{topic === 'All' ? 'All' : visibleCategories.find(item => item.category_key === topic)?.label}</option>)}</select></label></header>
        {questions.length ? <div className="faq-accordions">{questions.map((item) => { const isOpen = openQuestion === item.item_key; return <article key={item.item_key}><h3><button type="button" aria-expanded={isOpen} aria-controls={`faq-answer-${item.item_key}`} onClick={() => setOpenQuestion(isOpen ? null : item.item_key)}><span><small>{item.category}</small>{item.question}</span><ChevronDown /></button></h3><div className={isOpen ? 'is-open' : ''} id={`faq-answer-${item.item_key}`}><p>{item.answer}</p></div></article> })}</div> : <div className="faq-empty"><h3>No Questions Here Yet.</h3><p>Try another topic or contact support.</p><Link to="/contact">Contact Support <ArrowRight /></Link></div>}
      </div>
    </section>

    {pageSection(page, 'policy_links') && <section className="faq-policies" id="policies" aria-labelledby="policies-title"><header><p>Essential Information</p><h2 id="policies-title">{pageSection(page, 'policy_links')?.heading}</h2></header><div>{policyCards.map((policy, index) => <article key={policy.title}><span>{String(index + 1).padStart(2, '0')}</span><h3>{policy.title}</h3><p>{policy.copy}</p><Link to={policy.href}>Read Policy <ArrowRight /></Link></article>)}</div><small>Commercial and legal policy details remain frontend placeholders and will be finalized before launch.</small></section>}

    {pageSection(page, 'contact_cta') && <section className="faq-contact"><Headphones /><div><p>We’re Here for You</p><h2>{pageSection(page, 'contact_cta')?.heading}</h2></div><Link to={pageSection(page, 'contact_cta')?.cta_path ?? '/contact'}>{pageSection(page, 'contact_cta')?.cta_label ?? 'Contact Support'} <ArrowRight /></Link></section>}
  </main>
}
