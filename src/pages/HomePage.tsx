import { Hero, LimitedEditions, ProductSection, RegularCarousel, DesignGrid, StoryAndBlog } from '../components/sections/HomeSections'
import { categories, newArrivals } from '../data/homepage'

export function HomePage() { return <main><Hero /><LimitedEditions /><RegularCarousel /><ProductSection title="New Arrivals" products={newArrivals} />{categories.map((category) => <ProductSection key={category.id} title={category.title} products={category.products} promo={category.promo} />)}<DesignGrid /><StoryAndBlog /></main> }
