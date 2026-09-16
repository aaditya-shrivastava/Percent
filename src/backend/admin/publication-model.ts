export interface PublicationSnapshot {
  name:string; slug:string; designCode:string; pricePaise:number; productionLimit:number; fitType:string
  categoryActive:boolean; enabledVariants:number; invalidEnabledVariants:number; primaryImageUrl?:string; primaryImageVerified?:boolean
  produced:number; eligible:number; sold:number; status:string; archived:boolean; soldOut:boolean
}

export interface PublicationCheck {key:string;label:string;ready:boolean;detail:string}

export function publicationReadiness(p:PublicationSnapshot) {
  const primaryExists=!!p.primaryImageUrl
  const publicPrimary=!!p.primaryImageVerified
  const checks:PublicationCheck[]=[
    {key:'details',label:'Product information',ready:!!p.name.trim()&&!!p.slug.trim()&&!!p.designCode.trim()&&p.pricePaise>0&&p.productionLimit>0&&['standard','oversized'].includes(p.fitType),detail:'Name, slug, design code, fit and positive price are required.'},
    {key:'category',label:'Active category',ready:p.categoryActive,detail:'Choose an active catalog category.'},
    {key:'variants',label:'Sellable variants',ready:p.enabledVariants>0&&p.invalidEnabledVariants===0,detail:'Every enabled variant needs a size, SKU and positive price.'},
    {key:'image',label:'Public primary image',ready:publicPrimary,detail:!primaryExists?'Missing primary image. Upload one and set it as primary.':publicPrimary?'Primary image is linked and available for public delivery after publication.':'Primary image is saved but is not publicly deliverable. Verify the uploaded object and delivery configuration.'},
    {key:'allocation',label:'Full production allocation',ready:p.produced===p.productionLimit,detail:`${p.produced} of ${p.productionLimit} pieces allocated.`},
    {key:'stock',label:'Sellable physical stock',ready:p.eligible>0&&p.sold===0,detail:p.sold>0?'Draft sales history requires lifecycle review.':`${p.eligible} eligible pieces available.`},
  ]
  const lifecycle=p.status==='draft'&&!p.archived&&!p.soldOut
  return {checks,ready:lifecycle&&checks.every(c=>c.ready),lifecycle}
}
