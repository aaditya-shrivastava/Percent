export const builtinNames=['Inter','Manrope','DM Sans','Montserrat','Outfit','Space Grotesk','system-ui','Georgia','Playfair Display','Cormorant Garamond','Lora','Libre Baskerville'] as const
export type BuiltinFont=typeof builtinNames[number]
export type FontReference=BuiltinFont|`custom:${string}`
export type FontFaceRecord={asset_id:string;weight:number;style:'normal'|'italic'}
export type FontFamilyRecord={id:string;family_name:string;enabled?:boolean;created_at?:string;updated_at?:string;in_use?:boolean;faces:FontFaceRecord[]}
export const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const serif=new Set(['Georgia','Playfair Display','Cormorant Garamond','Lora','Libre Baskerville'])
const sansFallback='system-ui, -apple-system, "Segoe UI", sans-serif'
const serifFallback='Georgia, "Times New Roman", serif'
export function builtinEntry(name:string){
  if(!(builtinNames as readonly string[]).includes(name))return null
  if(name==='Georgia'||name==='system-ui')return {name,family:name,css:null,fallback:name==='Georgia'?serifFallback:sansFallback}
  const id=name.toLowerCase().replaceAll(' ','-')
  return {name,family:`PercentBuiltin_${id.replaceAll('-','_')}`,css:`${import.meta.env.BASE_URL}fonts/builtin/${id}/font.css`,fallback:serif.has(name)?serifFallback:sansFallback}
}
export function customFamily(reference:string,families:FontFamilyRecord[]){const id=reference.slice(7);return reference.startsWith('custom:')&&uuidPattern.test(id)?families.find(f=>f.id===id&&f.enabled!==false):undefined}
export function fontStack(reference:string,families:FontFamilyRecord[]=[]){
  const built=builtinEntry(reference)
  if(built)return `"${built.family}", ${built.fallback}`
  const custom=customFamily(reference,families)
  return custom?`"PercentCustom_${custom.id.replaceAll('-','_')}", ${sansFallback}`:sansFallback
}
export function safeFontFamilies(value:unknown):FontFamilyRecord[]{
  if(!Array.isArray(value))return []
  return value.filter(f=>f&&typeof f.id==='string'&&uuidPattern.test(f.id)&&Array.isArray(f.faces)).map(f=>({id:f.id,family_name:String(f.family_name??''),enabled:f.enabled,created_at:f.created_at,updated_at:f.updated_at,in_use:f.in_use,faces:f.faces.filter((x:FontFaceRecord)=>uuidPattern.test(x.asset_id)&&Number.isInteger(x.weight)&&x.weight>=100&&x.weight<=900&&x.weight%100===0&&['normal','italic'].includes(x.style)).map((x:FontFaceRecord)=>({asset_id:x.asset_id,weight:x.weight,style:x.style}))}))
}
