import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [route, page, service, css, migration] = await Promise.all([
  readFile(new URL('../src/pages/admin/AdminRoutes.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/admin/AdminAnalytics.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/backend/admin/analytics.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/admin/analytics.css', import.meta.url), 'utf8'),
  readFile(new URL('./migrations/20260930192557_admin_analytics_foundation.sql', import.meta.url), 'utf8'),
])

assert.match(route, /path="analytics" element={<AdminAnalytics\/>}/)
assert.doesNotMatch(route, /path="analytics" element={<AdminPlaceholder\/>}/)
assert.equal((service.match(/\.rpc\('admin_get_analytics'/g)??[]).length,1)
assert.deepEqual(['7','30','90','all'].map(value=>service.includes(`'${value}'`)),[true,true,true,true])
for(const label of ['Confirmed Sales','Confirmed Orders','Units Sold','Customers','Performance Trend','Order Status','Top Products','Limited Production','Inventory Overview','Coupon Performance','Production Exhausted','Sold Out','Remaining capacity'])assert.ok(page.includes(label),label)
for(const state of ['Loading analytics','Unable to load analytics','No confirmed product sales','No confirmed coupon redemptions'])assert.ok(page.toLowerCase().includes(state.toLowerCase()),state)
assert.match(page,/aria-label="Analytics date range"/)
assert.match(page,/role="img"/)
assert.match(page,/Analytics trend values/)
assert.match(page,/scope="row"/)
assert.match(page,/aria-label={`\$\{product\.name}: \$\{product\.used} of \$\{product\.production_limit} production used`}/)
assert.match(css,/@media\(max-width:1100px\)/)
assert.match(css,/@media\(max-width:760px\)/)
assert.match(css,/@media\(max-width:425px\)/)
assert.match(css,/@media\(max-width:360px\)/)
assert.doesNotMatch(page+service,/Math\.random|mock analytics|sample data|fake revenue/i)
assert.match(migration,/payment_status = 'paid' and o\.status = 'completed'/)
assert.match(migration,/'production_exhausted', i\.sold \+ i\.withdrawn >= i\.production_limit/)
assert.match(migration,/'sold_out', i\.sold_out_at is not null/)
assert.match(migration,/private\.current_user_id\(\)/)
assert.match(migration,/private\.is_admin\(\)/)

console.log('PASS Admin Analytics route, single-RPC architecture, ranges, metrics, states, terminology, accessibility, responsive source, and authorization semantics')
