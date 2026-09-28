import { createClient } from '@supabase/supabase-js'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const aliasPattern = /^u_[0-9a-f]{32}@login[.]percent[.]invalid$/
const usernamePattern = /^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$/
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const allowedActions = new Set(['check-availability', 'resolve-login', 'reserve-registration', 'release-registration', 'finalize-registration', 'send-verification', 'verify-contact-email', 'request-password-recovery', 'recover-registration'])

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}
function secret(name: string) {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`Missing server configuration: ${name}`)
  return value
}
function enabled() { return Deno.env.get('PERCENT_USERNAME_AUTH_ENABLED')?.trim().toLowerCase() === 'true' }
function emailEnabled() { return Deno.env.get('PERCENT_AUTH_EMAIL_ENABLED')?.trim().toLowerCase() === 'true' }
function bearer(request: Request) {
  const match = /^Bearer[ ]+([^ ]+)$/i.exec(request.headers.get('authorization') ?? '')
  return match?.[1] ?? null
}
function canonicalUsername(value: unknown) {
  if (typeof value !== 'string' || value !== value.trim() || value.length > 24) return null
  const normalized = value.toLowerCase()
  return usernamePattern.test(normalized) && !/[._][._]/.test(normalized) ? normalized : null
}
function canonicalIdentifier(value: unknown) {
  if (typeof value !== 'string' || value !== value.trim() || value.length < 3 || value.length > 320) return null
  const normalized = value.toLowerCase()
  if (normalized.includes('@')) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null
  return canonicalUsername(normalized)
}
function canonicalEmail(value: unknown) {
  if (typeof value !== 'string' || value !== value.trim() || value.length < 3 || value.length > 320) return null
  const normalized = value.toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null
}
function randomHex(bytes: number) {
  const value = crypto.getRandomValues(new Uint8Array(bytes))
  return [...value].map(byte => byte.toString(16).padStart(2, '0')).join('')
}
async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}
async function hmacHex(value: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret('PERCENT_USERNAME_RATE_LIMIT_SECRET')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return [...new Uint8Array(signed)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}
function bytea(hex: string) { return `\\x${hex}` }
function base64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
function firebaseAdminAuth() {
  if (!getApps().length) {
    const projectId = secret('FIREBASE_PROJECT_ID')
    if (projectId !== 'percent-63d3e') throw new Error('Firebase project mismatch')
    initializeApp({ credential: cert({ projectId, clientEmail: secret('FIREBASE_CLIENT_EMAIL'), privateKey: secret('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n') }), projectId })
  }
  return getAuth()
}
function appUrl() {
  const value = secret('PERCENT_AUTH_APP_URL').replace(/\/$/, '')
  const parsed = new URL(value)
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) throw new Error('Invalid auth app URL')
  return value
}
async function sendAuthEmail(to: string, subject: string, html: string) {
  if (!emailEnabled()) throw new Error('Auth email disabled')
  const result = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${secret('RESEND_API_KEY')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: secret('PERCENT_AUTH_EMAIL_FROM'), to: [to], subject, html }) })
  if (!result.ok) throw new Error('Auth email delivery failed')
}
function scopedClient(url: string, token: string) {
  return createClient(url, secret('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405)

  let body: Record<string, unknown>
  try {
    const parsed: unknown = await request.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return response({ error: 'Invalid request' }, 400)
    body = parsed as Record<string, unknown>
  } catch { return response({ error: 'Invalid request' }, 400) }

  if ('password' in body || 'confirmPassword' in body || 'newPassword' in body) return response({ error: 'Invalid request' }, 400)
  const action = typeof body.action === 'string' ? body.action : ''
  if (!allowedActions.has(action)) return response({ error: 'Invalid request' }, 400)
  if (action !== 'verify-contact-email' && !enabled()) return response({ error: 'Username authentication is unavailable.' }, 503)

  try {
    const url = secret('SUPABASE_URL')
    const serviceKey = secret('SUPABASE_SERVICE_ROLE_KEY')
    const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    if (action === 'verify-contact-email') {
      const token = typeof body.token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(body.token) ? body.token : null
      if (!token) return response({ verified: false }, 400)
      const hash = await sha256Hex(token)
      const { data, error } = await service.rpc('verify_contact_email', { p_token_hash: bytea(hash) })
      if (error) throw error
      return response({ verified: data === true }, data === true ? 200 : 400)
    }

    if (action === 'send-verification') {
      if (!emailEnabled()) return response({ error: 'Email delivery is unavailable.' }, 503)
      const token = bearer(request)
      if (!token) return response({ error: 'Firebase authentication required' }, 401)
      const scoped = scopedClient(url, token)
      const rawToken = base64Url(crypto.getRandomValues(new Uint8Array(32)))
      const hash = await sha256Hex(rawToken)
      const { data, error } = await scoped.rpc('create_my_contact_email_verification', { p_token_hash: bytea(hash), p_ttl_seconds: 86400 })
      if (error || !Array.isArray(data) || !data[0] || typeof data[0].contact_email !== 'string') throw error ?? new Error('Invalid verification state')
      const verifyUrl = new URL('/verify-email', `${appUrl()}/`)
      verifyUrl.searchParams.set('token', rawToken)
      await sendAuthEmail(data[0].contact_email, 'Verify your Percent email', `<div style="font-family:Arial,sans-serif;color:#171412;max-width:560px;margin:auto"><p style="letter-spacing:.18em;font-weight:700">PERCENT</p><h1>Verify your email</h1><p>Confirm this address to enable secure account recovery.</p><p><a href="${verifyUrl.toString()}" style="display:inline-block;background:#711d32;color:#fff;padding:14px 22px;text-decoration:none">VERIFY EMAIL</a></p><p>If you did not request this, you can ignore this email.</p></div>`)
      return response({ ok: true })
    }

    if (action === 'request-password-recovery') {
      if (!emailEnabled()) return response({ error: 'Recovery is unavailable.' }, 503)
      const identifier = canonicalIdentifier(body.identifier)
      if (!identifier) return response({ ok: true })
      const network = (request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown').split(',')[0].trim().slice(0, 80)
      const keyHash = await hmacHex(`recovery\u001f${network}\u001f${identifier}`)
      const { data: allowed, error: rateError } = await service.rpc('consume_username_auth_rate_limit', { p_operation: 'recovery', p_key_hash: bytea(keyHash), p_limit: 5, p_window_seconds: 300 })
      if (rateError) throw rateError
      if (!allowed) return response({ ok: true })
      const { data } = await service.rpc('username_auth_get_recovery_target', { p_identifier: identifier })
      if (Array.isArray(data) && data[0] && typeof data[0].login_alias === 'string' && aliasPattern.test(data[0].login_alias) && typeof data[0].verified_contact_email === 'string') {
        const resetLink = await firebaseAdminAuth().generatePasswordResetLink(data[0].login_alias, { url: `${appUrl()}/login` })
        await sendAuthEmail(data[0].verified_contact_email, 'Reset your Percent password', `<div style="font-family:Arial,sans-serif;color:#171412;max-width:560px;margin:auto"><p style="letter-spacing:.18em;font-weight:700">PERCENT</p><h1>Password reset request</h1><p>Use the secure Firebase link below to reset your password.</p><p><a href="${resetLink}" style="display:inline-block;background:#711d32;color:#fff;padding:14px 22px;text-decoration:none">RESET PASSWORD</a></p><p>If you did not request this, you can ignore this email.</p></div>`)
      }
      return response({ ok: true })
    }

    if (action === 'recover-registration') {
      if ('firebase_uid' in body || 'percent_user_id' in body || 'role' in body || 'login_alias' in body || 'username' in body) return response({ error: 'Invalid request' }, 400)
      const token = bearer(request)
      if (!token) return response({ error: 'Firebase authentication required' }, 401)
      const scoped = scopedClient(url, token)
      const { error: provisionError } = await scoped.rpc('provision_my_percent_identity')
      if (provisionError) return response({ error: 'Firebase authentication required' }, 401)
      const reservationToken = randomHex(32)
      const hash = await sha256Hex(reservationToken)
      const { data, error } = await scoped.rpc('recover_my_username_registration', { p_new_secret_hash: bytea(hash), p_ttl_seconds: 900 })
      if (error || !Array.isArray(data) || !data[0] || typeof data[0].reservation_id !== 'string' || typeof data[0].expires_at !== 'string') throw error ?? new Error('Invalid recovery response')
      return response({ reservation_id: data[0].reservation_id, reservation_token: reservationToken, expires_at: data[0].expires_at })
    }

    const network = (request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown').split(',')[0].trim().slice(0, 80)
    const subject = action === 'resolve-login' ? canonicalIdentifier(body.identifier)
      : action === 'release-registration' || action === 'finalize-registration' ? (typeof body.reservation_id === 'string' ? body.reservation_id : null)
      : canonicalUsername(body.username)
    if (!subject) return response({ error: 'Invalid request' }, 400)
    const operation = action === 'check-availability' ? 'availability'
      : action === 'resolve-login' ? 'resolve_login'
      : action === 'reserve-registration' ? 'reserve_registration' : 'recovery'
    const limit = action === 'resolve-login' ? 12 : action === 'check-availability' ? 20 : 6
    const keyHash = await hmacHex(`${operation}\u001f${network}\u001f${subject}`)
    const { data: allowed, error: rateError } = await service.rpc('consume_username_auth_rate_limit', {
      p_operation: operation, p_key_hash: bytea(keyHash), p_limit: limit, p_window_seconds: 60,
    })
    if (rateError) throw rateError
    if (!allowed) return response({ error: 'Too many requests' }, 429)

    if (action === 'check-availability') {
      const { data, error } = await service.rpc('username_auth_check_availability', { p_username: subject })
      if (error) throw error
      return response({ available: data === true })
    }
    if (action === 'resolve-login') {
      const { data, error } = await service.rpc('username_auth_resolve_login', { p_identifier: subject })
      if (error) throw error
      const loginAlias = typeof data === 'string' && aliasPattern.test(data) ? data : `u_${randomHex(16)}@login.percent.invalid`
      return response({ login_alias: loginAlias })
    }
    if (action === 'reserve-registration') {
      const contactEmail = canonicalEmail(body.contact_email)
      if (!contactEmail) return response({ error: 'Invalid request' }, 400)
      const reservationToken = randomHex(32)
      const hash = await sha256Hex(reservationToken)
      const { data, error } = await service.rpc('reserve_username_registration', {
        p_username: subject, p_contact_email: contactEmail, p_secret_hash: bytea(hash), p_ttl_seconds: 900,
      })
      if (error || !Array.isArray(data) || !data[0]) {
        if ((error as { code?: string } | null)?.code === 'PT409') return response({ error: 'Username unavailable' }, 409)
        throw error ?? new Error('Invalid reservation response')
      }
      const row = data[0] as Record<string, unknown>
      if (typeof row.reservation_id !== 'string' || !uuidPattern.test(row.reservation_id) || typeof row.login_alias !== 'string' || !aliasPattern.test(row.login_alias) || typeof row.expires_at !== 'string') throw new Error('Invalid reservation response')
      return response({ reservation_id: row.reservation_id, reservation_token: reservationToken, login_alias: row.login_alias, expires_at: row.expires_at })
    }

    const reservationId = typeof body.reservation_id === 'string' && uuidPattern.test(body.reservation_id) ? body.reservation_id : null
    const reservationToken = typeof body.reservation_token === 'string' && /^[0-9a-f]{64}$/.test(body.reservation_token) ? body.reservation_token : null
    if (!reservationId || !reservationToken) return response({ error: 'Invalid request' }, 400)
    const hash = await sha256Hex(reservationToken)
    if (action === 'release-registration') {
      const { error } = await service.rpc('release_username_registration', { p_reservation_id: reservationId, p_secret_hash: bytea(hash) })
      if (error) throw error
      return response({ ok: true })
    }

    if ('firebase_uid' in body || 'percent_user_id' in body || 'role' in body || 'login_alias' in body || 'username' in body || 'contact_email' in body) return response({ error: 'Invalid request' }, 400)
    const token = bearer(request)
    if (!token) return response({ error: 'Firebase authentication required' }, 401)
    const scoped = scopedClient(url, token)
    const { error: provisionError } = await scoped.rpc('provision_my_percent_identity')
    if (provisionError) return response({ error: 'Firebase authentication required' }, 401)
    const { error: finalizeError } = await scoped.rpc('finalize_username_registration', { p_reservation_id: reservationId, p_secret_hash: bytea(hash) })
    if (finalizeError) throw finalizeError
    const { data: role, error: roleError } = await scoped.rpc('get_my_role')
    if (roleError || !['customer', 'admin', 'super_admin'].includes(String(role))) throw roleError ?? new Error('Invalid Percent role')
    return response({ ok: true })
  } catch {
    if (action === 'request-password-recovery') return response({ ok: true })
    return response({ error: action === 'resolve-login' ? 'Unable to sign in' : 'Unable to complete username request' }, 400)
  }
})
