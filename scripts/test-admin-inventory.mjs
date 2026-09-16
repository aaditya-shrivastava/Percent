import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'
const source=fs.readFileSync(new URL('../src/backend/admin/inventory-model.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText
const {validateAllocation,allocationEligible,allocationState,filterInventory,initialInventoryFilters}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
const p={id:'p',name:'Design',slug:'design',design_code:'P-1',status:'draft',production_limit:250,allocated:0,sold:0,available:0,remaining:250,created_at:'2026-01-01',variants:[{id:'a',sku:'SKU-A',enabled:true,allocated:0,withdrawn:0},{id:'b',sku:'SKU-B',enabled:true,allocated:0,withdrawn:0}]}
assert.equal(allocationEligible(p),true);assert.equal(allocationState(p),'Not Allocated')
assert.deepEqual(validateAllocation(p,{a:'100',b:'100'}),{errors:{},total:200,remaining:50})
assert.equal(validateAllocation(p,{a:'100',b:'151'}).errors.form,'1 units above production limit.')
for(const n of ['','-1','1.5','NaN','Infinity','1e2','9007199254740992'])assert.ok(validateAllocation(p,{a:n,b:'0'}).errors.a)
for(const limit of [100,250,1000])assert.equal(validateAllocation({...p,production_limit:limit},{a:String(limit),b:'0'}).remaining,0)
assert.equal(allocationEligible({...p,status:'archived'}),false)
assert.equal(allocationEligible({...p,remaining:0}),false)
assert.equal(allocationEligible({...p,history:true}),false)
assert.ok(validateAllocation({...p,variants:[{...p.variants[0],allocated:10},p.variants[1]]},{a:'9',b:'0'}).errors.a)
assert.ok(validateAllocation({...p,variants:[{...p.variants[0],enabled:false},p.variants[1]]},{a:'1',b:'0'}).errors.a)
assert.equal(filterInventory([p],{...initialInventoryFilters,search:'sku-a'}).length,1)
assert.equal(filterInventory([p],{...initialInventoryFilters,availability:'available'}).length,0)
assert.equal(filterInventory([p],{...initialInventoryFilters,allocation:'Fully Allocated'}).length,0)
console.log('PASS inventory model: configured limits, whole units, lifecycle/history locks, reductions, disabled variants, SKU search, allocation/availability filters')
