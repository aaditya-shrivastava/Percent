export type EditionType = 'limited' | 'regular'

export interface ProductImage { src: string; alt: string; width: number; height: number }
export interface Product { id: string; slug: string; name: string; description: string; price: number; currency: string; images: ProductImage[]; category: string; fit: string; colors: string[]; sizes: string[]; editionType: EditionType; totalEditionCount?: number; soldCount?: number; remainingCount?: number; availabilityStatus: 'available' | 'low-stock' | 'sold-out'; featured: boolean; active: boolean; displayOrder: number }
export interface ProductCategory { id: string; slug: string; title: string; products: Product[]; active: boolean; displayOrder: number; promo?: { image: ProductImage; copy: string } }
export interface HeroBanner { id: string; image: string; alt: string; width: number; height: number; active: boolean; displayOrder: number }
export interface LimitedEdition { id: string; name: string; image: ProductImage; soldCount?: number; active: boolean; displayOrder: number; href: string }
export interface DesignCategory { id: string; slug: string; title: string; image: ProductImage; active: boolean; displayOrder: number }
export interface BlogBanner { id: string; title: string; image: ProductImage; href: string; active: boolean }
export interface NavigationItem { id: string; label: string; href: string; active: boolean; displayOrder: number }
export interface FooterLink { label: string; to: string }
export interface FooterGroup { title: string; links: FooterLink[] }
export interface HomepageSection { id: string; title: string; active: boolean; displayOrder: number; ctaLabel?: string; ctaHref?: string }
