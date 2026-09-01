import { useEffect, useState } from 'react'

export interface PercentSessionUser {
  id: string
  displayName: string
}

const sessionKeys = ['percent-session', 'percent-auth-session']

const asRecord = (value: unknown): Record<string, unknown> | undefined => value && typeof value === 'object' ? value as Record<string, unknown> : undefined
const asText = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : undefined

function readPercentSession(): PercentSessionUser | null {
  for (const key of sessionKeys) {
    try {
      const stored = localStorage.getItem(key)
      if (!stored) continue
      const envelope = asRecord(JSON.parse(stored))
      const nestedSession = asRecord(envelope?.session)
      const user = asRecord(envelope?.user) ?? asRecord(nestedSession?.user) ?? envelope
      const id = asText(user?.id) ?? asText(user?.userId) ?? asText(user?.email)
      if (!id) continue
      const metadata = asRecord(user?.user_metadata) ?? asRecord(user?.metadata)
      const displayName = asText(user?.displayName) ?? asText(user?.display_name) ?? asText(user?.name) ?? asText(metadata?.display_name) ?? asText(metadata?.full_name) ?? 'Percent Customer'
      return { id, displayName }
    } catch {
      continue
    }
  }
  return null
}

export function usePercentSession() {
  const [user, setUser] = useState<PercentSessionUser | null>(() => readPercentSession())

  useEffect(() => {
    const update = () => setUser(readPercentSession())
    window.addEventListener('storage', update)
    window.addEventListener('percent:session-changed', update)
    return () => {
      window.removeEventListener('storage', update)
      window.removeEventListener('percent:session-changed', update)
    }
  }, [])

  return { user, isAuthenticated: Boolean(user) }
}
