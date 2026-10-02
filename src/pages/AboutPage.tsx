import { ArrowRight } from 'lucide-react'
import { Fragment, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BlogCard } from '../components/blog/BlogCard'
import { useWebsitePage, WebsitePageError } from '../components/layout/WebsitePageContext'
import type { PageSection } from '../backend/websitePages'
import { aboutCollaborators, aboutValues } from '../data/about'
import { aboutBlogArticles } from '../data/blog'
import './AboutPage.css'

const aboutStoryImage = {
  src: '/images/about-story-editorial.webp',
  alt: 'Model wearing a burgundy oversized T-shirt against a warm stone studio wall',
  width: 1122,
  height: 1402,
}

function AboutBlock({ item }: { item: PageSection }) {
  if (item.section_key === 'statement') return <section className="about-statement" aria-label="Percent lifestyle statement"><h2 style={{ whiteSpace: 'pre-line' }}>{item.heading}</h2></section>
  if (item.section_key === 'limited') return <section className="about-limited-message"><p>{item.body?.split('\n').map((line, index) => <span key={index}>{line}{' '}</span>)}</p></section>
  if (item.section_key === 'values') return <section className="about-values" aria-labelledby="about-values-title"><header><p>{item.body}</p><h2 id="about-values-title">{item.heading}</h2></header><div>{aboutValues.map((value, index) => <article key={value}><span>{String(index + 1).padStart(2, '0')}</span><h3>{value}</h3></article>)}</div></section>
  if (item.section_key === 'identity') { const image = aboutStoryImage; return <section className="about-identity" aria-labelledby="about-identity-title"><img src={image.src} alt={image.alt} width={image.width} height={image.height} loading="lazy" /><div><p>% PERCENT</p><h2 id="about-identity-title" style={{ whiteSpace: 'pre-line' }}>{item.heading}</h2><span>{item.body}</span>{item.cta_path && item.cta_label && <Link to={item.cta_path}>{item.cta_label} <ArrowRight /></Link>}</div></section> }
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
    {blocks.map(item => <Fragment key={item.section_key}>
      {item.section_key === 'limited' && <section className="about-shop-banner about-shop-banner-a" aria-label="Explore the Percent collection">
        <Link to="/shop" aria-label="Explore the shop">
          <img src="/images/about-shop-burgundy-knit.png" alt="Model wearing a burgundy knit sweater and cream trousers in a minimal editorial setting" width={1672} height={941} loading="lazy" />
          <span>Explore the shop <ArrowRight aria-hidden="true" /></span>
        </Link>
      </section>}
      <AboutBlock item={item} />
      {item.section_key === 'limited' && <section className="about-shop-banner" aria-label="Explore the Percent shop">
        <Link to="/shop" aria-label="Shop the collection">
          <img src="/images/about-pre-delivery-editorial.png" alt="Model in a burgundy knit sweater and cream trousers in a sunlit stone setting. Explore our world. Wear what stays. Limited pieces. Intentional designs. Made for a more you." width={1935} height={812} loading="lazy" />
          <span>Shop the collection <ArrowRight aria-hidden="true" /></span>
        </Link>
      </section>}
    </Fragment>)}
    <section className="about-collaborators" aria-labelledby="about-collaborators-title"><header><p>Creative community</p><h2 id="about-collaborators-title">Collaborators</h2></header><div>{aboutCollaborators.map(collaborator => <article key={collaborator}><span>{collaborator}</span></article>)}</div></section>
    <section className="about-blog" aria-labelledby="about-blog-title"><header><div><p>Percent Journal</p><h2 id="about-blog-title">From the Blog</h2><span>Thoughts, stories and a closer look at what drives % Percent.</span></div><Link to="/blog">View All Blogs <ArrowRight /></Link></header><div className="about-blog-grid">{aboutBlogArticles.map(article => <BlogCard article={article} variant="about" key={article.slug} />)}</div></section>
  </main>
}
