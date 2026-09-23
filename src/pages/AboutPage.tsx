import { ArrowRight } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BlogCard } from '../components/blog/BlogCard'
import { useWebsitePage, WebsitePageError } from '../components/layout/WebsitePageContext'
import type { PageSection } from '../backend/websitePages'
import { aboutCollaborators, aboutImages, aboutValues } from '../data/about'
import { aboutBlogArticles } from '../data/blog'

function editorialImage(item: PageSection, fallback: typeof aboutImages.live) {
  return { src: item.media_url ?? fallback.src, alt: item.media_alt ?? fallback.alt, width: item.media_width ?? fallback.width, height: item.media_height ?? fallback.height }
}

function AboutBlock({ item }: { item: PageSection }) {
  if (item.section_key === 'statement') return <section className="about-statement" aria-label="Percent lifestyle statement"><h2 style={{ whiteSpace: 'pre-line' }}>{item.heading}</h2></section>
  if (item.section_key === 'live') { const image = editorialImage(item, aboutImages.live); return <section className="about-live" aria-label="Percent live collection"><img src={image.src} alt={image.alt} width={image.width} height={image.height} />{item.cta_path && item.cta_label && <Link to={item.cta_path}>{item.cta_label} <ArrowRight /></Link>}</section> }
  if (item.section_key === 'limited') return <section className="about-limited-message"><p style={{ whiteSpace: 'pre-line' }}>{item.body}</p></section>
  if (item.section_key === 'values') return <section className="about-values" aria-labelledby="about-values-title"><header><p>{item.body}</p><h2 id="about-values-title">{item.heading}</h2></header><div>{aboutValues.map((value, index) => <article key={value}><span>{String(index + 1).padStart(2, '0')}</span><h3>{value}</h3></article>)}</div></section>
  if (item.section_key === 'craft') { const image = editorialImage(item, aboutImages.craft); return <section className="about-craft" aria-label="Percent craft values"><img src={image.src} alt={image.alt} width={image.width} height={image.height} loading="lazy" /><div>{['Comfort', 'Confidence', 'Class'].map(value => <strong key={value}>{value}</strong>)}</div></section> }
  if (item.section_key === 'identity') { const image = editorialImage(item, aboutImages.identity); return <section className="about-identity" aria-labelledby="about-identity-title"><img src={image.src} alt={image.alt} width={image.width} height={image.height} loading="lazy" /><div><p>% PERCENT</p><h2 id="about-identity-title" style={{ whiteSpace: 'pre-line' }}>{item.heading}</h2><span>{item.body}</span>{item.cta_path && item.cta_label && <Link to={item.cta_path}>{item.cta_label} <ArrowRight /></Link>}</div></section> }
  return null
}

export function AboutPage() {
  const { page, error } = useWebsitePage('about')
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'About Percent | Less Ordinary. More You.'
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]') ?? document.head.appendChild(document.createElement('meta'))
    description.name = 'description'
    description.content = 'Meet Percent: intentional design and limited production runs for every design.'
    return () => { document.title = previousTitle }
  }, [])
  if (error) return <WebsitePageError />
  const blocks = page.sections.filter(item => item.enabled).sort((a, b) => a.sort_order - b.sort_order)
  return <main className="about-page">
    <section className="about-intro" aria-labelledby="about-intro-title"><p className="about-kicker">{page.eyebrow}</p><h1 id="about-intro-title" style={{ whiteSpace: 'pre-line' }}>{page.heading}</h1><p style={{ whiteSpace: 'pre-line' }}>{page.body}</p></section>
    {blocks.map(item => <AboutBlock item={item} key={item.section_key} />)}
    <section className="about-collaborators" aria-labelledby="about-collaborators-title"><header><p>Creative community</p><h2 id="about-collaborators-title">Collaborators</h2></header><div>{aboutCollaborators.map(collaborator => <article key={collaborator}><span>{collaborator}</span></article>)}</div></section>
    <section className="about-blog" aria-labelledby="about-blog-title"><header><div><p>Percent Journal</p><h2 id="about-blog-title">From the Blog</h2><span>Thoughts, stories and a closer look at what drives % Percent.</span></div><Link to="/blog">View All Blogs <ArrowRight /></Link></header><div className="about-blog-grid">{aboutBlogArticles.map(article => <BlogCard article={article} variant="about" key={article.slug} />)}</div></section>
  </main>
}
