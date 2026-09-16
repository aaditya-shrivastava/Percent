import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'
const source=fs.readFileSync(new URL('../src/backend/admin/product-model.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText
const {formatINR,runMetrics,filterProducts,canArchive,emptyProductFilters:f}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
assert.equal(formatINR(129900),'₹1,299');assert.equal(formatINR(129950),'₹1,299.5')
assert.deepEqual(runMetrics(250,120),{remaining:130,progress:48})
assert.deepEqual(runMetrics(1000,720),{remaining:280,progress:72})
assert.deepEqual(runMetrics(250,250),{remaining:0,progress:100})
const p={id:'a',name:'Quiet Form',slug:'quiet-form',design_code:'P001',status:'draft',displayStatus:'draft',category_id:'tees',fit_type:'standard',skus:['P001-BLK-M'],tags:['minimal'],price_paise:129900,production_limit:250,sold:120,remaining:130,available:0,allocated:0,created_at:'2026-01-01'}
const q={...p,id:'b',name:'Another Design',status:'active',displayStatus:'active',category_id:'other',price_paise:149900,sold:240,remaining:10,available:10,allocated:250,fit_type:'oversized',created_at:'2026-02-01'}
for(const search of ['quiet','quiet-form','p001-blk','minimal'])assert.ok(filterProducts([p],{...f,search}).length===1)
assert.equal(filterProducts([p,q],{...f,status:'draft'})[0],p)
assert.equal(filterProducts([p,q],{...f,category:'tees',fit:'standard'})[0],p)
assert.equal(filterProducts([p,q],{...f,availability:'near'})[0],q)
assert.equal(filterProducts([p,q],{...f,search:'no matching design'}).length,0)
for(const sort of ['newest','az','price-high','sold','remaining'])assert.equal(filterProducts([p,q],{...f,sort})[0],q)
for(const sort of ['oldest','za','price-low'])assert.equal(filterProducts([p,q],{...f,sort})[0],p)
assert.equal(canArchive(p),false);assert.equal(canArchive(q),true);assert.equal(canArchive({...q,status:'archived'}),false)
console.log('PASS INR, per-design production 250/1000, remaining, search fields, filters, all sort options, no results, archive eligibility and permanent archive')
