import { supabase, checkError } from './client'
import type { ProductReview } from '../types'

export async function submitReview(slug: string, rating: number, title: string, body: string, files: File[]): Promise<ProductReview> {
 const {data:{user},error:authError}=await supabase.auth.getUser();checkError(authError)
 if(!user)throw new Error('Please sign in.')
 const {data:product,error:productError}=await supabase.from('products').select('id').eq('slug',slug).single();checkError(productError)
 const {data:profile,error:profileError}=await supabase.from('profiles').select('display_name').eq('id',user.id).single();checkError(profileError)
 const {data:review,error}=await supabase.from('product_reviews').insert({user_id:user.id,product_id:product!.id,rating,title:title.trim()||null,body:body.trim(),customer_name:profile!.display_name}).select('*').single();checkError(error)
 if(files.length){
  const form=new FormData();form.set('review_id',review!.id);files.forEach(file=>form.append('files',file))
  const {error:uploadError}=await supabase.functions.invoke('percent-review-media',{body:form})
  if(uploadError){await supabase.functions.invoke('percent-review-media',{body:{action:'delete',review_id:review!.id}});throw new Error('Photos could not be uploaded. Please retry your review.')}
 }
 return {id:review!.id,rating:review!.rating,title:review!.title,customerName:review!.customer_name,text:review!.body,date:review!.created_at,status:'pending'}
}
