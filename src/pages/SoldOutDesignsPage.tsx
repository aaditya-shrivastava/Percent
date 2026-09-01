import { ArrowRight, Gem, Heart, LockKeyhole, Shirt } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getArchivedProducts, type ArchivedProduct } from '../data/archive'
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
  { title: 'Limited to 100', copy: 'Each design is made in only 100 pieces.', icon: Shirt },
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
      <span className="archive-sold-count">100 / 100 sold</span>
    </Link>
    <div className="archive-card-info"><div><p>{product.fitType === 'standard' ? 'Standard Fit' : 'Oversized Fit'}{colour ? ` · ${colour}` : ''}</p><h2>{product.name}</h2></div><Link to={`/products/${product.slug}`}>View Details <ArrowRight /></Link></div>
  </article>
}

export function SoldOutDesignsPage() {
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
    description.content = 'Explore the Percent archive: 100 pieces made, 100 sold, never restocked.'
    return () => { document.title = previousTitle }
  }, [])

  return <main className="archive-page">
    <section className="archive-hero">
      <div className="archive-hero-copy"><p>Percent Archive</p><h1>Sold Out.</h1><h2>They’re gone, forever.</h2><span>Every design at % Percent is created in only 100 pieces.<br />When it’s sold out, it’s gone forever.<br />No restocks. No repeats. Just exclusivity.</span><Link className="archive-primary-action" to="/shop">Discover Current Drop <ArrowRight /></Link></div>
      <div className="archive-seal" aria-label="Limited to 100 pieces. Once gone, never back."><span>Limited to 100 pieces</span><strong>%</strong><span>Once gone, never back</span></div>
    </section>

    <section className="archive-catalog" aria-labelledby="archive-heading">
      <div className="archive-toolbar">
        <label><span>Filter</span><select value={filter} onChange={(event) => setFilter(event.target.value as ArchiveFilter)}>{filterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <h2 id="archive-heading">Archived Designs</h2>
        <label><span>Sort by</span><select value={sort} onChange={(event) => setSort(event.target.value as ArchiveSort)}>{sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      </div>
      {products.length ? <div className="archive-grid">{products.map((product) => <ArchiveCard key={product.id} product={product} />)}</div> : <div className="archive-empty"><strong>No archived designs found</strong><span>Try another filter.</span></div>}
    </section>

    <section className="archive-values" aria-label="The Percent archive promise">{archiveValues.map(({ title, copy, icon: Icon }) => <article key={title}><Icon /><div><h2>{title}</h2><p>{copy}</p></div></article>)}</section>
  </main>
}
