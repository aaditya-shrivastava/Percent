export const formatINR = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(paise / 100)
export interface AdminProduct {
  id: string; name: string; slug: string; design_code: string; status: string; category_id: string | null; category: string
  fit_type: string; price_paise: number; production_limit: number; is_visible: boolean; is_shop_available: boolean
  created_at: string; updated_at: string; sold_out_at: string | null
  image?: { url: string; alt: string }; primaryImageUrl?:string; variants: number; enabledVariants:number; invalidEnabledVariants:number; skus: string[]; tags: string[]
  categoryActive:boolean; sold: number; allocated: number; eligible:number; available: number; remaining: number; displayStatus: string
}
export type ProductFilters = { search: string; status: string; category: string; fit: string; availability: string; sort: string }
export const emptyProductFilters: ProductFilters = { search: '', status: 'all', category: 'all', fit: 'all', availability: 'all', sort: 'newest' }
export function runMetrics(limit: number, sold: number) {
  return { remaining: Math.max(0, limit - sold), progress: Math.min(100, Math.max(0, sold / limit * 100)) }
}
export function canArchive(product: AdminProduct) { return product.status !== 'archived' && product.allocated === product.production_limit }
export function filterProducts(products: AdminProduct[], f: ProductFilters) {
  const search=f.search.trim().toLocaleLowerCase()
  return products.filter(p => (!search || [p.name,p.slug,p.design_code,...p.skus,...p.tags].some(s=>s.toLocaleLowerCase().includes(search)))
    && (f.status==='all'||p.displayStatus===f.status) && (f.category==='all'||p.category_id===f.category)
    && (f.fit==='all'||p.fit_type===f.fit) && (f.availability==='all'||(f.availability==='available'?p.available>0:f.availability==='empty'?p.available===0:p.sold>=Math.ceil(p.production_limit*.9)&&p.remaining>0)))
    .sort((a,b)=>{
      const order=f.sort==='oldest'?a.created_at.localeCompare(b.created_at):f.sort==='az'?a.name.localeCompare(b.name):f.sort==='za'?b.name.localeCompare(a.name):f.sort==='price-low'?a.price_paise-b.price_paise:f.sort==='price-high'?b.price_paise-a.price_paise:f.sort==='sold'?b.sold-a.sold:f.sort==='remaining'?a.remaining-b.remaining:b.created_at.localeCompare(a.created_at)
      return order||a.id.localeCompare(b.id)
    })
}
