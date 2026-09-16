import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'
const source=fs.readFileSync(new URL('../src/backend/admin/editor-model.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText
const {inrToPaise,blankEditor,validateEditor,editorPayload,slugify}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
for(const input of ['1299','1,299','₹1,299'])assert.equal(inrToPaise(input),129900)
assert.equal(inrToPaise('1299.99'),129999)
for(const input of ['-1','NaN','Infinity','12.123','1e3','1,29',''])assert.equal(inrToPaise(input),null,input)
const f={...blankEditor(),name:'Test design',slug:'test-design',design_code:'VERIFY-UI',price:'1299',production_limit:'250'}
assert.deepEqual(validateEditor(f),{})
for(const production_limit of ['0','-1','12.5','Infinity'])assert.ok(validateEditor({...f,production_limit}).production_limit)
assert.deepEqual(validateEditor({...f,production_limit:'1000'}),{})
const v={id:'one',colour_id:'stone',size:'S',sku:'VERIFY-STONE-S',price:'1299',compare:'',enabled:true,persisted:false,locked:false}
assert.ok(validateEditor({...f,variants:[v,{...v,id:'two'}]})['variant-1'])
assert.ok(validateEditor({...f,variants:[v,{...v,id:'two',size:'M'}]})['variant-1'])
const payload=editorPayload({...f,variants:[v]})
assert.equal(payload.product.price_paise,129900);assert.equal(payload.product.production_limit,250)
for(const key of ['status','is_visible','is_shop_available','sold','allocated','role','user_id'])assert.equal(key in payload.product,false)
assert.equal('persisted' in payload.variants[0],false);assert.equal('locked' in payload.variants[0],false)
assert.equal(slugify('[Verification] Product Editor UI'),'verification-product-editor-ui')
console.log('PASS editor money conversion, required fields, limits 250/1000, invalid limits, duplicate variants/SKUs, payload scope and slug generation')
