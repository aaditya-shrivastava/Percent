import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')
const [routes, shell, guard, users, settings, productOptions, staff, styles] = await Promise.all([
  read('../src/pages/admin/AdminRoutes.tsx'),
  read('../src/components/admin/AdminShell.tsx'),
  read('../src/components/admin/AdminRouteGuard.tsx'),
  read('../src/pages/admin/AdminUsers.tsx'),
  read('../src/pages/admin/AdminSettings.tsx'),
  read('../src/pages/admin/ProductOptionsSettings.tsx'),
  read('../src/backend/admin/staff.ts'),
  read('../src/pages/admin/admin-users-settings.css'),
])

assert.match(routes, /path="users" element={<AdminUsers\/>}/)
assert.match(routes, /path="settings" element={<AdminSettings\/>}/)
assert.match(routes, /path="analytics" element={<AdminAnalytics\/>}/)
assert.doesNotMatch(routes, /\['analytics','users','settings'\]/)
assert.match(shell, /path:'\/admin\/users',label:'Admin Users'/)
assert.match(shell, /path:'\/admin\/settings',label:'Settings'/)

assert.match(staff, /rpc\('admin_list_staff'/)
assert.match(staff, /rpc\('admin_set_staff_role'/)
assert.match(staff, /getAdminAccess/)
assert.doesNotMatch(staff, /from\(['"]user_roles['"]\)/)
assert.doesNotMatch(staff + users + settings, /service[_-]?role/i)
assert.doesNotMatch(staff + users, /firebase.*uid|uid.*firebase/i)
assert.match(users, /\['all', 'All'\], \['admin', 'Admin'\], \['super_admin', 'Super Admin'\]/)
assert.match(users, /member\.is_current/)
assert.match(users, /result\.can_manage_roles && !member\.is_current/)
assert.match(users, /staff role changed after the page loaded/i)
assert.doesNotMatch(users, /Add Admin|Invite Admin/)

assert.match(settings, /Firebase Authentication/)
assert.match(settings, /Private Percent roles/)
assert.match(settings, /to="\/admin\/inventory"/)
assert.match(settings, /to="\/admin\/coupons"/)
assert.match(settings, /to="\/admin\/orders"/)
assert.match(settings, /to="\/admin\/website"/)
assert.match(settings, /<ProductOptionsSettings\/>/)
assert.match(settings, /Database-backed configuration only/)
assert.doesNotMatch(settings + productOptions, /Save Settings|localStorage|sessionStorage|service[_-]?role/i)

assert.match(guard, /authRouteWithReturnTo\('\/login', location\.pathname \+ location\.search \+ location\.hash\)/)
assert.match(guard, /access\.status !== 'allowed'/)
for (const width of [1000, 760, 425]) assert.match(styles, new RegExp(`max-width:${width}px`))
assert.match(styles, /\.staff-table\{display:none\}/)
assert.match(styles, /\.staff-cards\{display:grid/)
assert.match(styles, /:focus-visible/)
assert.match(users, /<th scope="col">/)
assert.match(users, /aria-labelledby="staff-role-title"/)
assert.match(users, /role="alert"/)

console.log('PASS Admin Users + Settings implementation: routes, staff-only RPC adapter, role permissions, PT409 state, real read-only settings, responsive modes, and accessibility semantics')
