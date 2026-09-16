import type { InventoryProduct, InventoryVariant } from './inventory-model'
export const adjustmentReasons=['Physical count correction','Damage','Quality rejection','Lost item','Administrative correction','Production count correction','Other'] as const
export type AdjustmentOperation='INCREASE'|'DECREASE'|'SET_EXACT'
export type AdjustmentForm={operation:AdjustmentOperation;quantity:string;reason:string;note:string}
export const blankAdjustment:AdjustmentForm={operation:'INCREASE',quantity:'',reason:'',note:''}
export function canAdjust(p:InventoryProduct,v:InventoryVariant){return ['draft','active'].includes(p.status)&&!p.archived_at&&!p.sold_out_at&&p.sold<p.production_limit&&!p.history&&(v.physical>0||(p.status==='draft'&&v.enabled&&p.remaining>0))}
export function adjustmentPreview(p:InventoryProduct,v:InventoryVariant,f:AdjustmentForm){
 const errors:Record<string,string>={},n=Number(f.quantity)
 if(!/^\d+$/.test(f.quantity)||!Number.isSafeInteger(n)||n>2147483647||(f.operation!=='SET_EXACT'&&n===0))errors.quantity='Enter a whole quantity'+(f.operation==='SET_EXACT'?' of zero or more.':' greater than zero.')
 if(!adjustmentReasons.some(r=>r===f.reason))errors.reason='Choose an adjustment reason.'
 if(f.note.trim().length>2000)errors.note='Use no more than 2000 characters.'
 const after=errors.quantity?v.physical:f.operation==='INCREASE'?v.physical+n:f.operation==='DECREASE'?v.physical-n:n,delta=after-v.physical
 if(!canAdjust(p,v))errors.form='This variant is locked for adjustments.'
 if(after<0)errors.quantity='Decrease exceeds eligible physical stock.'
 if(delta===0&&!errors.quantity)errors.quantity='The adjustment must change eligible physical stock.'
 if(delta>0){if(p.status!=='draft'||!v.enabled)errors.quantity='New pieces require an enabled variant on a draft.';else if(delta>p.remaining)errors.quantity=`This needs ${delta} new pieces, but only ${p.remaining} production capacity remains.`}
 return {errors,before:v.physical,after,delta,produced:p.allocated+Math.max(0,delta),remaining:p.remaining-Math.max(0,delta)}
}
