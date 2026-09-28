import { createClient } from '@supabase/supabase-js'
import { getFirebaseSupabaseAccessToken } from './firebaseSession'
import { supabasePublishableKey, supabaseUrl } from './supabaseConfig'

// Kept separate from the existing Supabase Auth client during migration.
// Future Firebase-authenticated data calls must use this client explicitly.
export const firebaseSupabase = createClient(supabaseUrl, supabasePublishableKey, {
  accessToken: getFirebaseSupabaseAccessToken,
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})
