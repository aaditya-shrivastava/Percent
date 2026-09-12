import { useCallback, useEffect, useState } from 'react'

export interface PercentSessionUser {
  id: string
  displayName: string
  firstName?: string
  lastName?: string
  phone?: string
  email?: string
  memberSince?: string
  isDemo?: boolean
}

const sessionKeys = ['percent-session', 'percent-auth-session']
const primarySessionKey = sessionKeys[0]
const sessionChangedEvent = 'percent:session-changed'

export const demoPercentUser: PercentSessionUser = {
  id: 'percent-demo-user',
  displayName: 'User Name',
  firstName: 'User',
  lastName: 'Name',
  phone: '+91 98765 43210',
  email: 'user@email.com',
  memberSince: 'Mar 2026',
  isDemo: true,
}

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
      const firstName = asText(user?.firstName) ?? asText(user?.first_name) ?? asText(metadata?.first_name)
      const lastName = asText(user?.lastName) ?? asText(user?.last_name) ?? asText(metadata?.last_name)
      const displayName = asText(user?.displayName) ?? asText(user?.display_name) ?? asText(user?.name) ?? asText(metadata?.display_name) ?? asText(metadata?.full_name) ?? ([firstName, lastName].filter(Boolean).join(' ') || 'Percent Customer')
      return {
        id,
        displayName,
        firstName,
        lastName,
        phone: asText(user?.phone),
        email: asText(user?.email),
        memberSince: asText(user?.memberSince) ?? asText(user?.member_since),
        isDemo: user?.isDemo === true,
      }
    } catch {
      continue
    }
  }
  return null
}

export function usePercentSession() {
  const [user, setUser] = useState<PercentSessionUser | null>(() => readPercentSession())
  const signInDemo = useCallback(() => {
    localStorage.setItem(primarySessionKey, JSON.stringify({ user: demoPercentUser, mode: 'frontend-demo' }))
    window.dispatchEvent(new CustomEvent(sessionChangedEvent))
  }, [])
  const logout = useCallback(() => {
    sessionKeys.forEach((key) => localStorage.removeItem(key))
    window.dispatchEvent(new CustomEvent(sessionChangedEvent))
  }, [])

  useEffect(() => {
    const update = () => setUser(readPercentSession())
    window.addEventListener('storage', update)
    window.addEventListener(sessionChangedEvent, update)
    return () => {
      window.removeEventListener('storage', update)
      window.removeEventListener(sessionChangedEvent, update)
    }
  }, [])

  return { user, isAuthenticated: Boolean(user), signInDemo, logout }
}
