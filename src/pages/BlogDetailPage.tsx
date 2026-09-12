import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BlogCard } from '../components/blog/BlogCard'
import { blogArticles, formatBlogDate, getBlogArticle, getRelatedBlogArticles } from '../data/blog'

export function BlogDetailPage() {
  const { slug } = useParams()
  const article = getBlogArticle(slug)

  useEffect(() => {
    const previousTitle = document.title
    document.title = article ? `${article.title} | Percent Journal` : 'Story Not Found | Percent Journal'
    return () => { document.title = previousTitle }
  }, [article])

  if (!article) return <main className="journal-not-found"><section><p>Percent Journal</p><h1>Story Not Found.</h1><span>This article may have moved or does not exist.</span><Link to="/blog">Back to Journal <ArrowRight /></Link></section></main>

  const relatedArticles = getRelatedBlogArticles(article)
  const articleIndex = blogArticles.findIndex((candidate) => candidate.slug === article.slug)
  const nextArticle = blogArticles[(articleIndex + 1) % blogArticles.length]

  return <main className="article-page">
    <article>
      <header className="article-hero"><Link className="article-back" to="/blog"><ArrowLeft /> Back to Journal</Link><p>{article.category}</p><h1>{article.title}</h1><span>{article.introduction}</span><div><time dateTime={article.date}>{formatBlogDate(article.date)}</time><small>{article.author}</small></div></header>
      <figure className="article-cover"><img src={article.image.src} alt={article.image.alt} width={article.image.width} height={article.image.height} /></figure>
      <div className="article-body">{article.sections.map((section, index) => <section key={section.heading}><h2>{section.heading}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{index === 0 && <blockquote>“{article.pullQuote}”</blockquote>}</section>)}</div>
      {article.secondaryImage && <figure className="article-secondary"><img src={article.secondaryImage.src} alt={article.secondaryImage.alt} width={article.secondaryImage.width} height={article.secondaryImage.height} loading="lazy" /></figure>}
      <nav className="article-next" aria-label="Next journal story"><span>Next Story</span><Link to={`/blog/${nextArticle.slug}`}>{nextArticle.title} <ArrowRight /></Link></nav>
    </article>
    <section className="article-related" aria-labelledby="related-stories-title"><header><p>Keep Reading</p><h2 id="related-stories-title">Related Stories</h2></header><div className="journal-grid">{relatedArticles.map((related) => <BlogCard article={related} key={related.slug} />)}</div><Link className="article-journal-link" to="/blog"><ArrowLeft /> Back to Journal</Link></section>
  </main>
}
