import { getPublicShopProducts } from './shop'
import type { Product } from '../types'

export interface ArchivedProduct extends Product {
  archiveNumber: string
  archivedAt: string
}

const archiveSeeds = [
  { sourceSlug: 'studio-mark-tee', archivedAt: '2026-08-21' },
  { sourceSlug: 'afterimage-tee', archivedAt: '2026-08-14' },
  { sourceSlug: 'night-signal-tee', archivedAt: '2026-08-02' },
  { sourceSlug: 'parallel-lines-tee', archivedAt: '2026-07-18' },
  { sourceSlug: 'edition-no-09-tee', archivedAt: '2026-07-04' },
  { sourceSlug: 'common-ground-tee', archivedAt: '2026-06-20' },
  { sourceSlug: 'quiet-geometry-tee', archivedAt: '2026-06-06' },
  { sourceSlug: 'soft-focus-tee', archivedAt: '2026-05-24' },
]

const sourceProducts = new Map(getPublicShopProducts().map((product) => [product.slug, product]))

const archivedProducts: ArchivedProduct[] = archiveSeeds.flatMap((seed, index) => {
  const source = sourceProducts.get(seed.sourceSlug)
  if (!source) return []
  const archiveNumber = String(index + 1).padStart(3, '0')
  return [{
    ...source,
    id: `archive-${source.id}`,
    slug: `archive-${source.slug}`,
    description: `${source.description} Archive ${archiveNumber}: one hundred pieces made, one hundred pieces collected.`,
    status: 'published',
    isAvailable: false,
    isSoldOut: true,
    isShopAvailable: false,
    totalPieces: 100,
    soldPieces: 100,
    remainingPieces: 0,
    editionTotal: 100,
    editionSold: 100,
    editionRemaining: 0,
    editionBadge: 'Archived',
    retirementState: 'retired',
    availabilityStatus: 'sold-out',
    launchDate: seed.archivedAt,
    archiveNumber,
    archivedAt: seed.archivedAt,
  }]
})

export const getArchivedProducts = () => archivedProducts
export const getArchivedProductBySlug = (slug: string) => archivedProducts.find((product) => product.slug === slug)
