import { ArrowRight } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BlogCard } from '../components/blog/BlogCard'
import { aboutCollaborators, aboutImages, aboutValues } from '../data/about'
import { aboutBlogArticles } from '../data/blog'

export function AboutPage() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'About Percent | Less Ordinary. More You.'
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]') ?? document.head.appendChild(document.createElement('meta'))
    description.name = 'description'
    description.content = 'Meet Percent: intentional design, limited drops and only 100 chances for every piece to exist.'
    return () => { document.title = previousTitle }
  }, [])

  return <main className="about-page">
    <section className="about-intro" aria-labelledby="about-intro-title">
      <p className="about-kicker">This is Percent</p>
      <h1 id="about-intro-title">Not Just A Brand,<br />It makes you unique.</h1>
      <p>PERCENT was built for the once who keep it real.<br />Every drop is limited. Every piece is intentional.<br /><strong>less ordinary, More you</strong></p>
    </section>

    <section className="about-statement" aria-label="Percent lifestyle statement">
      <h2>When you look good, you feel unstoppable.<br />Your outfit is your first impression.</h2>
    </section>

    <section className="about-live" aria-label="Percent live collection">
      <img src={aboutImages.live.src} alt={aboutImages.live.alt} width={aboutImages.live.width} height={aboutImages.live.height} />
      <Link to="/shop">Live Now <ArrowRight /></Link>
    </section>

    <section className="about-limited-message">
      <p>Every design gets only 100 chances to exist.<br />Once they’re gone, they’re gone forever.<br />No restocks, no repeats — just something made to be truly limited.</p>
    </section>

    <section className="about-values" aria-labelledby="about-values-title">
      <header><p>Our promise</p><h2 id="about-values-title">What we Deliver.</h2></header>
      <div>{aboutValues.map((value, index) => <article key={value}><span>{String(index + 1).padStart(2, '0')}</span><h3>{value}</h3></article>)}</div>
    </section>

    <section className="about-craft" aria-label="Percent craft values">
      <img src={aboutImages.craft.src} alt={aboutImages.craft.alt} width={aboutImages.craft.width} height={aboutImages.craft.height} loading="lazy" />
      <div>{['Comfort', 'Confidence', 'Class'].map((value) => <strong key={value}>{value}</strong>)}</div>
    </section>

    <section className="about-collaborators" aria-labelledby="about-collaborators-title">
      <header><p>Creative community</p><h2 id="about-collaborators-title">Collaborators</h2></header>
      <div>{aboutCollaborators.map((collaborator) => <article key={collaborator}><span>{collaborator}</span></article>)}</div>
    </section>

    <section className="about-blog" aria-labelledby="about-blog-title">
      <header><div><p>Percent Journal</p><h2 id="about-blog-title">From the Blog</h2><span>Thoughts, stories and a closer look at what drives % Percent.</span></div><Link to="/blog">View All Blogs <ArrowRight /></Link></header>
      <div className="about-blog-grid">{aboutBlogArticles.map((article) => <BlogCard article={article} variant="about" key={article.slug} />)}</div>
    </section>

    <section className="about-identity" aria-labelledby="about-identity-title">
      <img src={aboutImages.identity.src} alt={aboutImages.identity.alt} width={aboutImages.identity.width} height={aboutImages.identity.height} loading="lazy" />
      <div><p>% PERCENT</p><h2 id="about-identity-title">Where Elegance<br />Meets Identity</h2><span>Intentional design, clean silhouettes and only 100 pieces of every limited creation. Made for people who wear their identity with confidence.</span><Link to="/shop">Explore the Store <ArrowRight /></Link></div>
    </section>
  </main>
}
