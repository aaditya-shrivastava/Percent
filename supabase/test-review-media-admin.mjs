import fs from 'node:fs'
import assert from 'node:assert/strict'

const source=fs.readFileSync(new URL('functions/percent-review-media/index.ts',import.meta.url),'utf8')
assert.match(source,/action\?\.action==='read'/)
assert.match(source,/\.eq\('status','approved'\)/)
assert.match(source,/\.in\('status',\['active','archived'\]\)/)
assert.match(source,/action\?\.action==='admin_read'/)
assert.match(source,/caller\.rpc\('get_my_role'\)/)
assert.match(source,/\['admin','super_admin'\]\.includes/)
assert.match(source,/\.eq\('review_id',review\.id\)/)
assert.match(source,/createSignedUrl\(image\.object_path,300\)/)
assert.doesNotMatch(source,/getPublicUrl/)
console.log('PASS Review media contract: public approval gate preserved; admin_read requires trusted role and signs only requested review paths for 300 seconds')
