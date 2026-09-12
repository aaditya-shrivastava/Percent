import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatBlogDate, type BlogArticle } from '../../data/blog'

export function BlogCard({ article, variant = 'default' }: { article: BlogArticle; variant?: 'default' | 'about' }) {
  const isAbout = variant === 'about'
  return <article className={`journal-card ${isAbout ? 'journal-card--about' : ''}`}>
    <Link className={`journal-card-image ${isAbout ? 'about-blog-image' : ''}`} to={`/blog/${article.slug}`} aria-label={`Read ${article.title}`}><img src={article.image.src} alt={article.image.alt} width={article.image.width} height={article.image.height} loading="lazy" /></Link>
    <div className="journal-card-copy">
      {!isAbout && <p className="journal-card-meta"><span>{article.category}</span><time dateTime={article.date}>{formatBlogDate(article.date)}</time></p>}
      <h3><Link to={`/blog/${article.slug}`}>{article.title}</Link></h3>
      <p>{article.excerpt}</p>
      <Link className="journal-card-link" to={`/blog/${article.slug}`}>Read More <ArrowRight /></Link>
    </div>
  </article>
}
