import { deriveStockAlerts, startOfRange, type DateRange, type StockAlert } from './metrics'
export { startOfRange } from './metrics'
export type { DateRange } from './metrics'
import { supabase } from '../client'
import { getAdminAccess } from './role'
import type { Database } from '../database.types'

type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
type StockProduct = Pick<Row<'products'>, 'id' | 'name' | 'slug' | 'status' | 'is_visible' | 'is_shop_available' | 'production_limit'>
type Unit = Pick<Row<'inventory_units'>, 'product_id' | 'variant_id' | 'sold_at' | 'withdrawn_at'>
type Order = Pick<Row<'orders'>, 'id' | 'user_id' | 'order_reference' | 'status' | 'payment_status' | 'total_paise' | 'created_at'>
export interface DashboardData {
  revenuePaise: number; orderCount: number; registeredAccounts: number; liveProducts: number; draftProducts: number; pendingReviews: number
  sales: { date: string; paise: number }[]
  recentOrders: (Order & { customer: string; products: string })[]
  alerts: StockAlert[]
}

// Fetch every page explicitly: do not silently truncate dashboard totals at the
// Data API's per-request row cap. Errors discard the whole dashboard snapshot.
async function pages<T>(read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const result: T[] = []
  for (let from = 0; ; from += 500) {
    const { data, error } = await read(from, from + 499)
    if (error || !data) throw new Error('Dashboard unavailable')
    result.push(...data)
    if (data.length < 500) return result
  }
}

export async function loadDashboard(userId: string, range: DateRange, signal: AbortSignal): Promise<DashboardData> {
  if ((await getAdminAccess(userId)).status !== 'allowed') throw new Error('Dashboard unavailable')
  const since = startOfRange(range)
  const [orders, products, units, variants, accounts, pending] = await Promise.all([
    pages<Order>((from,to) => {
      let q = supabase.from('orders').select('id,user_id,order_reference,status,payment_status,total_paise,created_at').order('created_at', { ascending: false }).order('id').range(from,to).abortSignal(signal)
      if (since) q = q.gte('created_at',since)
      return q
    }),
    pages<StockProduct>((from,to) => supabase.from('products').select('id,name,slug,status,is_visible,is_shop_available,production_limit').order('id').range(from,to).abortSignal(signal)),
    pages<Unit>((from,to) => supabase.from('inventory_units').select('product_id,variant_id,sold_at,withdrawn_at').order('id').range(from,to).abortSignal(signal)),
    pages<Pick<Row<'product_variants'>,'id' | 'enabled'>>((from,to) => supabase.from('product_variants').select('id,enabled').order('id').range(from,to).abortSignal(signal)),
    supabase.from('profiles').select('id',{count:'exact',head:true}).abortSignal(signal),
    supabase.from('product_reviews').select('id',{count:'exact',head:true}).eq('status','pending').abortSignal(signal),
  ])
  if (accounts.error || pending.error || accounts.count === null || pending.count === null) throw new Error('Dashboard unavailable')
  const recent = orders.slice(0,5)
  const ids = recent.map(o=>o.id)
  const userIds = recent.flatMap(o=>o.user_id?[o.user_id]:[])
  const [items, customers] = await Promise.all([
    ids.length ? pages<Pick<Row<'order_items'>,'order_id' | 'product_name' | 'quantity'>>((from,to) => supabase.from('order_items').select('order_id,product_name,quantity').in('order_id',ids).order('id').range(from,to).abortSignal(signal)) : [],
    userIds.length ? supabase.from('profiles').select('id,display_name').in('id',userIds).abortSignal(signal) : {data:[],error:null},
  ])
  if (customers.error) throw new Error('Dashboard unavailable')
  const completed = orders.filter(o=>o.payment_status==='paid' && o.status==='completed')
  const daily = new Map<string,number>()
  for (const order of completed) { const day=order.created_at.slice(0,10);daily.set(day,(daily.get(day)??0)+Number(order.total_paise)) }
  return {
    revenuePaise: completed.reduce((sum,o)=>sum+Number(o.total_paise),0), orderCount: orders.length,
    registeredAccounts: accounts.count, liveProducts: products.filter(p=>p.status==='active'&&p.is_visible).length,
    draftProducts: products.filter(p=>p.status==='draft').length, pendingReviews: pending.count,
    sales: [...daily].sort(([a],[b])=>a.localeCompare(b)).map(([date,paise])=>({date,paise})),
    recentOrders: recent.map(o=>({ ...o, customer: customers.data?.find(c=>c.id===o.user_id)?.display_name ?? 'Account unavailable', products: items.filter(i=>i.order_id===o.id).map(i=>`${i.quantity} × ${i.product_name}`).join(', ') || 'No item records' })),
    alerts: deriveStockAlerts(products,units,new Set(variants.filter(v=>v.enabled).map(v=>v.id))),
  }
}
