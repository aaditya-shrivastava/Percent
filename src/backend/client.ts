import { firebaseSupabase } from './firebaseSupabase'
import { projectRef } from './supabaseConfig'
export { legacySupabaseAuth } from './legacySupabaseAuth'

export { projectRef }
export const supabase = firebaseSupabase

export function checkError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}
