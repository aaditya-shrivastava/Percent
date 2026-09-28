import { requirePublicEnv } from './env'

export const supabaseUrl = requirePublicEnv('VITE_SUPABASE_URL')
export const supabasePublishableKey = requirePublicEnv('VITE_SUPABASE_PUBLISHABLE_KEY')

let parsedSupabaseUrl: URL
try {
  parsedSupabaseUrl = new URL(supabaseUrl)
} catch {
  throw new Error('Invalid public environment variable: VITE_SUPABASE_URL')
}

const projectHostSuffix = '.supabase.co'
if (parsedSupabaseUrl.protocol !== 'https:' || !parsedSupabaseUrl.hostname.endsWith(projectHostSuffix)) {
  throw new Error('Invalid public environment variable: VITE_SUPABASE_URL')
}

export const projectRef = parsedSupabaseUrl.hostname.slice(0, -projectHostSuffix.length)
