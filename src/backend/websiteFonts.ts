import { supabase } from './client'
import { safeFontFamilies, type FontFaceRecord, type FontFamilyRecord } from '../typography/fontRegistry'

export type FontDraftFace={key:string;weight:number;style:'normal'|'italic';asset_id?:string;file?:File;selection?:string}
export class WebsiteFontError extends Error{constructor(message:string,public code='FONT_ERROR'){super(message)}}
async function fontRequest(body:Record<string,unknown>|FormData){
  const {data,error}=await supabase.functions.invoke('percent-website-media',{body})
  if(error){
    if(error.context instanceof Response){const value=await error.context.clone().json().catch(()=>null);if(value?.error)throw new WebsiteFontError(String(value.error),String(value.code??''))}
    throw new WebsiteFontError('Font request failed. Check your connection and try again.')
  }
  return data
}
export async function loadFontLibrary(){const data=await fontRequest({action:'font_catalog'});return safeFontFamilies(data?.font_families)}
export async function previewFontFace(face:FontFaceRecord){const data=await fontRequest({action:'font_preview',asset_id:face.asset_id});if(!(data instanceof Blob))throw new WebsiteFontError('Font preview unavailable.');return URL.createObjectURL(data)}
export async function saveFontFamily(family:{id:string;family_name:string;enabled:boolean;updated_at?:string},faces:FontDraftFace[],license:boolean){
  const form=new FormData()
  form.set('action','font_save');form.set('family_id',family.id);form.set('family_name',family.family_name);form.set('enabled',String(family.enabled));form.set('license_confirmed',String(license));form.set('expected_updated_at',family.updated_at??'')
  form.set('faces',JSON.stringify(faces.map(face=>({weight:face.weight,style:face.style,...(face.file?{}:{asset_id:face.asset_id})}))))
  faces.forEach((face,index)=>{if(face.file)form.set(`file_${index}`,new File([face.file],face.file.name,{type:'font/woff2'}))})
  const data=await fontRequest(form)
  return {families:safeFontFamilies(data?.font_families),warning:data?.warning as string|undefined}
}
export async function toggleFontFamily(family:FontFamilyRecord){const data=await fontRequest({action:'font_toggle',family_id:family.id,enabled:!family.enabled,expected_updated_at:family.updated_at});return safeFontFamilies(data?.font_families)}
export async function deleteFontFamily(family:FontFamilyRecord){const data=await fontRequest({action:'font_delete',family_id:family.id,expected_updated_at:family.updated_at});return {families:data?.font_families?safeFontFamilies(data.font_families):await loadFontLibrary(),warning:data?.warning as string|undefined}}
export async function cleanupFontFamily(id:string){await fontRequest({action:'font_cleanup',family_id:id})}
