export type CustomerFilter = 'all'|'has_orders'|'no_orders'|'recently_joined'
export type CustomerSort = 'newest'|'oldest'|'most_orders'|'highest_value'|'latest_order'
export interface CustomerFilters { search:string; filter:CustomerFilter; sort:CustomerSort }
export interface AdminCustomerSummary {
 id:string;display_name:string;first_name:string|null;last_name:string|null;phone:string|null;email:string|null;account_role:string|null
 created_at:string;updated_at:string;order_count:number;lifetime_order_value_paise:number;latest_order_at:string|null;address_count:number;review_count:number
}
export interface CustomerMetrics {total_customers:number;customers_with_orders:number;new_customers_current_utc_month:number;total_customer_order_value_paise:number}
export interface CustomerListResult {items:AdminCustomerSummary[];count:number;page:number;page_size:number;metrics:CustomerMetrics}
export interface CustomerAddress {id:string;label:string;is_default:boolean;full_name:string;phone:string;address_line1:string;address_line2:string;city:string;state:string;pin_code:string;country:string;created_at:string;updated_at:string}
export interface CustomerOrder {id:string;order_reference:string;status:string;payment_status:string;fulfillment_status:string;currency:string;total_paise:number;created_at:string;active_reservation_count:number;reservation_expires_at:string|null}
export interface CustomerReview {id:string;product_id:string;product_name:string|null;rating:number;title:string|null;status:string;created_at:string}
export interface CustomerWishlistItem {product_id:string;product_name:string|null;product_slug:string|null;created_at:string}
export interface CustomerDetail {
 profile:Pick<AdminCustomerSummary,'id'|'display_name'|'first_name'|'last_name'|'phone'|'email'|'account_role'|'created_at'|'updated_at'>
 metrics:{order_count:number;lifetime_order_value_paise:number;average_order_value_paise:number;latest_order_at:string|null;address_count:number;review_count:number;wishlist_count:number}
 addresses:CustomerAddress[];orders:CustomerOrder[];reviews:CustomerReview[];wishlist:CustomerWishlistItem[]
}
export const customerPageSize=25
export const emptyCustomerFilters:CustomerFilters={search:'',filter:'all',sort:'newest'}
export const validCustomerId=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
