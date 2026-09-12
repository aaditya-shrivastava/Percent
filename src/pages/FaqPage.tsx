import { ArrowRight, ChevronDown, Headphones } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { faqCategories, faqItems, policyCards, type FaqCategory } from '../data/support'

type FaqSelection = 'All' | FaqCategory

export function FaqPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTopic = searchParams.get('topic')
  const initialCategory = faqCategories.find((category) => category === requestedTopic) ?? 'All'
  const [category, setCategory] = useState<FaqSelection>(initialCategory)
  const [openQuestion, setOpenQuestion] = useState<string | null>(null)
  const questions = useMemo(() => faqItems.filter((item) => category === 'All' || item.category === category), [category])

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

  return <main className="faq-page">
    <section className="faq-hero" aria-labelledby="faq-title"><p>Percent Help</p><h1 id="faq-title">FAQ / Policies</h1><span>Find answers to common questions about orders, shipping, returns, sizing, payments, and store policies.</span></section>

    <section className="faq-browser" aria-label="Frequently asked questions">
      <aside><p>Browse by Topic</p><nav aria-label="FAQ topics">{faqCategories.map((topic) => <button className={category === topic ? 'is-active' : ''} type="button" key={topic} aria-pressed={category === topic} onClick={() => selectCategory(topic)}>{topic}<span>{topic === 'All' ? faqItems.length : faqItems.filter((item) => item.category === topic).length}</span></button>)}</nav></aside>
      <div className="faq-content"><header><div><p>Quick Answers</p><h2>Frequently Asked Questions</h2></div><label><span>Browse by Topic</span><select value={category} onChange={(event) => selectCategory(event.target.value as FaqSelection)}>{faqCategories.map((topic) => <option value={topic} key={topic}>{topic}</option>)}</select></label></header>
        {questions.length ? <div className="faq-accordions">{questions.map((item) => { const isOpen = openQuestion === item.id; return <article key={item.id}><h3><button type="button" aria-expanded={isOpen} aria-controls={`faq-answer-${item.id}`} onClick={() => setOpenQuestion(isOpen ? null : item.id)}><span><small>{item.category}</small>{item.question}</span><ChevronDown /></button></h3><div className={isOpen ? 'is-open' : ''} id={`faq-answer-${item.id}`}><p>{item.answer}</p></div></article> })}</div> : <div className="faq-empty"><h3>No Questions Here Yet.</h3><p>Try another topic or contact support.</p><Link to="/contact">Contact Support <ArrowRight /></Link></div>}
      </div>
    </section>

    <section className="faq-policies" id="policies" aria-labelledby="policies-title"><header><p>Essential Information</p><h2 id="policies-title">Policies at a Glance</h2></header><div>{policyCards.map((policy, index) => <article key={policy.title}><span>{String(index + 1).padStart(2, '0')}</span><h3>{policy.title}</h3><p>{policy.copy}</p><Link to={policy.href}>Read Policy <ArrowRight /></Link></article>)}</div><small>Commercial and legal policy details remain frontend placeholders and will be finalized before launch.</small></section>

    <section className="faq-contact"><Headphones /><div><p>We’re Here for You</p><h2>Still Have a Question?</h2></div><Link to="/contact">Contact Support <ArrowRight /></Link></section>
  </main>
}
