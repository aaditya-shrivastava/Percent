import { ArrowRight, Gem, Heart, LockKeyhole, Shirt } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getArchivedProducts, type ArchivedProduct } from '../data/archive'
import { useWebsitePage, WebsitePageError, pageSection } from '../components/layout/WebsitePageContext'
import type { FitType } from '../types'

type ArchiveFilter = 'all' | FitType
type ArchiveSort = 'latest' | 'oldest' | 'name'

const filterOptions: Array<{ value: ArchiveFilter; label: string }> = [
  { value: 'all', label: 'All fits' },
  { value: 'standard', label: 'Standard Fit' },
  { value: 'oversized', label: 'Oversized Fit' },
]

const sortOptions: Array<{ value: ArchiveSort; label: string }> = [
  { value: 'latest', label: 'Latest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'name', label: 'Name A–Z' },
]

const archiveValues = [
  { title: 'Limited production', copy: 'Each design has its own fixed production limit.', icon: Shirt },
  { title: 'Once gone, never back', copy: 'No restocks. No second chances.', icon: LockKeyhole },
  { title: 'Exclusive by design', copy: 'Created for the few who value rarity.', icon: Gem },
  { title: 'Thank you', copy: 'For being a part of something rare.', icon: Heart },
]

function ArchiveCard({ product }: { product: ArchivedProduct }) {
  const image = product.images[0]
  const colour = product.colors[0]?.label
  return <article className="archive-card">
    <Link className="archive-card-media" to={`/products/${product.slug}`} aria-label={`View archived ${product.name}`}>
      <span className="archive-number">{product.archiveNumber}</span>
      <img src={image.src} alt={image.alt} width={image.width} height={image.height} loading="lazy" />
      <strong className="archive-sold-overlay">Sold Out</strong>
      <span className="archive-sold-count">{product.soldPieces} / {product.totalPieces} sold</span>
    </Link>
    <div className="archive-card-info"><div><p>{product.fitType === 'standard' ? 'Standard Fit' : 'Oversized Fit'}{colour ? ` · ${colour}` : ''}</p><h2>{product.name}</h2></div><Link to={`/products/${product.slug}`}>View Details <ArrowRight /></Link></div>
  </article>
}

export function SoldOutDesignsPage() {
  const { page, error: pageError } = useWebsitePage('sold_out')
  const [filter, setFilter] = useState<ArchiveFilter>('all')
  const [sort, setSort] = useState<ArchiveSort>('latest')
  const products = useMemo(() => {
    const filtered = getArchivedProducts().filter((product) => filter === 'all' || product.fitType === filter)
    return [...filtered].sort((first, second) => {
      if (sort === 'oldest') return Date.parse(first.archivedAt) - Date.parse(second.archivedAt)
      if (sort === 'name') return first.name.localeCompare(second.name)
      return Date.parse(second.archivedAt) - Date.parse(first.archivedAt)
    })
  }, [filter, sort])

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Sold Out Designs | Percent Archive'
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]') ?? document.head.appendChild(document.createElement('meta'))
    description.name = 'description'
    description.content = 'Explore the Percent archive: limited runs, fully collected, never restocked.'
    return () => { document.title = previousTitle }
  }, [])

  if (pageError) return <WebsitePageError />
  return <main className="archive-page">
    <section className="archive-hero">
      <div className="archive-hero-copy"><p>{page.eyebrow}</p><h1>{page.heading}</h1><h2>{page.subheading}</h2><span style={{ whiteSpace: 'pre-line' }}>{page.body}</span>{page.cta_path && page.cta_label && <Link className="archive-primary-action" to={page.cta_path}>{page.cta_label} <ArrowRight /></Link>}</div>
      <div className="archive-seal" aria-label="Limited production pieces. Once gone, never back."><span>Limited production pieces</span><strong>%</strong><span>Once gone, never back</span></div>
    </section>

    <section className="archive-catalog" aria-labelledby="archive-heading">
      <div className="archive-toolbar">
        <label><span>Filter</span><select value={filter} onChange={(event) => setFilter(event.target.value as ArchiveFilter)}>{filterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <h2 id="archive-heading">{pageSection(page, 'archive_catalog')?.heading}</h2>
        <label><span>Sort by</span><select value={sort} onChange={(event) => setSort(event.target.value as ArchiveSort)}>{sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      </div>
      {products.length ? <div className="archive-grid">{products.map((product) => <ArchiveCard key={product.id} product={product} />)}</div> : <div className="archive-empty"><strong>No archived designs found</strong><span>Try another filter.</span></div>}
    </section>

    <section className="archive-values" aria-label="The Percent archive promise">{page.sections.filter(item => item.enabled && item.section_key.startsWith('promise_')).sort((a, b) => a.sort_order - b.sort_order).map(item => { const Icon = archiveValues[['promise_production', 'promise_permanence', 'promise_exclusivity', 'promise_thanks'].indexOf(item.section_key)]?.icon ?? Gem; return <article key={item.section_key}><Icon /><div><h2>{item.heading}</h2><p>{item.body}</p></div></article> })}</section>
  </main>
}
