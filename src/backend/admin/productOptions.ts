import { supabase } from '../client'

export interface ProductColorOption {
  id: string
  name: string
  normalized_name: string
  hex_code: string
  enabled: boolean
  sort_order: number
  created_at: string
  updated_at: string
  usage_count: number
}

export interface ProductSizeOption {
  id: string
  label: string
  normalized_label: string
  enabled: boolean
  sort_order: number
  created_at: string
  updated_at: string
  usage_count: number
}

export interface ProductOptionsDocument {
  colors: ProductColorOption[]
  sizes: ProductSizeOption[]
}

export class ProductOptionsFailure extends Error {
  constructor(
    public readonly kind: 'conflict' | 'duplicate' | 'denied' | 'used' | 'invalid' | 'unavailable',
    message?: string,
  ) {
    super(message ?? kind)
    this.name = 'ProductOptionsFailure'
  }
}

const text = (record: Record<string, unknown>, key: string) => typeof record[key] === 'string' ? record[key] : null
const number = (record: Record<string, unknown>, key: string) => typeof record[key] === 'number' ? record[key] : null

function color(value: unknown): ProductColorOption {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ProductOptionsFailure('unavailable')
  const row = value as Record<string, unknown>
  const parsed = {
    id: text(row, 'id'), name: text(row, 'name'), normalized_name: text(row, 'normalized_name'), hex_code: text(row, 'hex_code'),
    enabled: row.enabled, sort_order: number(row, 'sort_order'), created_at: text(row, 'created_at'), updated_at: text(row, 'updated_at'), usage_count: number(row, 'usage_count'),
  }
  if (!parsed.id || !parsed.name || !parsed.normalized_name || !parsed.hex_code || typeof parsed.enabled !== 'boolean' || parsed.sort_order === null || !parsed.created_at || !parsed.updated_at || parsed.usage_count === null) throw new ProductOptionsFailure('unavailable')
  return parsed as ProductColorOption
}

function size(value: unknown): ProductSizeOption {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ProductOptionsFailure('unavailable')
  const row = value as Record<string, unknown>
  const parsed = {
    id: text(row, 'id'), label: text(row, 'label'), normalized_label: text(row, 'normalized_label'), enabled: row.enabled,
    sort_order: number(row, 'sort_order'), created_at: text(row, 'created_at'), updated_at: text(row, 'updated_at'), usage_count: number(row, 'usage_count'),
  }
  if (!parsed.id || !parsed.label || !parsed.normalized_label || typeof parsed.enabled !== 'boolean' || parsed.sort_order === null || !parsed.created_at || !parsed.updated_at || parsed.usage_count === null) throw new ProductOptionsFailure('unavailable')
  return parsed as ProductSizeOption
}

function document(value: unknown): ProductOptionsDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ProductOptionsFailure('unavailable')
  const record = value as Record<string, unknown>
  if (!Array.isArray(record.colors) || !Array.isArray(record.sizes)) throw new ProductOptionsFailure('unavailable')
  return { colors: record.colors.map(color), sizes: record.sizes.map(size) }
}

function failure(error: { code?: string; message?: string } | null) {
  if (error?.code === 'PT409') return new ProductOptionsFailure('conflict', error.message)
  if (error?.code === '23505') return new ProductOptionsFailure('duplicate', error.message)
  if (error?.code === '42501') return new ProductOptionsFailure('denied', error.message)
  if (error?.code === '22023' && /used by existing product variants/i.test(error.message ?? '')) return new ProductOptionsFailure('used', error.message)
  if (error?.code === '22023' || error?.code === 'P0002') return new ProductOptionsFailure('invalid', error.message)
  return new ProductOptionsFailure('unavailable', error?.message)
}

export async function listProductOptions(signal?: AbortSignal) {
  let request = supabase.rpc('admin_list_product_options')
  if (signal) request = request.abortSignal(signal)
  const { data, error } = await request
  if (error) throw failure(error)
  return document(data)
}

export async function saveProductColorOption(input: Pick<ProductColorOption, 'id' | 'name' | 'hex_code' | 'enabled' | 'sort_order' | 'updated_at'> | Omit<Pick<ProductColorOption, 'name' | 'hex_code' | 'enabled' | 'sort_order'>, never>) {
  const existing = 'id' in input
  const { error } = await supabase.rpc('save_product_color_option', {
    option_id: existing ? input.id : null,
    option_name: input.name,
    hex_code: input.hex_code,
    option_enabled: input.enabled,
    option_sort_order: input.sort_order,
    expected_updated_at: existing ? input.updated_at : null,
  })
  if (error) throw failure(error)
}

export async function saveProductSizeOption(input: Pick<ProductSizeOption, 'id' | 'label' | 'enabled' | 'sort_order' | 'updated_at'> | Omit<Pick<ProductSizeOption, 'label' | 'enabled' | 'sort_order'>, never>) {
  const existing = 'id' in input
  const { error } = await supabase.rpc('save_product_size_option', {
    option_id: existing ? input.id : null,
    option_label: input.label,
    option_enabled: input.enabled,
    option_sort_order: input.sort_order,
    expected_updated_at: existing ? input.updated_at : null,
  })
  if (error) throw failure(error)
}

export async function reorderProductOptions(type: 'color' | 'size', options: Array<ProductColorOption | ProductSizeOption>) {
  const { error } = await supabase.rpc('admin_reorder_product_options', {
    option_type: type,
    ordered_ids: options.map(option => option.id),
    expected_updated_at: options.map(option => option.updated_at),
  })
  if (error) throw failure(error)
}
