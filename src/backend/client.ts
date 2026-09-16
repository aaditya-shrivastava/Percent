import { createClient } from '@supabase/supabase-js'

export const projectRef = 'gijyjdeohvdrnvqfqdha'
export const supabase = createClient(`https://${projectRef}.supabase.co`, 'sb_publishable_QxLwW-LIAjzV-s8YbKMP2Q_-FqY_DXc', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export function checkError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}
