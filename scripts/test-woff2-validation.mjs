import fs from 'node:fs'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import ts from 'typescript'
import {loadFontHandler} from './website-font-test-runtime.mjs'

const code = ts.transpileModule(fs.readFileSync('supabase/functions/percent-website-media/font-validation.ts','utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText
const {validateFontUpload,validateWoff2Header,isCanonicalFontFace,FONT_LIMIT} = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
const family = '80000000-0000-4000-a000-000000000001'
const bytes = fs.readFileSync('public/fonts/builtin/inter/inter-latin-wght-normal.woff2')
const {decodeWoff2:decode}=await loadFontHandler()
const file = (data=bytes,name='licensed-test.woff2',mime='font/woff2')=>new File([data],name,{type:mime})
const face = await validateFontUpload(file(),family,400,'normal',decode)
assert.equal(face.sha256,crypto.createHash('sha256').update(bytes).digest('hex'))
assert.equal(face.byte_size,bytes.length)
assert.ok(isCanonicalFontFace(family,face))
assert.ok(!isCanonicalFontFace(family,{...face,storage_path:'../../private.woff2'}))
assert.ok(!isCanonicalFontFace(family,{...face,sha256:'a'.repeat(64)}))
for (let weight=100;weight<=900;weight+=100) for (const style of ['normal','italic']) assert.ok(isCanonicalFontFace(family,await validateFontUpload(file(),family,weight,style,decode)))
for (const [data,name,mime] of [[Buffer.from('not a font'),'a.woff2','font/woff2'],[Buffer.alloc(FONT_LIMIT+1),'a.woff2','font/woff2'],[bytes,'a.png','font/woff2'],[bytes,'a.woff2','image/png']]) await assert.rejects(()=>validateFontUpload(file(data,name,mime),family,400,'normal',decode))
const malformed = Buffer.from(bytes)
malformed.fill(0,100)
await assert.rejects(()=>validateFontUpload(file(malformed),family,400,'normal',decode))
const truncated = bytes.subarray(0,bytes.length-1)
assert.throws(()=>validateWoff2Header(truncated))
const registry=JSON.parse(fs.readFileSync('public/fonts/builtin/registry.json'))
for(const asset of registry.flatMap(font=>font.assets))decode(fs.readFileSync('public'+asset.path))
for (const [id,weight,style] of [['../../path',400,'normal'],[family,450,'normal'],[family,400,'oblique']]) await assert.rejects(()=>validateFontUpload(file(),id,weight,style,decode))
console.log('PASS bounded production WOFF2 decoder for all 87 bundled faces; invalid signature/content/length/MIME/extension/size, all weights/styles, SHA-256 and canonical paths')
