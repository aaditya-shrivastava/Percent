import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const source = readFileSync('supabase/functions/percent-blog-media/index.ts', 'utf8')
const storyPost = '9c534426-a17e-46fc-a639-34617de24288'
const powerPost = '9aa570c4-b18e-4287-ac62-91e01a7882f8'
const bytes = readFileSync('.phase8-blog-media/story-secondary.jpg')
const differentBytes = readFileSync('.phase8-blog-media/power-primary.jpg')
const hash = value => createHash('sha256').update(value).digest('hex')
const canonicalPath = (postId, value) => `posts/${postId}/${hash(value)}.jpg`

assert.equal(canonicalPath(storyPost, bytes), canonicalPath(storyPost, bytes), 'same bytes and post must resolve identically')
assert.notEqual(canonicalPath(storyPost, bytes), canonicalPath(powerPost, bytes), 'the same bytes must remain scoped to the requested post')
assert.notEqual(canonicalPath(storyPost, bytes), canonicalPath(storyPost, differentBytes), 'different bytes must resolve to a different object')
assert.match(source, /caller\.rpc\('get_my_role'\)/, 'upload must retain the database-backed Admin role check')
assert.match(source, /\['admin', 'super_admin'\]\.includes/, 'customer callers must remain denied')
assert.match(source, /upsert: false/, 'idempotency must never overwrite an existing object')
assert.match(source, /\.download\(path\)/, 'a failed upload must verify the exact derived existing object')
assert.match(source, /existingBytes\.byteLength !== bytes\.byteLength/, 'reuse must compare byte length')
assert.match(source, /existingHash !== hash/, 'reuse must compare the server-computed content hash')
assert.match(source, /existingKind\?\.mime !== kind\.mime/, 'reuse must compare the detected media type')
assert.doesNotMatch(source, /form\.get\(['"]path['"]\)/, 'upload must not accept a caller-provided Storage path')

console.log('PASS Blog media idempotency: canonical post scoping, byte identity, no overwrite, authorization and input constraints')
