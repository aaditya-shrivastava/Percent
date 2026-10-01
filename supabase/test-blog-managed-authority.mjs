import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(line => line && !line.trimStart().startsWith('#')).map(line => { const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1).replace(/^['"]|['"]$/g, '')] }))
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
const now = new Date().toISOString()
const [postsResult, sectionsResult, imagesResult] = await Promise.all([
  supabase.from('blog_posts').select('*').eq('status', 'published').lte('published_at', now).order('published_at', { ascending: false }),
  supabase.from('blog_sections').select('*').order('sort_order'),
  supabase.from('blog_images').select('*'),
])
for (const result of [postsResult, sectionsResult, imagesResult]) assert.equal(result.error, null, result.error?.message)
const posts = postsResult.data ?? [], sections = sectionsResult.data ?? [], images = imagesResult.data ?? []
assert.equal(posts.length, 9)
assert.equal(sections.length, 27)
assert.equal(images.length, 12)
assert.equal(posts.filter(post => post.featured).length, 1)
assert.equal(posts.find(post => post.featured)?.slug, 'the-story-behind-100-pieces')
assert.deepEqual([...new Set(posts.map(post => post.category))].sort(), ['Brand', 'Community', 'Design', 'Process', 'Style'])
assert.ok(posts.every(post => post.first_published_at))
assert.ok(images.every(image => image.url.startsWith('storage://percent-blog-images/posts/')))
for (const post of posts) {
  const postImages = images.filter(image => image.post_id === post.id)
  const paths = postImages.map(image => image.url.slice('storage://percent-blog-images/'.length))
  const { data, error } = await supabase.functions.invoke('percent-blog-media', { body: { action: 'public_sign', post_id: post.id, paths } })
  assert.equal(error, null, error?.message)
  assert.equal(Object.keys(data.media ?? {}).length, paths.length)
  for (const url of Object.values(data.media ?? {})) assert.equal((await fetch(url)).ok, true)
}
const { error: saveDenied } = await supabase.rpc('save_blog_post', { p_post_id: posts[0].id, p_content: {}, p_expected_updated_at: posts[0].updated_at })
assert.ok(saveDenied, 'Anonymous Blog save must be denied')
const firstImage = images[0]
const { error: draftSignDenied, data: draftSignData } = await supabase.functions.invoke('percent-blog-media', { body: { action: 'admin_sign', post_id: firstImage.post_id, paths: [firstImage.url.slice('storage://percent-blog-images/'.length)] } })
assert.ok(draftSignDenied || draftSignData?.error, 'Anonymous Admin signing must be denied')
const source = fs.readFileSync('src/data/blog.ts', 'utf8')
assert.match(source, /blogAuthority = 'managed'/)
assert.doesNotMatch(source, /blogAuthority === 'managed'[^]*?hydrateBlogs\(articles\)[^]*?else[^]*?hydrateBlogs/i)
console.log('PASS managed Blog authority: 9 published posts, categories, featured invariant, 12 signed images and no source fallback')
