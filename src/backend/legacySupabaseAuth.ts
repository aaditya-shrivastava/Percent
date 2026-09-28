import { createClient } from '@supabase/supabase-js'
import { supabasePublishableKey, supabaseUrl } from './supabaseConfig'

// Temporary transition-only client for existing Supabase Auth sessions.
// Application data access must use the Firebase-aware client exported by client.ts.
export const legacySupabaseAuth = createClient(supabaseUrl, supabasePublishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
