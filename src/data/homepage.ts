import type { BlogBanner, DesignCategory, HeroBanner, NavigationItem, Product, ProductCategory } from '../types'

const photo = (id: string, alt: string, width = 900, height = 1100) => ({ src: `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`, alt, width, height })
const tee = (id: string, name: string, price: number, order: number): Product => ({ id: `product-${order}`, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, description: 'Premium heavyweight cotton t-shirt.', price, currency: 'USD', images: [photo(id, name)], category: 't-shirts', fit: 'Relaxed', colors: ['Stone'], sizes: ['S', 'M', 'L', 'XL'], editionType: order <= 5 ? 'limited' : 'regular', totalEditionCount: order <= 5 ? 100 : undefined, soldCount: order <= 5 ? 26 + order * 3 : undefined, remainingCount: order <= 5 ? 74 - order * 3 : undefined, availabilityStatus: 'available', featured: true, active: true, displayOrder: order })

export const navigation: NavigationItem[] = [{ id: 'collection', label: 'Collection', href: '/collection', active: true, displayOrder: 1 }, { id: 'about', label: 'About Us', href: '/about', active: true, displayOrder: 2 }]
export const collectionItems: NavigationItem[] = [{ id: 'limited', label: 'Limited Designs', href: '/collection/limited', active: true, displayOrder: 1 }, { id: 'regular', label: 'Regular Designs', href: '/collection/regular', active: true, displayOrder: 2 }, { id: 'sold-out', label: 'Sold Out Designs', href: '/collection/sold-out', active: true, displayOrder: 3 }]
export const heroBanners: HeroBanner[] = [
  photo('photo-1529139574466-a303027c1d8b', 'Model wearing a white Percent t-shirt', 1800, 1000),
  photo('photo-1515886657613-9f3515b0c78f', 'Streetwear model in a fashion campaign', 1800, 1000),
  photo('photo-1496747611176-843222e1e57c', 'Editorial portrait in a fashion campaign', 1800, 1000),
  photo('photo-1539109136881-3be0616acf4b', 'Minimal apparel campaign in warm tones', 1800, 1000),
].map((image, index) => ({ id: `hero-${index + 1}`, image: image.src, alt: image.alt, width: image.width, height: image.height, active: true, displayOrder: index + 1 }))
export const regularEditions = [
  tee('photo-1521572163474-6864f9cf17ab', 'Sable Logo Tee', 42, 6), tee('photo-1503341504253-dff4815485f1', 'Off Script Tee', 45, 7), tee('photo-1618354691373-d851c5c3a990', 'Percent Type Tee', 44, 8), tee('photo-1576566588028-4147f3842f27', 'Clean Slate Tee', 40, 9), tee('photo-1485230895905-ec40ba36b9bc', 'Everyday Tee', 42, 10),
]
export const homepageProducts: Product[] = [tee('photo-1583743814966-8936f37f4678', 'Ink Bloom Tee', 54, 1), tee('photo-1586790170083-2f9ceadc732d', 'Echo Script Tee', 52, 2), tee('photo-1527719327859-2e3f8b4d89f8', 'Fragment Tee', 56, 3), tee('photo-1620799140408-edc6dcb6d633', 'Silent Waves Tee', 53, 4), tee('photo-1490481651871-ab68de25d43d', 'Studio Mark Tee', 55, 5)]
export const limitedProducts = homepageProducts.filter((product) => product.editionType === 'limited' && product.active).sort((first, second) => first.displayOrder - second.displayOrder).slice(0, 5)
export const newArrivals: Product[] = homepageProducts.slice(0, 4)
export const categories: ProductCategory[] = [{ id: 'regular', slug: 'regular-t-shirts', title: 'Regular T-Shirts', products: regularEditions.slice(0, 4), active: true, displayOrder: 1 }, { id: 'oversized', slug: 'oversized-t-shirts', title: 'Oversized T-Shirts', products: regularEditions.slice(1, 4), active: true, displayOrder: 2, promo: { image: photo('photo-1506629905607-d405b7a30db5', 'Model in oversized black t-shirt', 900, 1100), copy: 'LESS\nORDINARY.\nMORE YOU.' } }]
export const designs: DesignCategory[] = [['quotes', 'Quotes', 'photo-1520975958225-85fdf45d7b20'], ['landscapes', 'Landscapes', 'photo-1523398002811-999ca8dec234'], ['abstract', 'Abstract', 'photo-1490481651871-ab68de25d43d'], ['minimal', 'Minimal', 'photo-1512436991641-6745cdb1723f']].map(([slug, title, src], index) => ({ id: slug, slug, title, image: photo(src, `${title} apparel collection`, 1100, 600), active: true, displayOrder: index + 1 }))
export const blogBanner: BlogBanner = { id: 'journal', title: 'Our Blogs', image: photo('photo-1551488831-00ddcb6c6bd3', 'Close up of black apparel texture', 1600, 650), href: '/blog', active: true }
