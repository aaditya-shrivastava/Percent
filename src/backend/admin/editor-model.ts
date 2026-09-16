import type { Database, Json } from '../database.types'
export type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type EditorImage=Pick<Row<'product_images'>,'id'|'url'|'alt'|'width'|'height'|'role'|'sort_order'>
export type EditorLink=Pick<Row<'variant_images'>,'variant_id'|'image_id'|'sort_order'>
export interface EditorVariant {id:string;colour_id:string;size:string;sku:string;price:string;compare:string;enabled:boolean;persisted:boolean;locked:boolean}
export interface EditorForm {name:string;slug:string;design_code:string;short_description:string;full_description:string;price:string;compare:string;category_id:string;fit_type:string;production_limit:string;material:string;style:string;care_instructions:string;shipping_and_returns:string;tags:string[];variants:EditorVariant[];images:EditorImage[];variant_images:EditorLink[]}
export const blankEditor=():EditorForm=>({name:'',slug:'',design_code:'',short_description:'',full_description:'',price:'',compare:'',category_id:'',fit_type:'standard',production_limit:'100',material:'',style:'',care_instructions:'',shipping_and_returns:'',tags:[],variants:[],images:[],variant_images:[]})
export function inrToPaise(value:string):number|null {
 const clean=value.trim().replace(/^₹\s*/,'')
 if(!/^(?:\d+|\d{1,3}(?:,\d{2})*,\d{3})(?:\.\d{1,2})?$/.test(clean))return null
 const [whole,fraction='']=clean.replaceAll(',','').split('.')
 const result=Number(whole)*100+Number(fraction.padEnd(2,'0'))
 return Number.isSafeInteger(result)&&result<=2147483647?result:null
}
export const slugify=(name:string)=>name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
export function validateEditor(f:EditorForm){
 const errors:Record<string,string>={}
 if(!f.name.trim())errors.name='Product name is required.'
 if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.slug))errors.slug='Use lowercase letters, numbers and single hyphens.'
 if(!f.design_code.trim())errors.design_code='Design code is required.'
 const price=inrToPaise(f.price)
 if(price===null)errors.price='Enter a valid non-negative INR price, with up to two decimals.'
 if(f.compare&&(inrToPaise(f.compare)===null||inrToPaise(f.compare)!<(price??0)))errors.compare='Comparison price must be at least the price.'
 if(!/^[1-9]\d*$/.test(f.production_limit)||Number(f.production_limit)>2147483647)errors.production_limit='Production limit must be a positive whole number.'
 const combos=new Set<string>(),skus=new Set<string>()
 f.variants.forEach((v,i)=>{
  const combo=v.colour_id+':'+v.size.trim(),sku=v.sku.trim()
  if(!v.colour_id||!v.size.trim()||v.size.trim().length>20||!sku)errors['variant-'+i]='Color, size and SKU are required; size must be at most 20 characters.'
  else if(combos.has(combo))errors['variant-'+i]='Duplicate color / size combination.'
  else if(skus.has(sku))errors['variant-'+i]='Duplicate SKU.'
  else if(inrToPaise(v.price)===null||(v.compare&&(inrToPaise(v.compare)===null||inrToPaise(v.compare)!<inrToPaise(v.price)!)))errors['variant-'+i]='Enter valid variant prices; comparison price cannot be lower.'
  combos.add(combo);skus.add(sku)
 })
 return errors
}
export function editorPayload(f:EditorForm):Json {
 return {product:{name:f.name.trim(),slug:f.slug,design_code:f.design_code.trim(),short_description:f.short_description,full_description:f.full_description,price_paise:inrToPaise(f.price),compare_at_price_paise:f.compare?inrToPaise(f.compare):null,category_id:f.category_id||null,fit_type:f.fit_type,production_limit:Number(f.production_limit),material:f.material||null,style:f.style||null,care_instructions:f.care_instructions||null,shipping_and_returns:f.shipping_and_returns||null},tags:f.tags,variants:f.variants.map(v=>({id:v.id,colour_id:v.colour_id,size:v.size.trim(),sku:v.sku.trim(),price_paise:inrToPaise(v.price),compare_at_price_paise:v.compare?inrToPaise(v.compare):null,enabled:v.enabled})),images:f.images,variant_images:f.variant_images}
}
