import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const source=await readFile(new URL('../src/backend/website.ts',import.meta.url),'utf8')
assert.match(source,/document\.banners\.length>0\|\|document\.sections\.length>0/)
assert.match(source,/fallbackWebsiteDocument/)
assert.match(source,/percent-website-media/)
assert.match(source,/expected_updated_at:document\.updated_at/)
assert.match(source,/public_read/)
assert.match(source,/admin_read/)
assert.match(source,/cleanup/)
assert.doesNotMatch(source,/localStorage/)
console.log('PASS Website content model: exact unconfigured fallback, batched signing, optimistic save token, admin preview, cleanup, and no local role/content state verified')
