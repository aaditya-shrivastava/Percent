import { Link, useParams } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import { AdminEmptyState, AdminPageHeader } from '../../components/admin/AdminComponents'
export function AdminProductEditorPlaceholder(){
  const {id}=useParams()
  return <><AdminPageHeader title={id?'Edit Product':'Add Product'} description="Product details and production setup."/><section className="admin-panel admin-placeholder"><AdminEmptyState icon={Pencil} title="Product Editor will be completed in Phase 2B" description="Product fields and images will be managed here in the next phase."/><Link className="admin-button" to="/admin/products">Back to Products</Link></section></>
}
