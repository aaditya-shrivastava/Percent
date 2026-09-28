type PublicEnvName =
  | 'VITE_SUPABASE_URL'
  | 'VITE_SUPABASE_PUBLISHABLE_KEY'
  | 'VITE_FIREBASE_API_KEY'
  | 'VITE_FIREBASE_AUTH_DOMAIN'
  | 'VITE_FIREBASE_PROJECT_ID'
  | 'VITE_FIREBASE_STORAGE_BUCKET'
  | 'VITE_FIREBASE_MESSAGING_SENDER_ID'
  | 'VITE_FIREBASE_APP_ID'

export function requirePublicEnv(name: PublicEnvName): string {
  const value = import.meta.env[name]?.trim()
  if (!value) throw new Error(`Missing required public environment variable: ${name}`)
  return value
}
