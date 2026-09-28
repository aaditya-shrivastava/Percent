import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const expectedProjectId = 'percent-63d3e'
const expectedIssuer = `https://securetoken.google.com/${expectedProjectId}`
const rateWindowMs = 60_000
const rateLimit = 5
const attempts = new Map<string, { count: number; resetAt: number }>()
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

function requiredSecret(name: string) {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`Missing server configuration: ${name}`)
  return value
}

function bearerToken(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const match = /^Bearer[ ]+([^ ]+)$/i.exec(authorization)
  return match?.[1] ?? null
}

function firebaseAuth() {
  if (!getApps().length) {
    const projectId = requiredSecret('FIREBASE_PROJECT_ID')
    if (projectId !== expectedProjectId) throw new Error('Firebase project mismatch')
    initializeApp({
      credential: cert({
        projectId,
        clientEmail: requiredSecret('FIREBASE_CLIENT_EMAIL'),
        privateKey: requiredSecret('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
      }),
      projectId,
    })
  }
  return getAuth()
}

function rateLimited(subject: string) {
  const now = Date.now()
  if (attempts.size > 1_000) {
    for (const [key, value] of attempts) if (value.resetAt <= now) attempts.delete(key)
  }
  const current = attempts.get(subject)
  if (!current || current.resetAt <= now) {
    attempts.set(subject, { count: 1, resetAt: now + rateWindowMs })
    return false
  }
  current.count += 1
  return current.count > rateLimit
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)

  const token = bearerToken(request)
  if (!token) return respond({ error: 'Firebase authentication required' }, 401)

  try {
    const auth = firebaseAuth()
    const decoded = await auth.verifyIdToken(token, true)
    const subject = decoded.sub
    if (
      decoded.iss !== expectedIssuer
      || decoded.aud !== expectedProjectId
      || typeof subject !== 'string'
      || subject.length < 1
      || subject.length > 128
      || decoded.uid !== subject
    ) return respond({ error: 'Invalid Firebase token' }, 401)
    if (rateLimited(subject)) return respond({ error: 'Too many requests' }, 429)

    const user = await auth.getUser(subject)
    const existing = user.customClaims ?? {}
    const claims: Record<string, unknown> = { ...existing, role: 'authenticated' }
    delete claims.admin
    delete claims.super_admin

    const updateRequired = existing.role !== 'authenticated'
      || existing.admin !== undefined
      || existing.super_admin !== undefined
    if (updateRequired) await auth.setCustomUserClaims(subject, claims)

    return respond({ ok: true, updated: updateRequired })
  } catch {
    return respond({ error: 'Invalid Firebase token' }, 401)
  }
})
