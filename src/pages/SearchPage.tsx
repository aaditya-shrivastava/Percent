import { ArrowRight, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BlogCard } from '../components/blog/BlogCard'
import { ShopProductCard } from '../components/product/ShopProductCard'
import { searchBlogArticles, searchProducts } from '../data/search'
import { useWishlist } from '../hooks/useCommerce'

type SearchScope = 'all' | 'products' | 'journal'
const popularSearches = ['Oversized', 'Standard Fit', 'Black', 'Limited', '100 Pieces']

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q')?.trim() ?? ''
  const [draftState, setDraftState] = useState({ value: query, query })
  const draft = draftState.query === query ? draftState.value : query
  const setDraft = (value: string) => setDraftState({ value, query })
  const [scope, setScope] = useState<SearchScope>('all')
  const searchInput = useRef<HTMLInputElement>(null)
  const wishlist = useWishlist()
  const products = useMemo(() => query ? searchProducts(query) : [], [query])
  const stories = useMemo(() => query ? searchBlogArticles(query) : [], [query])
  const resultCount = scope === 'products' ? products.length : scope === 'journal' ? stories.length : products.length + stories.length

  useEffect(() => {
    const previousTitle = document.title
    document.title = query ? `Search: ${query} | Percent` : 'Search | Percent'
    return () => { document.title = previousTitle }
  }, [query])

  const runSearch = (nextQuery: string) => {
    const normalizedQuery = nextQuery.trim()
    setScope('all')
    if (normalizedQuery) setSearchParams({ q: normalizedQuery })
    else setSearchParams({})
  }
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); runSearch(draft) }
  const countLabel = scope === 'products' ? `${products.length} ${products.length === 1 ? 'product' : 'products'}` : scope === 'journal' ? `${stories.length} ${stories.length === 1 ? 'story' : 'stories'}` : `${resultCount} ${resultCount === 1 ? 'result' : 'results'}`
  const showProducts = scope !== 'journal' && products.length > 0
  const showStories = scope !== 'products' && stories.length > 0

  return <main className="search-page">
    <section className="search-heading" aria-labelledby="search-page-title"><p>Search</p><h1 id="search-page-title">{query ? 'Search Results' : 'What Are You Looking For?'}</h1>{query ? <><span>Results for “{query}”</span><strong>{countLabel} found</strong></> : <span>Search products, fits, colours or Percent stories.</span>}</section>

    <section className="search-controls" aria-label="Search Percent"><form onSubmit={submit}><label className="sr-only" htmlFor="search-page-input">Search products and Journal stories</label><input ref={searchInput} id="search-page-input" type="search" autoComplete="off" placeholder="Search products, styles, stories..." value={draft} onChange={(event) => setDraft(event.target.value)} /><button type="submit" aria-label="Submit search"><Search /></button></form>{query && <div className="search-scope" role="group" aria-label="Filter search result type">{(['all', 'products', 'journal'] as const).map((option) => <button className={scope === option ? 'is-active' : ''} type="button" aria-pressed={scope === option} key={option} onClick={() => setScope(option)}>{option}</button>)}</div>}</section>

    {!query ? <section className="search-popular" aria-labelledby="popular-searches-title"><h2 id="popular-searches-title">Popular Searches</h2><div>{popularSearches.map((search) => <button type="button" key={search} onClick={() => runSearch(search)}>{search}<ArrowRight /></button>)}</div></section> : resultCount ? <section className="search-results" aria-live="polite">
      {showProducts && <section className="search-result-group" aria-labelledby="product-results-title"><header><p>Products</p><h2 id="product-results-title">Product Results</h2><span>{products.length} {products.length === 1 ? 'piece' : 'pieces'}</span></header><div className="shop-product-grid search-product-grid">{products.map((product) => <ShopProductCard product={product} wished={wishlist.items.includes(product.id)} onWishlist={() => wishlist.toggle(product.id)} key={product.id} />)}</div></section>}
      {showStories && <section className="search-result-group" aria-labelledby="journal-results-title"><header><p>Journal</p><h2 id="journal-results-title">Stories &amp; Ideas</h2><span>{stories.length} {stories.length === 1 ? 'story' : 'stories'}</span></header><div className="journal-grid search-journal-grid">{stories.map((article) => <BlogCard article={article} key={article.slug} />)}</div></section>}
    </section> : <section className="search-empty" aria-live="polite"><Search /><p>Search</p><h2>No Results Found.</h2><span>We couldn’t find anything for “{query}”.<br />Try another search or explore the current collection.</span><div><button type="button" onClick={() => { setDraft(''); searchInput.current?.focus() }}>Try Another Search</button><Link to="/shop">Explore All Products <ArrowRight /></Link></div></section>}
  </main>
}
