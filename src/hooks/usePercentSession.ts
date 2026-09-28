import { useEffect, useSyncExternalStore } from 'react'
import { getPercentSessionSnapshot, refreshPercentSession, signOutPercentSession, subscribeToPercentSession, updateCurrentPercentProfile, type PercentSessionUser } from '../backend/percentSession'

export type { PercentSessionUser }
export const updatePercentProfile = updateCurrentPercentProfile
export function usePercentSession() {
 const session=useSyncExternalStore(subscribeToPercentSession,getPercentSessionSnapshot)
 useEffect(()=>{ localStorage.removeItem('percent-session'); localStorage.removeItem('percent-auth-session') },[])
 return {...session,isAuthenticated:session.authenticated,logout:signOutPercentSession,refreshSession:refreshPercentSession}
}
