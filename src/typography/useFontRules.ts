/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react'
import { acquireFontRules } from './fontRuntime'
import { customFamily, type FontFamilyRecord } from './fontRegistry'
import { previewFontFace } from '../backend/websiteFonts'

export function useFontRules(references:string[],families:FontFamilyRecord[],adminPreview=false,weights:number[]=[400,700]){
  const signature=JSON.stringify({references,families,weights})
  const [error,setError]=useState('')
  useEffect(()=>{
    const {references,families,weights}=JSON.parse(signature) as {references:string[];families:FontFamilyRecord[];weights:number[]}
    let cancelled=false,release:(()=>void)|undefined
    const urls:Record<string,string>={}
    setError('')
    const load=async()=>{
      if(adminPreview){
        const selected=new Map<string,FontFamilyRecord['faces'][number]>()
        for(const reference of references){const family=customFamily(reference,families);if(!family)continue;const normal=family.faces.filter(x=>x.style==='normal'),faces=normal.length?normal:family.faces
          for(const weight of weights){const face=[...faces].sort((a,b)=>Math.abs(a.weight-weight)-Math.abs(b.weight-weight))[0];if(face)selected.set(face.asset_id,face)}
        }
        const outcomes=await Promise.allSettled([...selected].map(async([id,face])=>{urls[id]=await previewFontFace(face)}))
        if(outcomes.some(outcome=>outcome.status==='rejected')){if(!cancelled)setError('Font preview could not load. A safe fallback is shown.');for(const url of Object.values(urls))URL.revokeObjectURL(url);return}
      }
      if(cancelled){for(const url of Object.values(urls))URL.revokeObjectURL(url);return}
      // Only faces available to this preview are registered; live storefront
      // registers referenced families and lets the browser select used weights.
      const available=adminPreview?families.map(f=>({...f,faces:f.faces.filter(x=>urls[x.asset_id])})):families
      release=acquireFontRules(references,available,urls)
    }
    void load()
    return()=>{cancelled=true;release?.();for(const url of Object.values(urls))URL.revokeObjectURL(url)}
  },[signature,adminPreview])
  return error
}
