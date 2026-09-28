import { createClient } from 'npm:@supabase/supabase-js@2.99.1'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const projectRef = 'gijyjdeohvdrnvqfqdha'
const firebaseProjectId = 'percent-63d3e'
const firebaseIssuer = `https://securetoken.google.com/${firebaseProjectId}`
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
  return /^Bearer[ ]+([^ ]+)$/i.exec(authorization)?.[1] ?? null
}

function firebaseAuth() {
  if (!getApps().length) {
    const projectId = requiredSecret('FIREBASE_PROJECT_ID')
    if (projectId !== firebaseProjectId) throw new Error('Firebase project mismatch')
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

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)
  if (Deno.env.get('LINK_FIREBASE_IDENTITY_ENABLED') !== 'true') {
    return respond({ error: 'Identity linking is disabled' }, 404)
  }
  if (Number(request.headers.get('content-length') ?? 0) > 20_000) {
    return respond({ error: 'Invalid request' }, 400)
  }

  const supabaseToken = bearerToken(request)
  if (!supabaseToken) return respond({ error: 'Supabase authentication required' }, 401)

  let input: Record<string, unknown>
  try {
    const raw: unknown = await request.json()
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('invalid')
    input = raw as Record<string, unknown>
  } catch {
    return respond({ error: 'Invalid request' }, 400)
  }
  if (
    Object.keys(input).length !== 1
    || typeof input.firebase_id_token !== 'string'
    || input.firebase_id_token.length < 100
    || input.firebase_id_token.length > 20_000
  ) return respond({ error: 'Only a Firebase ID token may be supplied' }, 400)

  try {
    const url = requiredSecret('SUPABASE_URL')
    if (new URL(url).hostname !== `${projectRef}.supabase.co`) {
      return respond({ error: 'Project mismatch' }, 503)
    }
    const publicKey = requiredSecret('SUPABASE_ANON_KEY')
    const serviceKey = requiredSecret('SUPABASE_SERVICE_ROLE_KEY')
    const service = createClient(url, serviceKey, { auth: { persistSession: false } })

    // Proof A is deliberately Supabase Auth-specific. Firebase tokens are not
    // accepted as the transition authority in the Authorization header.
    const { data: supabaseIdentity, error: supabaseAuthError } =
      await service.auth.getUser(supabaseToken)
    if (supabaseAuthError || !supabaseIdentity.user) {
      return respond({ error: 'Invalid Supabase authentication' }, 401)
    }

    const caller = createClient(url, publicKey, {
      global: { headers: { Authorization: `Bearer ${supabaseToken}` } },
      auth: { persistSession: false },
    })
    const [{ data: role, error: roleError }, { data: profile, error: profileError }] =
      await Promise.all([
        caller.rpc('get_my_role'),
        caller.from('profiles').select('id').maybeSingle(),
      ])
    if (roleError || profileError || !profile) {
      return respond({ error: 'Unable to resolve Supabase identity' }, 401)
    }
    if (role !== 'super_admin') return respond({ error: 'Super Admin access required' }, 403)
    if (profile.id !== supabaseIdentity.user.id) {
      return respond({ error: 'Supabase identity mismatch' }, 403)
    }
    const percentUserId = profile.id

    // Proof B is independently verified by Firebase Admin, including revocation.
    const auth = firebaseAuth()
    let decoded
    try {
      decoded = await auth.verifyIdToken(input.firebase_id_token, true)
    } catch {
      return respond({ error: 'Invalid Firebase authentication' }, 401)
    }
    const firebaseSubject = decoded.sub
    if (
      decoded.iss !== firebaseIssuer
      || decoded.aud !== firebaseProjectId
      || decoded.uid !== firebaseSubject
      || typeof firebaseSubject !== 'string'
      || firebaseSubject.length < 1
      || firebaseSubject.length > 128
      || typeof decoded.exp !== 'number'
      || decoded.exp * 1000 <= Date.now()
    ) return respond({ error: 'Invalid Firebase authentication' }, 401)

    const firebaseUser = await auth.getUser(firebaseSubject)
    if (firebaseUser.disabled) return respond({ error: 'Invalid Firebase authentication' }, 401)

    // Service-role access begins only after both identities and the exact
    // private super_admin role have been independently proven. The narrow RPC
    // is the only exposed bridge into the non-Data-API private schema.
    const { data: linkResult, error: linkError } = await service.rpc(
      'link_firebase_identity_transition',
      {
        p_percent_user_id: percentUserId,
        p_issuer: firebaseIssuer,
        p_external_subject: firebaseSubject,
      },
    )
    if (linkError) {
      const status = linkError.code === 'PT409' ? 409
        : linkError.code === '42501' ? 403
        : 503
      return respond({ error: status === 409 ? linkError.message : 'Identity link failed' }, status)
    }

    const existingClaims = firebaseUser.customClaims ?? {}
    const safeClaims: Record<string, unknown> = { ...existingClaims, role: 'authenticated' }
    delete safeClaims.admin
    delete safeClaims.super_admin
    const claimsUpdated = existingClaims.role !== 'authenticated'
      || existingClaims.admin !== undefined
      || existingClaims.super_admin !== undefined
    if (claimsUpdated) await auth.setCustomUserClaims(firebaseSubject, safeClaims)

    return respond({
      linked: linkResult?.linked === true,
      idempotent: linkResult?.idempotent === true,
      claims_updated: claimsUpdated,
    })
  } catch {
    return respond({ error: 'Identity linking failed' }, 503)
  }
})
