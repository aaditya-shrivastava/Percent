import { createClient } from '@supabase/supabase-js'
import { getFirebaseSupabaseAccessToken } from './firebaseSession'
import { legacySupabaseAuth } from './legacySupabaseAuth'
import { supabasePublishableKey, supabaseUrl } from './supabaseConfig'

// Primary application data client. Firebase is authoritative; an existing
// Supabase Auth token is used only when no Firebase user exists during cutover.
export const firebaseSupabase = createClient(supabaseUrl, supabasePublishableKey, {
  accessToken: async () => {
    const firebaseToken = await getFirebaseSupabaseAccessToken()
    if (firebaseToken) return firebaseToken
    const { data } = await legacySupabaseAuth.auth.getSession()
    return data.session?.access_token ?? null
  },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})
