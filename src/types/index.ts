export type FitType = 'standard' | 'oversized'
export type ProductStatus = 'draft' | 'published' | 'archived'

export interface ProductImage { src: string; alt: string; width: number; height: number; id?: string; role?: 'primary' | 'hover' | 'front' | 'back' | 'model' | 'detail' | 'gallery'; sortOrder?: number }
export interface ProductColour { id: string; label: string; slug: string; swatchValue: string }
export interface ProductTag { id: string; name: string; slug: string; group: string; isFilterable: boolean; isActive: boolean; displayOrder: number }
export interface ProductVariant { id: string; colour: ProductColour; size: string; price: number; compareAtPrice?: number; isAvailable: boolean; stock: number; images?: ProductImage[] }
export interface ProductReview { id: string; rating: number; customerName: string; text: string; date: string; images?: ProductImage[]; status: 'published' | 'pending' | 'rejected' }
export interface ProductDetails extends Product { shortDescription: string; fullDescription: string; material: string; style?: string; careInstructions?: string; variants: ProductVariant[]; collaborator?: { name: string; title?: string; description?: string; image?: ProductImage }; reviewSummary: { averageRating: number; reviewCount: number }; reviews: ProductReview[]; shippingAndReturns?: string }
export interface Product { id: string; slug: string; name: string; description: string; price: number; compareAtPrice?: number; currency: string; images: ProductImage[]; hoverImage?: ProductImage; category: string; fitType: FitType; colors: ProductColour[]; sizes: string[]; status: ProductStatus; isVisible: boolean; isAvailable: boolean; isSoldOut: boolean; isShopAvailable: boolean; isDeleted: boolean; totalPieces: number; soldPieces: number; remainingPieces: number; isLimitedEdition: boolean; isBestSeller: boolean; isTrending: boolean; isNew?: boolean; collaboratorName?: string; collaboratorImage?: ProductImage; collaborationTitle?: string; collaborationDescription?: string; editionTotal?: number; editionSold?: number; editionRemaining?: number; editionBadge?: string; tags?: ProductTag[]; launchDate?: string; retirementState?: 'active' | 'retired' | 'sold-out'; salesCount?: number; availabilityStatus: 'available' | 'low-stock' | 'sold-out'; featured: boolean; active: boolean; displayOrder: number }
export interface ProductCategory { id: string; slug: string; title: string; products: Product[]; active: boolean; displayOrder: number; promo?: { image: ProductImage; copy: string } }
export interface HeroBanner { id: string; image: string; alt: string; width: number; height: number; active: boolean; displayOrder: number }
export interface DesignCategory { id: string; slug: string; title: string; image: ProductImage; active: boolean; displayOrder: number }
export interface BlogBanner { id: string; title: string; image: ProductImage; href: string; active: boolean }
export interface NavigationItem { id: string; label: string; href: string; active: boolean; displayOrder: number }
export interface FooterLink { label: string; to: string }
export interface FooterGroup { title: string; links: FooterLink[] }
export interface HomepageSection { id: string; title: string; active: boolean; displayOrder: number; ctaLabel?: string; ctaHref?: string }
