import { Navigate, Route, Routes } from 'react-router-dom'
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
import { AdminBlog } from './AdminBlog'
import { AdminBlogEditor } from './AdminBlogEditor'
import { AdminCoupons } from './AdminCoupons'
import { AdminCouponEditor } from './AdminCouponEditor'
import { AdminGlobalWebsiteEditor } from './AdminGlobalWebsiteEditor'
import { AdminUsers } from './AdminUsers'
import { AdminSettings } from './AdminSettings'
import { AdminAnalytics } from './AdminAnalytics'

export default function AdminRoutes() {
  return <Routes><Route path="/admin" element={<AdminRouteGuard/>}><Route element={<AdminShell/>}><Route index element={<AdminDashboard/>}/><Route path="products" element={<AdminProducts/>}/><Route path="products/new" element={<AdminProductEditor/>}/><Route path="products/:id/edit" element={<AdminProductEditor/>}/><Route path="inventory" element={<AdminInventory/>}/><Route path="inventory/:id" element={<AdminInventory/>}/><Route path="orders" element={<AdminOrders/>}/><Route path="orders/:id" element={<AdminOrderDetail/>}/><Route path="customers" element={<AdminCustomers/>}/><Route path="customers/:id" element={<AdminCustomerDetail/>}/><Route path="reviews" element={<AdminReviews/>}/><Route path="website" element={<AdminWebsiteEditor/>}/><Route path="website/footer" element={<Navigate to="/admin/website?section=footer" replace/>}/><Route path="website/:section" element={<AdminGlobalWebsiteEditor/>}/><Route path="blog" element={<AdminBlog/>}/><Route path="blog/new" element={<AdminBlogEditor/>}/><Route path="blog/:id/edit" element={<AdminBlogEditor/>}/><Route path="coupons" element={<AdminCoupons/>}/><Route path="coupons/new" element={<AdminCouponEditor/>}/><Route path="coupons/:id/edit" element={<AdminCouponEditor/>}/><Route path="users" element={<AdminUsers/>}/><Route path="settings" element={<AdminSettings/>}/><Route path="analytics" element={<AdminAnalytics/>}/><Route path="*" element={<AdminPlaceholder/>}/></Route></Route></Routes>
}

