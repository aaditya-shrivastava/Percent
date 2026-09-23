export type ReviewStatus='pending'|'approved'|'rejected'
export type ReviewSort='newest'|'oldest'|'highest_rating'|'lowest_rating'
export interface ReviewFilters {search:string;status:'all'|ReviewStatus;rating:'all'|1|2|3|4|5;sort:ReviewSort}
export interface AdminReviewImage {id:string;slot:number;alt:string;src?:string}
export interface AdminReview {
 id:string;user_id:string;product_id:string;customer_name:string;product_name:string;product_slug:string
 rating:number;title:string|null;body:string;status:ReviewStatus;created_at:string;updated_at:string;images:AdminReviewImage[]
}
export interface ReviewMetrics {total:number;pending:number;approved:number;rejected:number;approved_average_rating:number|null}
export interface ReviewListResult {items:AdminReview[];count:number;metrics:ReviewMetrics}
export const reviewPageSize=25
export const emptyReviewFilters:ReviewFilters={search:'',status:'all',rating:'all',sort:'newest'}
export const reviewVisibility=(status:ReviewStatus)=>status==='approved'?'shown':status==='rejected'?'hidden':'new'
