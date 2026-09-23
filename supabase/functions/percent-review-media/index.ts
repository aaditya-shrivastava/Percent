import { createClient } from 'npm:@supabase/supabase-js@2.99.1'
const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods':'POST, OPTIONS' }
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}})
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
 if(req.method!=='POST')return reply({error:'Method not allowed'},405)
 const url=Deno.env.get('SUPABASE_URL')!
 if(new URL(url).hostname!=='gijyjdeohvdrnvqfqdha.supabase.co')return reply({error:'Project mismatch'},503)
 const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
 let action: {action?:string;review_id?:string} | null=null
 if(req.headers.get('content-type')?.includes('application/json')) {
  try { action=await req.json() } catch {return reply({error:'Invalid request'},400)}
  if(action?.action==='read') {
   const publicClient=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!)
   const {data:published,error:publishedError}=await publicClient.from('product_reviews').select('id,product_id,status').eq('id',action.review_id??'').eq('status','approved').single()
   if(publishedError||!published)return reply({images:[]})
   const {data:product,error:productError}=await publicClient.from('products').select('id').eq('id',published.product_id).eq('is_visible',true).in('status',['active','archived']).single()
   if(productError||!product)return reply({images:[]})
   const {data:images,error}=await publicClient.from('review_images').select('object_path,alt').eq('review_id',action.review_id??'')
   if(error)return reply({error:'Unavailable'},404)
   const files=[]
   for(const image of images??[]) {
    const {data,error}=await admin.storage.from('percent-review-images').createSignedUrl(image.object_path,300)
    if(!error)files.push({src:data.signedUrl,alt:image.alt,width:800,height:800})
   }
   return reply({images:files})
  }
 }
 const token=req.headers.get('Authorization')?.replace(/^Bearer /i,'')
 if(!token)return reply({error:'Authentication required'},401)
 const {data:{user},error:authError}=await admin.auth.getUser(token)
 if(authError||!user)return reply({error:'Authentication required'},401)
 const caller=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:`Bearer ${token}`}}})
 if(action?.action==='admin_read') {
  const {data:role,error:roleError}=await caller.rpc('get_my_role')
  if(roleError||!['admin','super_admin'].includes(role??''))return reply({error:'Admin access required'},403)
  const reviewId=action.review_id??''
  const {data:review,error:reviewError}=await caller.from('product_reviews').select('id').eq('id',reviewId).single()
  if(reviewError||!review)return reply({error:'Review unavailable'},404)
  const {data:images,error:imageError}=await caller.from('review_images').select('id,slot,object_path,alt').eq('review_id',review.id).order('slot')
  if(imageError)return reply({error:'Images unavailable'},404)
  const files=[]
  for(const image of images??[]) {
   const {data,error}=await admin.storage.from('percent-review-images').createSignedUrl(image.object_path,300)
   if(!error)files.push({id:image.id,slot:image.slot,src:data.signedUrl,alt:image.alt})
  }
  return reply({images:files})
 }
 if(action?.action==='delete') {
  const {data:review}=await caller.from('product_reviews').select('id,user_id,status').eq('id',action.review_id??'').single()
  if(!review||review.user_id!==user.id||review.status==='approved')return reply({error:'Review unavailable'},403)
  // Close uploads before listing paths; in-flight uploads recheck this state.
  await admin.from('product_reviews').update({status:'rejected'}).eq('id',review.id)
  const {data:images,error}=await admin.from('review_images').select('object_path').eq('review_id',review.id)
  if(error)return reply({error:'Cleanup failed; retry'},409)
  if(images?.length){const {error}=await admin.storage.from('percent-review-images').remove(images.map(i=>i.object_path));if(error)return reply({error:'Cleanup failed; retry'},409)}
  const {error:deleteError}=await admin.from('product_reviews').delete().eq('id',review.id)
  return deleteError?reply({error:'Cleanup failed; retry'},409):reply({deleted:true})
 }
 const paths:string[]=[]
 const rows:string[]=[]
 try{
  if(Number(req.headers.get('content-length')??0)>16*1024*1024)return reply({error:'Upload too large'},413)
  const form=await req.formData()
  const reviewId=String(form.get('review_id')??'')
  const {data:review,error}=await caller.from('product_reviews').select('id,user_id,status').eq('id',reviewId).single()
  if(error||!review||review.user_id!==user.id||review.status!=='pending')return reply({error:'Pending review required'},403)
  const files=form.getAll('files').filter((f):f is File=>f instanceof File)
  if(!files.length||files.length>3)return reply({error:'Choose 1 to 3 images'},400)
  // Validate bytes before reserving metadata or storing objects; never trust MIME alone.
  const validated=[]
  for(const file of files){
   if(file.size>5*1024*1024)return reply({error:'Image exceeds 5 MB'},400)
   const bytes=new Uint8Array(await file.arrayBuffer())
   const png=bytes.length>24&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n)
   const jpeg=bytes.length>4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes.at(-2)===255&&bytes.at(-1)===217
   const webp=bytes.length>12&&new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP'
   const mime=png?'image/png':jpeg?'image/jpeg':webp?'image/webp':null
   if(!mime||file.type!==mime)return reply({error:'Invalid image content'},400)
   validated.push({bytes,mime})
  }
  const {data:existing,error:existingError}=await caller.from('review_images').select('slot').eq('review_id',reviewId)
  if(existingError)throw existingError
  const free=[1,2,3].filter(slot=>!existing?.some(i=>i.slot===slot))
  if(validated.length>free.length)return reply({error:'Maximum 3 images per review'},409)
  for(const [i,file] of validated.entries()){
   const path=`${user.id}/${review.id}/${crypto.randomUUID()}`
   const {data:row,error:rowError}=await admin.from('review_images').insert({review_id:review.id,slot:free[i],object_path:path,alt:'Customer review photo'}).select('id').single()
   if(rowError)throw rowError
   rows.push(row.id);paths.push(path)
   const {error:uploadError}=await admin.storage.from('percent-review-images').upload(path,file.bytes,{contentType:file.mime,upsert:false})
   if(uploadError)throw uploadError
  }
  const {data:stillPending}=await caller.from('product_reviews').select('status').eq('id',reviewId).single()
  if(stillPending?.status!=='pending')throw new Error('Review changed during upload')
  return reply({uploaded:paths.length})
 }catch{
  if(paths.length)await admin.storage.from('percent-review-images').remove(paths)
  if(rows.length)await admin.from('review_images').delete().in('id',rows)
  return reply({error:'Upload failed. Please retry.'},409)
 }
})
