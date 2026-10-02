import fs from 'node:fs'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

// Public key only. All RPC payloads are invalid and must fail before any write.
const client = createClient('https://gijyjdeohvdrnvqfqdha.supabase.co', 'sb_publishable_QxLwW-LIAjzV-s8YbKMP2Q_-FqY_DXc', { auth: { persistSession: false, autoRefreshToken: false } })
const results = []
for (const table of ['profiles', 'addresses', 'wishlist_items', 'orders', 'order_items', 'order_addresses', 'checkout_reservations']) {
  const { error } = await client.from(table).select('*').limit(1)
  assert.equal(error?.code, '42501', table + ': anonymous read must be denied')
  results.push({ operation: 'read ' + table, code: error.code })
}
for (const [name, args] of [
  ['provision_my_percent_identity', {}],
  ['save_address', { address: {} }],
  ['create_checkout_order', { cart_lines: [], shipping_address_id: null, idempotency_key: null }],
  ['validate_coupon', { code: '', cart_lines: [] }],
]) {
  const { error } = await client.rpc(name, args)
  assert.equal(error?.code, '42501', name + ': anonymous execution must be denied; received ' + JSON.stringify(error))
  results.push({ operation: 'RPC ' + name, code: error.code })
}
fs.writeFileSync('docs/backend/customer-security-hosted-anon-results.json', JSON.stringify({ results, mutations: 0 }, null, 2))
console.log('PASS hosted anonymous denial: ' + results.length + ' checks; no data mutations')
