import {
  getIdTokenResult,
  onIdTokenChanged,
  signOut,
  type Unsubscribe,
  type User,
} from 'firebase/auth'
import { firebaseAuth } from './firebase'
import { supabasePublishableKey, supabaseUrl } from './supabaseConfig'

export type FirebaseSessionStatus = 'loading' | 'signed-out' | 'ready' | 'claim-missing' | 'error'

export interface FirebaseSessionIdentity {
  uid: string
  email: string | null
  displayName: string | null
  providerIds: string[]
  signInProvider: string | null
}

export interface FirebaseSessionSnapshot {
  status: FirebaseSessionStatus
  user: FirebaseSessionIdentity | null
  error: string | null
}

let snapshot: FirebaseSessionSnapshot = { status: 'loading', user: null, error: null }
let revision = 0
const subscribers = new Set<() => void>()

const publish = (next: FirebaseSessionSnapshot) => {
  snapshot = next
  for (const subscriber of subscribers) subscriber()
}

async function synchronizeAuthenticatedClaim(user: User) {
  let token = await getIdTokenResult(user, false)
  if (token.claims.role === 'authenticated') return token

  const response = await fetch(`${supabaseUrl}/functions/v1/firebase-auth-bridge`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.token}`,
      apikey: supabasePublishableKey,
      'Content-Type': 'application/json',
    },
    body: '{}',
  })
  if (!response.ok) throw new Error('Unable to synchronize the Firebase session claim.')

  await user.getIdToken(true)
  token = await getIdTokenResult(user, false)
  if (token.claims.role !== 'authenticated') {
    throw new Error('Firebase token is missing the authenticated role claim.')
  }
  return token
}

const identityFrom = async (user: User): Promise<FirebaseSessionSnapshot> => {
  const token = await synchronizeAuthenticatedClaim(user)
  const identity: FirebaseSessionIdentity = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    providerIds: [...new Set(user.providerData.map(provider => provider.providerId))],
    signInProvider: token.signInProvider,
  }
  if (token.claims.role !== 'authenticated') {
    return { status: 'claim-missing', user: identity, error: 'Firebase token is missing the authenticated role claim.' }
  }
  return { status: 'ready', user: identity, error: null }
}

onIdTokenChanged(firebaseAuth, user => {
  const request = ++revision
  if (!user) {
    publish({ status: 'signed-out', user: null, error: null })
    return
  }
  publish({ status: 'loading', user: null, error: null })
  void identityFrom(user)
    .then(next => { if (request === revision) publish(next) })
    .catch(() => {
      if (request === revision) publish({ status: 'error', user: null, error: 'Unable to verify the Firebase session.' })
    })
})

export const getFirebaseSessionSnapshot = () => snapshot

export const subscribeToFirebaseSession = (subscriber: () => void): Unsubscribe => {
  subscribers.add(subscriber)
  return () => subscribers.delete(subscriber)
}

export async function refreshFirebaseAuthenticatedToken(): Promise<string> {
  const user = firebaseAuth.currentUser
  if (!user) throw new Error('Firebase authentication required.')
  await user.getIdToken(true)
  const result = await getIdTokenResult(user, false)
  if (result.claims.role !== 'authenticated') {
    throw new Error('Firebase token is missing the authenticated role claim.')
  }
  return result.token
}

export async function ensureFirebaseAuthenticatedClaim(): Promise<string> {
  const user = firebaseAuth.currentUser
  if (!user) throw new Error('Firebase authentication required.')
  return (await synchronizeAuthenticatedClaim(user)).token
}

export async function getFirebaseSupabaseAccessToken(): Promise<string | null> {
  const user = firebaseAuth.currentUser
  if (!user) return null
  return (await synchronizeAuthenticatedClaim(user)).token
}

export const signOutFirebase = () => signOut(firebaseAuth)
