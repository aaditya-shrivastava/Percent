import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

// Run the actual dependency-free TypeScript policy/metric modules; no duplicated
// authorization implementation and no test-only branches in the application.
const moduleFromTS=async path=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'))
const {resolveAdminAccess}=await moduleFromTS('src/backend/admin/access.ts')
const {deriveStockAlerts,startOfRange}=await moduleFromTS('src/backend/admin/metrics.ts')
for(const role of ['admin','super_admin'])assert.deepEqual(await resolveAdminAccess({getUserId:async()=>'a',getMyRole:async()=>role},'a'),{status:'allowed',userId:'a',role})
for(const role of ['customer',null,undefined,'owner',{role:'admin'}])assert.equal((await resolveAdminAccess({getUserId:async()=>'a',getMyRole:async()=>role},'a')).status,'denied')
assert.equal((await resolveAdminAccess({getUserId:async()=>null,getMyRole:()=>{throw Error('Must not be called')}},'a')).status,'unauthenticated')
assert.equal((await resolveAdminAccess({getUserId:async()=>'b',getMyRole:async()=>'admin'},'a')).status,'denied')
let identityReads=0
assert.equal((await resolveAdminAccess({getUserId:async()=>++identityReads===1?'a':'b',getMyRole:async()=>'admin'},'a')).status,'denied')
assert.equal((await resolveAdminAccess({getUserId:async()=>'a',getMyRole:async()=>{throw Error('Private details')}},'a')).status,'error')
console.log('PASS guard: both admin roles, customer/null/unknown denial, no session, identity mismatch, in-flight user switch, RPC error')

const product=(limit,status='active')=>({id:'p',name:'Test design',slug:'test',status,is_visible:true,is_shop_available:true,production_limit:limit})
const units=(limit,sold)=>Array.from({length:limit},(_,i)=>({product_id:'p',variant_id:'v',sold_at:i<sold?'2026-01-01':null,withdrawn_at:null}))
for(const limit of [100,250,500,1000]){
  const sold=Math.ceil(limit*.92)
  const [alert]=deriveStockAlerts([product(limit)],units(limit,sold),new Set(['v']))
  assert.equal(alert.kind,'Run Near Limit');assert.equal(alert.sold,sold);assert.equal(alert.limit,limit);assert.equal(alert.remaining,limit-sold)
  const [soldOut]=deriveStockAlerts([product(limit,'archived')],units(limit,limit),new Set(['v']))
  assert.equal(soldOut.kind,'Sold Out');assert.equal(soldOut.limit,limit);assert.equal(soldOut.remaining,0)
}
assert.deepEqual(deriveStockAlerts([product(250,'draft')],[],new Set()),[])
assert.deepEqual(deriveStockAlerts([product(250)],units(250,100),new Set(['v'])),[])
const inventory=units(250,156);inventory.slice(170).forEach(u=>{u.withdrawn_at='2026-01-01'})
const [low]=deriveStockAlerts([product(250)],inventory,new Set(['v']))
assert.equal(low.sold,156);assert.equal(low.limit,250);assert.equal(low.remaining,14);assert.equal(low.allocated,250)
assert.deepEqual(deriveStockAlerts([product(250)],units(250,0),new Set()),[])
assert.equal(startOfRange('all'),null)
const date=new Date(2026,8,13,12)
const start=new Date(startOfRange('7',date));assert.equal(start.getDate(),7);assert.equal(start.getHours(),0)
console.log('PASS stock: per-design 100/250/500/1000 limits, 156/250 display source, sold-out, withdrawn and disabled units, drafts, date range')
