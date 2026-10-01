import { supabase } from './client'
import { getPercentSessionSnapshot } from './percentSession'
import type { ProductReview } from '../types'

export async function submitReview(slug: string, rating: number, title: string, body: string, files: File[]): Promise<ProductReview> {
 const userId=getPercentSessionSnapshot().percentUserId
 if(!userId)throw new Error('Please sign in.')
 const {data:product,error:productError}=await supabase.from('products').select('id').eq('slug',slug).single();if(productError||!product)throw new Error('This product is unavailable for review.')
 const {data:profile,error:profileError}=await supabase.from('profiles').select('display_name').eq('id',userId).single();if(profileError||!profile)throw new Error('Unable to verify your customer profile.')
 const {data:review,error}=await supabase.from('product_reviews').insert({user_id:userId,product_id:product.id,rating,title:title.trim()||null,body:body.trim(),customer_name:profile.display_name}).select('*').single();if(error||!review)throw new Error(error?.code==='23505'?'You have already reviewed this product.':'Unable to submit your review. Please try again.')
 if(files.length){
  const form=new FormData();form.set('review_id',review!.id);files.forEach(file=>form.append('files',file))
  const {error:uploadError}=await supabase.functions.invoke('percent-review-media',{body:form})
  if(uploadError){await supabase.functions.invoke('percent-review-media',{body:{action:'delete',review_id:review!.id}});throw new Error('Photos could not be uploaded. Please retry your review.')}
 }
 return {id:review!.id,rating:review!.rating,title:review!.title,customerName:review!.customer_name,text:review!.body,date:review!.created_at,status:'pending'}
}
