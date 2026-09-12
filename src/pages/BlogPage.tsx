import { ArrowRight } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { BlogCard } from '../components/blog/BlogCard'
import { BlogCategoryFilter, type BlogCategorySelection } from '../components/blog/BlogCategoryFilter'
import { blogArticles, featuredBlogArticle, formatBlogDate } from '../data/blog'

export function BlogPage() {
  const [category, setCategory] = useState<BlogCategorySelection>('All')
  const [email, setEmail] = useState('')
  const [newsletterMessage, setNewsletterMessage] = useState('')
  const stories = useMemo(() => blogArticles.filter((article) => !article.featured && (category === 'All' || article.category === category)), [category])

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Percent Journal | Stories Worth Keeping'
    return () => { document.title = previousTitle }
  }, [])

  const submitNewsletter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email)) { setNewsletterMessage('Enter a valid email address.'); return }
    setNewsletterMessage('Thanks — you’re on the list.')
    setEmail('')
  }

  return <main className="journal-page">
    <section className="journal-hero" aria-labelledby="journal-title"><p>Percent Journal</p><h1 id="journal-title">Stories, Ideas<br />and What’s Next.</h1><span>Design inspiration, creative process, style stories and a closer look at the world of Percent.</span></section>

    <section className="journal-featured" aria-labelledby="featured-story-title">
      <Link className="journal-featured-image" to={`/blog/${featuredBlogArticle.slug}`}><img src={featuredBlogArticle.image.src} alt={featuredBlogArticle.image.alt} width={featuredBlogArticle.image.width} height={featuredBlogArticle.image.height} /></Link>
      <div><p>Featured Story</p><h2 id="featured-story-title"><Link to={`/blog/${featuredBlogArticle.slug}`}>{featuredBlogArticle.title}</Link></h2><span>{featuredBlogArticle.excerpt}</span><time dateTime={featuredBlogArticle.date}>{formatBlogDate(featuredBlogArticle.date)}</time><Link to={`/blog/${featuredBlogArticle.slug}`}>Read Story <ArrowRight /></Link></div>
    </section>

    <section className="journal-latest" aria-labelledby="latest-stories-title">
      <header><div><p>Explore the Journal</p><h2 id="latest-stories-title">Latest Stories</h2></div><BlogCategoryFilter selected={category} onSelect={setCategory} /></header>
      {stories.length ? <div className="journal-grid">{stories.map((article) => <BlogCard article={article} key={article.slug} />)}</div> : <div className="journal-empty"><h3>No Stories Here Yet.</h3><p>More from Percent is coming soon.</p><button type="button" onClick={() => setCategory('All')}>View All Stories <ArrowRight /></button></div>}
      <small className="journal-demo-note">Journal stories are frontend editorial previews for the current development phase.</small>
    </section>

    <section className="journal-newsletter" aria-labelledby="journal-newsletter-title"><div><p>Percent Journal</p><h2 id="journal-newsletter-title">Stay in the Loop.</h2><span>New drops. New stories. Same mission.</span></div><form onSubmit={submitNewsletter} noValidate><label className="sr-only" htmlFor="journal-email">Email address</label><div><input id="journal-email" type="email" inputMode="email" autoComplete="email" placeholder="Email address" value={email} onChange={(event) => { setEmail(event.target.value); setNewsletterMessage('') }} aria-describedby="journal-newsletter-message" /><button type="submit" aria-label="Join the Percent Journal list"><ArrowRight /></button></div><p id="journal-newsletter-message" aria-live="polite">{newsletterMessage}</p></form></section>
  </main>
}
