import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = readFileSync('src/backend/admin/blogImages.ts', 'utf8')
const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { mergeBlogImagesForSave } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`)
const image = (role, url) => ({ role, url })
const primary = image('primary', 'external-primary')
const secondary = image('secondary', 'external-secondary')
const managedPrimary = image('primary', 'managed-primary')
const managedSecondary = image('secondary', 'managed-secondary')

assert.deepEqual(mergeBlogImagesForSave([managedPrimary], [primary, secondary], new Set()), [managedPrimary, secondary], 'A: replacing primary preserves secondary')
assert.deepEqual(mergeBlogImagesForSave([managedSecondary], [primary, secondary], new Set()), [primary, managedSecondary], 'B: replacing secondary preserves primary')
assert.deepEqual(mergeBlogImagesForSave([primary, secondary], [primary, secondary], new Set()), [primary, secondary], 'C: untouched save preserves both roles')
assert.deepEqual(mergeBlogImagesForSave([primary], [primary, secondary], new Set(['secondary'])), [primary], 'D: explicit removal removes only the selected role')
assert.deepEqual(mergeBlogImagesForSave([managedPrimary], [primary, secondary], new Set()), [managedPrimary, secondary], 'E: managed and external images coexist without omission')
assert.deepEqual(mergeBlogImagesForSave([managedSecondary], [managedPrimary, managedSecondary], new Set()), [managedPrimary, managedSecondary], 'F: idempotently reused managed media preserves the other role')

console.log('PASS Blog editor image preservation: replace either role, untouched save, explicit removal, mixed media and idempotent reuse')
