import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'
const source=fs.readFileSync(new URL('../src/backend/admin/adjustment-model.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText
const {adjustmentPreview,canAdjust}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
const p={status:'draft',production_limit:20,allocated:15,sold:0,remaining:5,history:false},v={physical:12,withdrawn:3,enabled:true}
const f={operation:'INCREASE',quantity:'5',reason:'Physical count correction',note:'Internal only'}
let r=adjustmentPreview(p,v,f);assert.deepEqual(r.errors,{});assert.equal(r.produced,20);assert.equal(r.after,17)
r=adjustmentPreview(p,v,{...f,operation:'DECREASE',quantity:'3'});assert.equal(r.after,9);assert.equal(r.produced,15);assert.equal(r.remaining,5)
r=adjustmentPreview(p,v,{...f,operation:'SET_EXACT',quantity:'15'});assert.equal(r.delta,3);assert.equal(r.produced,18)
for(const quantity of ['','-1','0','1.5','NaN','Infinity','1e2','2147483648'])assert.ok(adjustmentPreview(p,v,{...f,quantity}).errors.quantity)
assert.ok(adjustmentPreview(p,v,{...f,quantity:'6'}).errors.quantity)
assert.ok(adjustmentPreview(p,v,{...f,reason:''}).errors.reason)
assert.ok(adjustmentPreview(p,v,{...f,note:'x'.repeat(2001)}).errors.note)
assert.ok(adjustmentPreview({...p,allocated:20,remaining:0},v,{...f,operation:'SET_EXACT',quantity:'15'}).errors.quantity)
assert.ok(adjustmentPreview(p,{...v,enabled:false},f).errors.quantity)
assert.deepEqual(adjustmentPreview(p,{...v,enabled:false},{...f,operation:'DECREASE',quantity:'1'}).errors,{})
assert.equal(canAdjust({...p,status:'archived'},v),false);assert.equal(canAdjust({...p,history:true},v),false)
for(const production_limit of [100,250,1000])assert.equal(adjustmentPreview({...p,production_limit,allocated:0,remaining:production_limit},{...v,physical:0},{...f,quantity:String(production_limit)}).produced,production_limit)
console.log('PASS adjustment model: physical stock semantics, historical cap, all operations, 100/250/1000, disabled/archived/history locks, reason/note and invalid quantities')
