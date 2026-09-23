import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),server:{middlewareMode:true},appType:'custom'})
try{
 const {
  money,
  normalizeAdminOrder,
  normalizeAdminOrders,
  orderCustomer,
  orderItemCount,
  orderLifecycleActions,
  shippingAddress,
 }=await server.ssrLoadModule('/src/backend/admin/order-model.ts')

 const order={
  id:'20000000-0000-4000-a000-000000000001',
  order_reference:'PCT-SNAPSHOT-1',
  status:'pending',payment_status:'unpaid',fulfillment_status:'unfulfilled',
  payment_provider:null,payment_reference:null,shipping_provider:null,tracking_number:null,delivered_at:null,
 }
 const item={id:'30000000-0000-4000-a000-000000000001',quantity:2}
 const billing={id:'40000000-0000-4000-a000-000000000001',kind:'billing',full_name:'Billing Name',email:'billing@example.com',phone:'111'}
 const snapshot={id:'40000000-0000-4000-a000-000000000002',kind:'shipping',full_name:'Order Snapshot',email:'snapshot@example.com',phone:'222',address_line1:'1 Purchase Street'}
 const currentSavedAddress={id:'50000000-0000-4000-a000-000000000001',full_name:'Changed Saved Address',address_line1:'99 New Street'}

 const aliased=normalizeAdminOrder({...order,items:[item],addresses:[billing,snapshot],current_saved_address:currentSavedAddress})
 assert.ok(aliased)
 assert.equal(orderItemCount(aliased),2)
 assert.equal(shippingAddress(aliased)?.id,snapshot.id)
 assert.deepEqual(orderCustomer(aliased),{name:'Order Snapshot',email:'snapshot@example.com',phone:'222'})

 const relationshipNames=normalizeAdminOrder({...order,order_items:[item],order_addresses:[snapshot]})
 assert.ok(relationshipNames)
 assert.equal(relationshipNames.items.length,1)
 assert.equal(relationshipNames.addresses.length,1)

 const missing=normalizeAdminOrder({...order,order_items:undefined,order_addresses:undefined})
 assert.ok(missing)
 assert.deepEqual(missing.items,[])
 assert.deepEqual(missing.addresses,[])
 assert.equal(orderItemCount(missing),0)
 assert.equal(shippingAddress(missing),null)
 assert.equal(orderCustomer(missing).name,'Customer unavailable')

 const empty=normalizeAdminOrder({...order,items:[],addresses:[]})
 assert.ok(empty)
 assert.equal(shippingAddress(empty),null)

 const malformed=normalizeAdminOrder({...order,items:[null,item,'bad'],addresses:[undefined,snapshot,4]})
 assert.ok(malformed)
 assert.equal(malformed.items.length,1)
 assert.equal(malformed.addresses.length,1)
 assert.equal(shippingAddress(malformed)?.full_name,'Order Snapshot')
 assert.equal(normalizeAdminOrders([null,{},malformed]).length,1)

 assert.equal(money(149900,'INR'),'₹1,499')
 assert.deepEqual(orderLifecycleActions(order).map(action=>action.label),['Confirm Order','Cancel Order'])
 console.log('PASS Admin Order model: relation aliases, missing/empty/malformed arrays, immutable shipping snapshot priority, INR, and lifecycle actions verified')
}finally{
 await server.close()
}
