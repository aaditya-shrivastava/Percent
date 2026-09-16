import { useEffect, useSyncExternalStore } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, checkError } from '../backend/client'

export interface PercentSessionUser { id: string; displayName: string; firstName?: string; lastName?: string; phone?: string; email?: string; memberSince?: string; isDemo?: boolean }
let current: PercentSessionUser | null = null
let loading = true
let version = 0
const listeners = new Set<() => void>()
const emit = () => { for (const listener of listeners) listener() }
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
async function refresh(user: User | null) {
 const request = ++version
 // Token refresh and repeated SIGNED_IN events for the same account must not
 // unmount an editor and discard unsaved work. Identity changes still fail closed.
 if (!user || current?.id !== user.id) { current = null; loading = true; emit() }
 if (user) {
  const {data,error} = await supabase.from('profiles').select('*').eq('id',user.id).single()
  if (request !== version) return
  if (!error && data) {
   const next = { id:user.id, displayName:data.display_name, firstName:data.first_name, lastName:data.last_name, phone:data.phone, email:user.email, memberSince:new Intl.DateTimeFormat('en-IN',{month:'short',year:'numeric'}).format(new Date(data.created_at)) }
   if (JSON.stringify(next) !== JSON.stringify(current)) current = next
  } else current = null
 }
 if (request !== version) return
 loading = false; emit()
}
supabase.auth.onAuthStateChange((_event, session) => { window.setTimeout(() => { void refresh(session?.user ?? null) },0) })
void supabase.auth.getUser().then(({data})=>refresh(data.user))
export async function updatePercentProfile(profile: {firstName:string;lastName:string;phone:string}) {
 if (!current) throw new Error('Please sign in.')
 const {error} = await supabase.from('profiles').update({first_name:profile.firstName,last_name:profile.lastName,display_name:`${profile.firstName} ${profile.lastName}`.trim(),phone:profile.phone}).eq('id',current.id)
 checkError(error)
 const {data} = await supabase.auth.getUser(); await refresh(data.user)
}
export function usePercentSession() {
 const user = useSyncExternalStore(subscribe,()=>current)
 const pending = useSyncExternalStore(subscribe,()=>loading)
 useEffect(()=>{ localStorage.removeItem('percent-session'); localStorage.removeItem('percent-auth-session') },[])
 return {user,isAuthenticated:Boolean(user),loading:pending,logout:async()=>{ const {error}=await supabase.auth.signOut(); checkError(error); await refresh(null) }}
}
