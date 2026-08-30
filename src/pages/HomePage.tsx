import { BestSellersCarousel, DesignGrid, Hero, LimitedEditions, ProductSection, StorySection } from '../components/sections/HomeSections'
import { categories, newArrivals, trendingProducts } from '../data/homepage'

export function HomePage() { return <main><Hero /><LimitedEditions /><BestSellersCarousel /><ProductSection title="Trending" description="Styles getting noticed right now." emptyMessage="Trending pieces will appear here soon." products={trendingProducts} /><ProductSection title="New Arrivals" products={newArrivals} />{categories.map((category) => <ProductSection key={category.id} title={category.title} products={category.products} promo={category.promo} />)}<DesignGrid /><StorySection /></main> }
