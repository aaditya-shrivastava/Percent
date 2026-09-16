import type { Row } from './editor-model'
export type InventoryVariant=Row<'product_variants'>&{colour:string;allocated:number;sold:number;physical:number;available:number;withdrawn:number}
export type InventoryProduct=Row<'products'>&{variants:InventoryVariant[];allocated:number;sold:number;physical:number;available:number;remaining:number;history:boolean;image?:string}
export const allocationState=(p:Pick<InventoryProduct,'allocated'|'production_limit'>)=>p.allocated===0?'Not Allocated':p.allocated>=p.production_limit?'Fully Allocated':'Partially Allocated'
export const allocationEligible=(p:InventoryProduct)=>p.status==='draft'&&!p.archived_at&&!p.sold_out_at&&!p.history&&p.sold===0&&!p.variants.some(v=>v.withdrawn)&&p.remaining>0&&p.variants.some(v=>v.enabled)
export function validateAllocation(p:InventoryProduct,values:Record<string,string>){
 const errors:Record<string,string>={};let total=0
 for(const v of p.variants){const raw=values[v.id]??'',n=Number(raw);if(!/^\d+$/.test(raw)||!Number.isSafeInteger(n))errors[v.id]='Enter a non-negative whole number.';else if(n<v.allocated)errors[v.id]=`Cannot reduce the ${v.allocated} existing pieces.`;else if(!v.enabled&&n!==v.allocated)errors[v.id]='Disabled variants cannot receive allocation.';total+=Number.isSafeInteger(n)?n:0}
 if(!allocationEligible(p))errors.form='This production run is read-only.'
 if(total>p.production_limit)errors.form=`${total-p.production_limit} units above production limit.`
 return {errors,total,remaining:p.production_limit-total}
}
export type InventoryFilters={search:string;allocation:string;lifecycle:string;availability:string;sort:string}
export const initialInventoryFilters:InventoryFilters={search:'',allocation:'all',lifecycle:'all',availability:'all',sort:'name'}
export function filterInventory(rows:InventoryProduct[],f:InventoryFilters){const search=f.search.trim().toLowerCase();return rows.filter(p=>(!search||[p.name,p.slug,p.design_code,...p.variants.map(v=>v.sku)].some(s=>s.toLowerCase().includes(search)))&&(f.allocation==='all'||allocationState(p)===f.allocation)&&(f.lifecycle==='all'||(f.lifecycle==='sold-out'?p.sold>=p.production_limit:p.status===f.lifecycle))&&(f.availability==='all'||(f.availability==='available'?p.available>0:f.availability==='none'?p.available===0:p.available>0&&p.available<=p.allocated*.1))).sort((a,b)=>(f.sort==='newest'?b.created_at.localeCompare(a.created_at):f.sort==='limit'?b.production_limit-a.production_limit:f.sort==='allocated'?b.allocated-a.allocated:f.sort==='least'?a.allocated-b.allocated:f.sort==='remaining'?a.remaining-b.remaining:f.sort==='sold'?b.sold-a.sold:a.name.localeCompare(b.name))||a.id.localeCompare(b.id))}
