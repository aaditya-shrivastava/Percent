import { builtinEntry, customFamily, type FontFamilyRecord } from './fontRegistry'
import { websiteFunctionUrl } from '../backend/website'

const installed=new Map<string,{element:HTMLElement;references:number}>()
export function acquireFontRules(references:string[],families:FontFamilyRecord[],previewSources:Record<string,string>={}){
  const keys:string[]=[]
  for(const reference of new Set(references)){
    const builtin=builtinEntry(reference),family=customFamily(reference,families)
    if(!builtin?.css&&!family)continue
    const signature=family?JSON.stringify(family.faces.map(x=>[x.asset_id,x.weight,x.style,previewSources[x.asset_id]??''])):reference
    const key=`${reference}:${signature}`
    const existing=installed.get(key)
    if(existing){existing.references++;keys.push(key);continue}
    let element:HTMLStyleElement|HTMLLinkElement
    if(builtin?.css){const link=document.createElement('link');link.rel='stylesheet';link.href=builtin.css;element=link}
    else{
      element=document.createElement('style')
      // Family names never enter CSS. UUID, weight and style were normalized.
      element.textContent=family!.faces.map(face=>{
        const source=previewSources[face.asset_id]
        const url=source?.startsWith('blob:')?source:`${websiteFunctionUrl}?font=${face.asset_id}`
        return `@font-face{font-family:"PercentCustom_${family!.id.replaceAll('-','_')}";src:url("${url}") format("woff2");font-weight:${face.weight};font-style:${face.style};font-display:swap;}`
      }).join('\n')
    }
    element.dataset.percentFont=reference
    document.head.append(element);installed.set(key,{element,references:1});keys.push(key)
  }
  return()=>{for(const key of keys){const entry=installed.get(key);if(entry&&--entry.references===0){entry.element.remove();installed.delete(key)}}}
}
