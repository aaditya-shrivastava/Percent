export type FitType = 'standard' | 'oversized'

export interface ProductImage { src: string; alt: string; width: number; height: number }
export interface Product { id: string; slug: string; name: string; description: string; price: number; currency: string; images: ProductImage[]; category: string; fitType: FitType; colors: string[]; sizes: string[]; isLimitedEdition: boolean; isBestSeller: boolean; isTrending: boolean; collaboratorName?: string; collaboratorImage?: ProductImage; collaborationTitle?: string; collaborationDescription?: string; editionTotal?: number; editionSold?: number; editionRemaining?: number; editionBadge?: string; tags?: string[]; launchDate?: string; retirementState?: 'active' | 'retired' | 'sold-out'; salesCount?: number; availabilityStatus: 'available' | 'low-stock' | 'sold-out'; featured: boolean; active: boolean; displayOrder: number }
export interface ProductCategory { id: string; slug: string; title: string; products: Product[]; active: boolean; displayOrder: number; promo?: { image: ProductImage; copy: string } }
export interface HeroBanner { id: string; image: string; alt: string; width: number; height: number; active: boolean; displayOrder: number }
export interface DesignCategory { id: string; slug: string; title: string; image: ProductImage; active: boolean; displayOrder: number }
export interface BlogBanner { id: string; title: string; image: ProductImage; href: string; active: boolean }
export interface NavigationItem { id: string; label: string; href: string; active: boolean; displayOrder: number }
export interface FooterLink { label: string; to: string }
export interface FooterGroup { title: string; links: FooterLink[] }
export interface HomepageSection { id: string; title: string; active: boolean; displayOrder: number; ctaLabel?: string; ctaHref?: string }
