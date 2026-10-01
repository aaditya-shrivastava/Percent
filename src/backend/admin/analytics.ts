import { supabase } from '../client'

export type AnalyticsRange = '7' | '30' | '90' | 'all'
export interface AnalyticsTrend { start_at:string; confirmed_sales_paise:number; confirmed_orders:number; new_customers:number }
export interface ProductionMetric { product_id:string; name:string; slug:string; status:string; production_limit:number; allocated:number; sold:number; withdrawn:number; available:number; used:number; remaining_capacity:number; used_percent:number; production_exhausted:boolean; sold_out:boolean }
export interface AnalyticsData {
  range:{start_at:string;end_at:string;all_time:boolean;bucket:'day'|'week'|'month'}
  summary:{confirmed_sales_paise:number;confirmed_orders:number;units_sold:number;total_customers:number;new_customers:number;previous:null|{confirmed_sales_paise:number;confirmed_orders:number;units_sold:number;new_customers:number}}
  trend:AnalyticsTrend[]
  order_statuses:{status:string;count:number}[]
  top_products:{product_id:string;product_name:string;slug:string;units_sold:number;confirmed_sales_paise:number;production_limit:number;sold:number;withdrawn:number;available:number}[]
  production:ProductionMetric[]
  inventory:{available_units:number;sold_units:number;withdrawn_units:number;sold_out_designs:number;production_exhausted_designs:number;active_products:number}
  customers:{total_eligible:number;new_in_period:number;with_confirmed_orders:number;repeat_customers:number}
  coupons:{coupon_id:string;code:string;redemptions:number;discount_granted_paise:number;confirmed_sales_paise:number}[]
}

export const analyticsRangeLabels:Record<AnalyticsRange,string>={'7':'Last 7 days','30':'Last 30 days','90':'Last 90 days',all:'All time'}

export function analyticsBounds(range:AnalyticsRange, now=new Date()) {
  if(range==='all') return {start_at:null,end_at:null}
  return {start_at:new Date(now.getTime()-Number(range)*86400000).toISOString(),end_at:now.toISOString()}
}

function valid(data:unknown):data is AnalyticsData {
  if(!data||typeof data!=='object')return false
  const value=data as Partial<AnalyticsData>
  return !!value.range&&!!value.summary&&Array.isArray(value.trend)&&Array.isArray(value.order_statuses)&&Array.isArray(value.top_products)&&Array.isArray(value.production)&&!!value.inventory&&!!value.customers&&Array.isArray(value.coupons)
}

export async function loadAnalytics(range:AnalyticsRange,signal?:AbortSignal):Promise<AnalyticsData>{
  const {start_at,end_at}=analyticsBounds(range)
  const query=supabase.rpc('admin_get_analytics',{start_at,end_at})
  const {data,error}=signal?await query.abortSignal(signal):await query
  if(error||!valid(data))throw new Error('Analytics unavailable')
  return data
}
