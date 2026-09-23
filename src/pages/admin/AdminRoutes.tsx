import { Route, Routes } from 'react-router-dom'
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard'
import { AdminShell } from '../../components/admin/AdminShell'
import { AdminDashboard } from './AdminDashboard'
import { AdminPlaceholder } from './AdminPlaceholder'
import { AdminProducts } from './AdminProducts'
import { AdminInventory } from './AdminInventory'
import { AdminOrders } from './AdminOrders'
import { AdminOrderDetail } from './AdminOrderDetail'
import { AdminProductEditor } from './AdminProductEditor'
import { AdminCustomers } from './AdminCustomers'
import { AdminCustomerDetail } from './AdminCustomerDetail'
import { AdminReviews } from './AdminReviews'
import { AdminWebsiteEditor } from './AdminWebsiteEditor'

export default function AdminRoutes() {
  return <Routes><Route path="/admin" element={<AdminRouteGuard/>}><Route element={<AdminShell/>}><Route index element={<AdminDashboard/>}/><Route path="products" element={<AdminProducts/>}/><Route path="products/new" element={<AdminProductEditor/>}/><Route path="products/:id/edit" element={<AdminProductEditor/>}/><Route path="inventory" element={<AdminInventory/>}/><Route path="inventory/:id" element={<AdminInventory/>}/><Route path="orders" element={<AdminOrders/>}/><Route path="orders/:id" element={<AdminOrderDetail/>}/><Route path="customers" element={<AdminCustomers/>}/><Route path="customers/:id" element={<AdminCustomerDetail/>}/><Route path="reviews" element={<AdminReviews/>}/><Route path="website" element={<AdminWebsiteEditor/>}/>{['blog','coupons','analytics','users','settings','media'].map(path=><Route path={path} key={path} element={<AdminPlaceholder/>}/>)}<Route path="*" element={<AdminPlaceholder/>}/></Route></Route></Routes>
}

