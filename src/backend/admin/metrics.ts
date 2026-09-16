import type { Database } from '../database.types'
type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type DateRange = '7' | '30' | '90' | 'all'
type StockProduct = Pick<Row<'products'>, 'id' | 'name' | 'slug' | 'status' | 'is_visible' | 'is_shop_available' | 'production_limit'>
type Unit = Pick<Row<'inventory_units'>, 'product_id' | 'variant_id' | 'sold_at' | 'withdrawn_at'>
export interface StockAlert { id: string; name: string; kind: 'Low Stock' | 'Sold Out' | 'Run Near Limit'; allocated: number; sold: number; remaining: number; limit: number }
export function startOfRange(range: DateRange, now = new Date()) {
  if (range === 'all') return null
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - Number(range) + 1)
  return start.toISOString()
}

export function deriveStockAlerts(products: StockProduct[], units: Unit[], enabledVariantIds: Set<string>): StockAlert[] {
  const counts = new Map<string, { allocated: number; sold: number; available: number }>()
  for (const unit of units) {
    const count = counts.get(unit.product_id) ?? { allocated: 0, sold: 0, available: 0 }
    count.allocated++
    if (unit.sold_at) count.sold++
    else if (!unit.withdrawn_at && enabledVariantIds.has(unit.variant_id)) count.available++
    counts.set(unit.product_id, count)
  }
  return products.flatMap(p => {
    if (p.status === 'draft') return []
    const count = counts.get(p.id) ?? { allocated: 0, sold: 0, available: 0 }
    const remaining = p.status === 'active' && p.is_shop_available ? count.available : 0
    const kind = count.sold >= p.production_limit ? 'Sold Out' : p.status !== 'active' ? null : count.sold >= Math.ceil(p.production_limit * .9) ? 'Run Near Limit' : remaining > 0 && remaining <= Math.max(1, Math.ceil(p.production_limit * .1)) ? 'Low Stock' : null
    return kind ? [{ id: p.id, name: p.name, kind, allocated: count.allocated, sold: count.sold, remaining, limit: p.production_limit } as StockAlert] : []
  })
}

