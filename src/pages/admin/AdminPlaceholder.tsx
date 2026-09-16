import { ArrowLeft, Layers3 } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { AdminEmptyState, AdminPageHeader } from '../../components/admin/AdminComponents'

const modules: Record<string,[string,string]> = {
  products:['Products','Manage the designs and details behind every Percent piece.'],
  inventory:['Inventory','Track physical pieces and each design’s production limit.'],
  orders:['Orders','Review customer orders and their current status.'],
  customers:['Customers','Manage customer accounts and relationships.'],
  reviews:['Reviews','Review customer feedback and moderation queues.'],
  website:['Website Editor','Shape your storefront pages and global brand settings.'],
  blog:['Blog & Content','Create and manage stories from Percent.'],
  coupons:['Coupons','Manage offers and discount codes.'],
  analytics:['Analytics','Understand your store’s performance.'],
  users:['Admin Users','Manage administrative access and responsibilities.'],
  settings:['Settings','Manage your store’s operational settings.'],
  media:['Media Library','Organize your product, editorial and brand imagery.'],
}
const sectionNames:Record<string,string>={navbar:'Navbar',footer:'Footer',branding:'Branding',colors:'Colors',typography:'Typography','social-links':'Social Links'}
export function AdminPlaceholder() {
  const {pathname,search}=useLocation()
  const module=pathname.split('/')[2]
  const [title,description]=modules[module]??['Page not found','This admin destination is not available.']
  const section=module==='website'?sectionNames[new URLSearchParams(search).get('section')??'']:undefined
  return <><AdminPageHeader title={section??title} description={description}/><section className="admin-panel admin-placeholder"><AdminEmptyState icon={Layers3} title={modules[module]?'Coming in next Admin phase':'Page not found'} description={`${section??title} tools will appear here when this module is ready.`}/><Link className="admin-button" to="/admin"><ArrowLeft/> Back to dashboard</Link></section></>
}
