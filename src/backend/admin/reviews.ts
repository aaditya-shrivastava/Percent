import { supabase } from '../client'
import { getAdminAccess } from './role'
import { reviewPageSize,type AdminReview,type AdminReviewImage,type ReviewFilters,type ReviewListResult,type ReviewMetrics,type ReviewStatus } from './review-model'

const fail=()=>new Error('Reviews unavailable')
async function assertAdmin(userId:string){if((await getAdminAccess(userId)).status!=='allowed')throw fail()}
const escapeSearch=(value:string)=>value.replace(/[,%()]/g,' ').trim().slice(0,120)

async function metrics(signal:AbortSignal):Promise<ReviewMetrics>{
 const count=(status?:ReviewStatus)=>{let query=supabase.from('product_reviews').select('id',{count:'exact',head:true}).abortSignal(signal);if(status)query=query.eq('status',status);return query}
 const [total,pending,approved,rejected,ratings]=await Promise.all([
  count(),count('pending'),count('approved'),count('rejected'),
  supabase.from('product_reviews').select('rating').eq('status','approved').order('id').range(0,999).abortSignal(signal),
 ])
 if(total.error||pending.error||approved.error||rejected.error||ratings.error)throw fail()
 const approvedCount=approved.count??0,ratingRows=ratings.data??[]
 const average=approvedCount<=1000&&ratingRows.length===approvedCount&&approvedCount>0?ratingRows.reduce((sum,row)=>sum+row.rating,0)/approvedCount:null
 return {total:total.count??0,pending:pending.count??0,approved:approvedCount,rejected:rejected.count??0,approved_average_rating:average}
}

export async function listAdminReviews(userId:string,filters:ReviewFilters,page:number,signal:AbortSignal):Promise<ReviewListResult>{
 await assertAdmin(userId)
 const search=escapeSearch(filters.search)
 let productIds:string[]=[]
 if(search){const products=await supabase.from('products').select('id').ilike('name',`%${search}%`).limit(100).abortSignal(signal);if(products.error)throw fail();productIds=(products.data??[]).map(p=>p.id)}
 let query=supabase.from('product_reviews').select('id,user_id,product_id,rating,title,body,customer_name,status,created_at,updated_at',{count:'exact'})
 if(filters.status!=='all')query=query.eq('status',filters.status)
 if(filters.rating!=='all')query=query.eq('rating',filters.rating)
 if(search){const productClause=productIds.length?`,product_id.in.(${productIds.join(',')})`:'';query=query.or(`customer_name.ilike.%${search}%,title.ilike.%${search}%,body.ilike.%${search}%${productClause}`)}
 const ascending=filters.sort==='oldest'||filters.sort==='lowest_rating'
 if(filters.sort==='highest_rating'||filters.sort==='lowest_rating')query=query.order('rating',{ascending}).order('created_at',{ascending:false})
 else query=query.order('created_at',{ascending})
 const from=(Math.max(1,page)-1)*reviewPageSize
 const [rows,summary]=await Promise.all([query.order('id').range(from,from+reviewPageSize-1).abortSignal(signal),metrics(signal)])
 if(rows.error)throw fail()
 const reviewRows=rows.data??[],reviewIds=reviewRows.map(r=>r.id),allProductIds=[...new Set(reviewRows.map(r=>r.product_id))]
 const [products,images]=await Promise.all([
  allProductIds.length?supabase.from('products').select('id,name,slug').in('id',allProductIds).abortSignal(signal):Promise.resolve({data:[],error:null}),
  reviewIds.length?supabase.from('review_images').select('id,review_id,slot,alt').in('review_id',reviewIds).order('slot').abortSignal(signal):Promise.resolve({data:[],error:null}),
 ])
 if(products.error||images.error)throw fail()
 const productMap=new Map((products.data??[]).map(p=>[p.id,p]))
 const items=reviewRows.map(row=>{const product=productMap.get(row.product_id);return {...row,status:row.status as ReviewStatus,product_name:product?.name??'Product unavailable',product_slug:product?.slug??'',images:(images.data??[]).filter(image=>image.review_id===row.id).map(({id,slot,alt})=>({id,slot,alt}))} as AdminReview})
 return {items,count:rows.count??0,metrics:summary}
}

export async function loadAdminReviewImages(reviewId:string):Promise<AdminReviewImage[]>{
 const {data,error}=await supabase.functions.invoke('percent-review-media',{body:{action:'admin_read',review_id:reviewId}})
 if(error||!Array.isArray(data?.images))throw new Error('Review images unavailable')
 return data.images as AdminReviewImage[]
}

export async function setReviewVisibility(review:AdminReview,visible:boolean){
 const {data,error}=await supabase.rpc('set_product_review_visibility',{review_id:review.id,visible,expected_updated_at:review.updated_at})
 if(error){const failure=new Error(error.code==='PT409'?'This review changed. The latest version has been loaded.':error.message) as Error&{code?:string};failure.code=error.code;throw failure}
 return data
}
