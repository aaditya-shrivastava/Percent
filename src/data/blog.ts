export type BlogCategory = 'Brand' | 'Design' | 'Style' | 'Process' | 'Community'

export interface BlogImage {
  src: string
  alt: string
  width: number
  height: number
}

export interface BlogSection {
  heading: string
  paragraphs: string[]
}

export interface BlogArticle {
  slug: string
  title: string
  excerpt: string
  introduction: string
  category: BlogCategory
  date: string
  author: string
  image: BlogImage
  secondaryImage?: BlogImage
  featured: boolean
  sections: BlogSection[]
  pullQuote: string
}

const image = (id: string, alt: string, width = 1200, height = 900): BlogImage => ({
  src: `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`,
  alt,
  width,
  height,
})

export const blogCategories = ['All', 'Brand', 'Design', 'Style', 'Process', 'Community'] as const

export const blogArticles: BlogArticle[] = [
  {
    slug: 'the-story-behind-100-pieces', title: 'The Story Behind 100 Pieces', category: 'Brand', date: '2026-08-12', author: 'Percent Journal', featured: true,
    excerpt: 'Why limitation creates freedom — and why every Percent design disappears after the hundredth piece.',
    introduction: 'A clear ending gives every design meaning. One hundred pieces is enough to create a community without making the experience ordinary.',
    image: image('photo-1515886657613-9f3515b0c78f', 'Limited Percent streetwear photographed in the city', 1600, 1100),
    secondaryImage: image('photo-1551488831-00ddcb6c6bd3', 'Close view of premium apparel texture and construction', 1200, 800),
    sections: [
      { heading: 'Why 100?', paragraphs: ['A fixed edition asks us to make clearer decisions. Every line, proportion and print has to earn its place before production begins.', 'The number is intentionally human: small enough to remain rare, yet large enough for one design to become part of many individual stories.'] },
      { heading: 'Why Not Restock?', paragraphs: ['Restocking would turn a promise into a marketing phrase. When the final piece leaves, the design is retired and the next idea gets room to exist.'] },
      { heading: 'Designing With an Ending', paragraphs: ['Knowing a design has an ending changes how we make it and how it is worn. The piece becomes a timestamp rather than an endlessly repeated product.'] },
    ],
    pullQuote: 'Once the hundredth piece is gone, that design becomes part of Percent history.',
  },
  {
    slug: 'the-power-of-limited', title: 'The Power of Limited', category: 'Brand', date: '2026-08-05', author: 'Percent Journal', featured: false,
    excerpt: 'Why fewer pieces create stronger connections.',
    introduction: 'Limited design is not about creating urgency. It is about creating focus, value and a stronger relationship with what we choose to own.',
    image: image('photo-1523398002811-999ca8dec234', 'A considered streetwear collection in neutral tones'),
    sections: [
      { heading: 'Fewer, Better Choices', paragraphs: ['When options become endless, character can disappear. A smaller edition gives one idea the space to be understood and remembered.'] },
      { heading: 'A Shared Connection', paragraphs: ['Every owner is part of a group that can never grow beyond the edition. The connection is quiet, but it is real.'] },
      { heading: 'Rarity With Purpose', paragraphs: ['For Percent, rarity is a result of restraint. We stop because the boundary is part of the design.'] },
    ],
    pullQuote: 'Limitation is not less possibility. It is more intention.',
  },
  {
    slug: 'intentional-design', title: 'Intentional Design', category: 'Design', date: '2026-07-28', author: 'Percent Journal', featured: false,
    excerpt: 'A look into how Percent pieces move from idea to finished form.',
    introduction: 'Every Percent piece begins with a reason. The process removes what is unnecessary until the idea feels direct, wearable and distinct.',
    image: image('photo-1551488831-00ddcb6c6bd3', 'Apparel materials used during the Percent design process'),
    secondaryImage: image('photo-1521572163474-6864f9cf17ab', 'Finished shirts arranged after production', 1200, 800),
    sections: [
      { heading: 'Start With Meaning', paragraphs: ['We begin with a thought rather than a trend. References are collected, challenged and reduced into one clear visual direction.'] },
      { heading: 'Refine the Form', paragraphs: ['Placement, scale and negative space are tested on the garment itself. The design has to work while moving, not only on a screen.'] },
      { heading: 'Finish With Restraint', paragraphs: ['A piece is ready when nothing feels accidental. Production begins only after the material and artwork support the same intention.'] },
    ],
    pullQuote: 'The strongest detail is often the one that knows when to stop.',
  },
  {
    slug: 'style-in-real-life', title: 'Style in Real Life', category: 'Community', date: '2026-07-19', author: 'Percent Journal', featured: false,
    excerpt: 'How people make Percent their own.',
    introduction: 'A garment is unfinished until someone wears it. Personal styling gives every limited piece a second creative life beyond the studio.',
    image: image('photo-1529139574466-a303027c1d8b', 'Streetwear styled with a personal point of view'),
    sections: [
      { heading: 'One Piece, Different Stories', paragraphs: ['The same shirt can feel quiet, graphic, polished or relaxed depending on the person wearing it. That variation is the point.'] },
      { heading: 'Beyond the Lookbook', paragraphs: ['Campaign images introduce a direction. The community takes it further by mixing Percent with the clothes and objects that already matter to them.'] },
      { heading: 'Wear It Your Way', paragraphs: ['There is no required uniform. The most convincing style always looks lived in rather than prescribed.'] },
    ],
    pullQuote: 'Identity begins where styling rules end.',
  },
  {
    slug: 'inside-the-studio', title: 'Inside the Studio', category: 'Process', date: '2026-07-10', author: 'Percent Journal', featured: false,
    excerpt: 'Ideas, experiments and everything between concept and production.',
    introduction: 'The studio is where unfinished thoughts become physical decisions through testing, comparison and constant editing.',
    image: image('photo-1527719327859-2e3f8b4d89f8', 'Creative work taking shape inside a minimal studio'),
    sections: [
      { heading: 'Collect and Question', paragraphs: ['References come from typography, architecture, conversations and ordinary details. We keep only what supports the central idea.'] },
      { heading: 'Test in Context', paragraphs: ['Artwork is printed, worn and observed at real scale. A successful composition has to remain clear from across a room and interesting up close.'] },
      { heading: 'Make the Final Call', paragraphs: ['The last stage is subtraction. We remove competing details so the final garment feels confident rather than crowded.'] },
    ],
    pullQuote: 'The studio is less about inspiration than it is about better decisions.',
  },
  {
    slug: 'designing-for-self-expression', title: 'Designing for Self-Expression', category: 'Design', date: '2026-06-30', author: 'Percent Journal', featured: false,
    excerpt: 'Why clothing should feel personal rather than repetitive.',
    introduction: 'Good clothing supports the person inside it. It creates room for expression without demanding that everyone look the same.',
    image: image('photo-1490481651871-ab68de25d43d', 'Individual fashion styling in an editorial setting'),
    sections: [
      { heading: 'Design as a Starting Point', paragraphs: ['We create a clear point of view, but never a complete instruction. The wearer decides what the piece becomes in daily life.'] },
      { heading: 'Silhouette and Confidence', paragraphs: ['Fit changes posture and movement. Standard and oversized forms offer different energies while preserving the same design language.'] },
      { heading: 'Make It Personal', paragraphs: ['The best styling choice is the one that feels recognisable to you, not the one most frequently repeated by others.'] },
    ],
    pullQuote: 'Clothing should frame identity, not replace it.',
  },
  {
    slug: 'less-ordinary', title: 'Less Ordinary.', category: 'Brand', date: '2026-06-21', author: 'Percent Journal', featured: false,
    excerpt: 'The thinking behind the Percent identity.',
    introduction: 'Less Ordinary is not a request to be louder. It is an invitation to choose with more care and wear with more confidence.',
    image: image('photo-1539109136881-3be0616acf4b', 'Minimal fashion campaign built around individual identity'),
    sections: [
      { heading: 'A Clear Point of View', paragraphs: ['Percent exists between simplicity and expression. We use familiar forms, then introduce one decision that makes them distinct.'] },
      { heading: 'More You', paragraphs: ['The brand mark matters less than the person wearing it. Our role is to make pieces that support rather than overpower individual character.'] },
      { heading: 'Keep Moving', paragraphs: ['Every retired design makes space for a new direction. The identity remains consistent because the intention remains consistent.'] },
    ],
    pullQuote: 'Less ordinary does not mean more noise. It means more of you.',
  },
  {
    slug: 'from-fabric-to-final-piece', title: 'From Fabric to Final Piece', category: 'Process', date: '2026-06-12', author: 'Percent Journal', featured: false,
    excerpt: 'A closer look at material, print and production decisions.',
    introduction: 'The final piece is shaped by dozens of small choices that are rarely visible but always felt.',
    image: image('photo-1583743814966-8936f37f4678', 'Premium cotton garment prepared for final production'),
    secondaryImage: image('photo-1586790170083-2f9ceadc732d', 'Finished apparel showing material and print detail', 1200, 800),
    sections: [
      { heading: 'Begin With the Hand Feel', paragraphs: ['Weight, softness and recovery determine how a shirt lives beyond its first wear. The material must feel substantial without becoming rigid.'] },
      { heading: 'Print With Precision', paragraphs: ['Ink, pressure and placement are calibrated to suit the artwork and fabric. Consistency matters across every piece in the edition.'] },
      { heading: 'Inspect Every Detail', paragraphs: ['Each garment is checked before release so the experience feels considered from first touch to final wear.'] },
    ],
    pullQuote: 'Quality is the accumulation of decisions no one should have to notice.',
  },
  {
    slug: 'uniforms-reconsidered', title: 'Uniforms, Reconsidered', category: 'Style', date: '2026-06-03', author: 'Percent Journal', featured: false,
    excerpt: 'Building a personal wardrobe without becoming predictable.',
    introduction: 'A reliable wardrobe can still carry identity. Repetition becomes personal when proportion, texture and detail are chosen intentionally.',
    image: image('photo-1620799140408-edc6dcb6d633', 'A minimal everyday wardrobe styled with intention'),
    sections: [
      { heading: 'Repeat the Foundation', paragraphs: ['Strong everyday pieces reduce noise and make room for personal details. Consistency can be a signature rather than a limitation.'] },
      { heading: 'Change the Proportion', paragraphs: ['Fit creates variation without requiring excess. A familiar palette can feel completely different through shape and layering.'] },
      { heading: 'Keep One Point of Tension', paragraphs: ['An unexpected graphic, texture or accessory keeps a uniform from becoming anonymous. One deliberate contrast is often enough.'] },
    ],
    pullQuote: 'A uniform becomes personal through the choices that break its pattern.',
  },
]

export const featuredBlogArticle = blogArticles.find((article) => article.featured) ?? blogArticles[0]
export const aboutBlogArticles = ['the-power-of-limited', 'intentional-design', 'style-in-real-life'].map((slug) => blogArticles.find((article) => article.slug === slug)).filter((article): article is BlogArticle => Boolean(article))
export const getBlogArticle = (slug?: string) => blogArticles.find((article) => article.slug === slug)
export const formatBlogDate = (date: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T00:00:00`))
export const getRelatedBlogArticles = (article: BlogArticle, limit = 3) => [...blogArticles.filter((candidate) => candidate.slug !== article.slug)].sort((first, second) => Number(second.category === article.category) - Number(first.category === article.category)).slice(0, limit)
