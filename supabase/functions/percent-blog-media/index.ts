import { createClient } from 'npm:@supabase/supabase-js@2.99.1'

const bucket = 'percent-blog-images'
const project = 'gijyjdeohvdrnvqfqdha'
const pathPattern = /^posts\/([0-9a-f-]{36})\/([0-9a-f]{64})\.(jpg|png|webp)$/
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const validPath = (path: string, postId: string) => pathPattern.test(path) && pathPattern.exec(path)?.[1] === postId

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  if (new URL(url).hostname !== `${project}.supabase.co`) return respond({ error: 'Project mismatch' }, 503)
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const publicKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!secret || !publicKey) return respond({ error: 'Media service unavailable' }, 503)
  const admin = createClient(url, secret)
  const publicClient = createClient(url, publicKey)
  const contentType = request.headers.get('content-type') ?? ''
  let action: string, postId: string, paths: string[] = [], file: File | null = null
  try {
    if (contentType.includes('multipart/form-data')) {
      if (Number(request.headers.get('content-length') ?? 0) > 11 * 1024 * 1024) return respond({ error: 'Image exceeds 10 MB' }, 413)
      const form = await request.formData()
      action = String(form.get('action') ?? '')
      postId = String(form.get('post_id') ?? '')
      file = form.get('file') instanceof File ? form.get('file') as File : null
    } else {
      const body = await request.json() as { action?: string; post_id?: string; paths?: string[] }
      action = body.action ?? ''
      postId = body.post_id ?? ''
      paths = Array.isArray(body.paths) ? body.paths : []
    }
  } catch { return respond({ error: 'Invalid request' }, 400) }
  if (!/^[0-9a-f-]{36}$/.test(postId)) return respond({ error: 'Invalid article' }, 400)
  if (action === 'public_sign') {
    if (paths.length < 1 || paths.length > 2 || paths.some(path => !validPath(path, postId))) return respond({ error: 'Invalid media request' }, 400)
    const { data: post } = await publicClient.from('blog_posts').select('id').eq('id', postId).eq('status', 'published').lte('published_at', new Date().toISOString()).maybeSingle()
    if (!post) return respond({ error: 'Article unavailable' }, 404)
    const { data: images, error } = await publicClient.from('blog_images').select('url').eq('post_id', postId)
    if (error || paths.some(path => !images?.some(image => image.url === `storage://${bucket}/${path}`))) return respond({ error: 'Media unavailable' }, 404)
    const media: Record<string, string> = {}
    for (const path of paths) {
      const signed = await admin.storage.from(bucket).createSignedUrl(path, 300)
      if (signed.error) return respond({ error: 'Media unavailable' }, 404)
      media[path] = signed.data.signedUrl
    }
    return respond({ media })
  }
  const authorization = request.headers.get('Authorization') ?? ''
  const token = /^Bearer[ ]+([^ ]+)$/i.exec(authorization)?.[1]
  if (!token) return respond({ error: 'Authentication required' }, 401)
  const caller = createClient(url, publicKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: role, error: roleError } = await caller.rpc('get_my_role')
  if (roleError) return respond({ error: 'Authentication required' }, 401)
  if (!['admin', 'super_admin'].includes(role ?? '')) return respond({ error: 'Admin access required' }, 403)
  const { data: post, error: postError } = await caller.from('blog_posts').select('id,status').eq('id', postId).maybeSingle()
  if (postError || !post) return respond({ error: 'Article unavailable' }, 404)
  if (action === 'admin_sign') {
    if (paths.length < 1 || paths.length > 2 || paths.some(path => !validPath(path, postId))) return respond({ error: 'Invalid media request' }, 400)
    const media: Record<string, string> = {}
    for (const path of paths) {
      const signed = await admin.storage.from(bucket).createSignedUrl(path, 300)
      if (signed.error) return respond({ error: 'Media unavailable' }, 404)
      media[path] = signed.data.signedUrl
    }
    return respond({ media })
  }
  if (action === 'cleanup') {
    if (paths.length < 1 || paths.length > 2 || paths.some(path => !validPath(path, postId))) return respond({ error: 'Invalid media request' }, 400)
    const { data: referenced, error } = await admin.from('blog_images').select('url').eq('post_id', postId).in('url', paths.map(path => `storage://${bucket}/${path}`))
    if (error) return respond({ error: 'Cleanup unavailable' }, 503)
    if (referenced?.length) return respond({ error: 'Referenced media cannot be removed' }, 409)
    const removed = await admin.storage.from(bucket).remove(paths)
    return removed.error ? respond({ error: 'Cleanup failed' }, 409) : respond({ removed: paths.length })
  }
  if (action !== 'upload' || !file) return respond({ error: 'Invalid media action' }, 400)
  if (file.size < 16 || file.size > 10 * 1024 * 1024) return respond({ error: 'Image exceeds 10 MB or is invalid' }, 400)
  const bytes = new Uint8Array(await file.arrayBuffer())
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((part, index) => bytes[index] === part)
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes.at(-2) === 255 && bytes.at(-1) === 217
  const webp = new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  const kind = png ? { mime: 'image/png', extension: 'png' } : jpeg ? { mime: 'image/jpeg', extension: 'jpg' } : webp ? { mime: 'image/webp', extension: 'webp' } : null
  if (!kind || file.type !== kind.mime) return respond({ error: 'Invalid image content' }, 400)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hash = Array.from(new Uint8Array(digest), part => part.toString(16).padStart(2, '0')).join('')
  const path = `posts/${postId}/${hash}.${kind.extension}`
  const uploaded = await admin.storage.from(bucket).upload(path, bytes, { contentType: kind.mime, upsert: false })
  if (uploaded.error) return respond({ error: 'Image already exists or upload failed' }, 409)
  const signed = await admin.storage.from(bucket).createSignedUrl(path, 300)
  if (signed.error) {
    await admin.storage.from(bucket).remove([path])
    return respond({ error: 'Preview unavailable' }, 503)
  }
  return respond({ path, url: `storage://${bucket}/${path}`, preview_url: signed.data.signedUrl })
})
