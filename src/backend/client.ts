import { createClient } from '@supabase/supabase-js'
import { projectRef, supabasePublishableKey, supabaseUrl } from './supabaseConfig'

export { projectRef }
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export function checkError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}
