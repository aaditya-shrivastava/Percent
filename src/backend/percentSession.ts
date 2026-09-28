import type { User as FirebaseUser } from 'firebase/auth'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { firebaseAuth } from './firebase'
import { subscribeToFirebaseSession } from './firebaseSession'
import { firebaseSupabase } from './firebaseSupabase'
import { legacySupabaseAuth } from './legacySupabaseAuth'

export type PercentRole = 'customer' | 'admin' | 'super_admin'
export interface PercentSessionUser { id:string; displayName:string; firstName?:string; lastName?:string; phone?:string; email?:string; memberSince?:string; isDemo?:boolean }
export interface PercentSessionSnapshot { loading:boolean; authenticated:boolean; firebaseUser:FirebaseUser|null; percentUserId:string|null; role:PercentRole|null; isAdmin:boolean; isSuperAdmin:boolean; user:PercentSessionUser|null; error:string|null }

const signedOut:PercentSessionSnapshot={loading:false,authenticated:false,firebaseUser:null,percentUserId:null,role:null,isAdmin:false,isSuperAdmin:false,user:null,error:null}
let snapshot:PercentSessionSnapshot={...signedOut,loading:true}
let revision=0
const subscribers=new Set<()=>void>()
const publish=(next:PercentSessionSnapshot)=>{snapshot=next;for(const subscriber of subscribers)subscriber()}
const normalizeRole=(value:unknown):PercentRole|null=>value==='customer'||value==='admin'||value==='super_admin'?value:null
const memberSince=(value:string|null|undefined)=>value?new Intl.DateTimeFormat('en-IN',{month:'short',year:'numeric'}).format(new Date(value)):undefined

async function resolveFirebaseUser(firebaseUser:FirebaseUser,request:number){
 const {data:percentUserId,error:provisionError}=await firebaseSupabase.rpc('provision_my_percent_identity')
 if(provisionError||typeof percentUserId!=='string')throw new Error(provisionError?.message??'Unable to provision the Percent identity.')
 const [{data:roleValue,error:roleError},{data:profile,error:profileError}]=await Promise.all([
  firebaseSupabase.rpc('get_my_role'),
  firebaseSupabase.from('profiles').select('id,display_name,first_name,last_name,phone,created_at').eq('id',percentUserId).single(),
 ])
 if(roleError)throw new Error(roleError.message)
 if(profileError||!profile)throw new Error(profileError?.message??'Unable to load the Percent profile.')
 const role=normalizeRole(roleValue)
 if(!role)throw new Error('The Percent account has no valid role.')
 if(request!==revision||firebaseAuth.currentUser?.uid!==firebaseUser.uid)return
 const user:PercentSessionUser={id:percentUserId,displayName:profile.display_name||firebaseUser.displayName||firebaseUser.email||'Percent Member',firstName:profile.first_name??undefined,lastName:profile.last_name??undefined,phone:profile.phone??undefined,email:firebaseUser.email??undefined,memberSince:memberSince(profile.created_at)}
 publish({loading:false,authenticated:true,firebaseUser,percentUserId,role,isAdmin:role==='admin'||role==='super_admin',isSuperAdmin:role==='super_admin',user,error:null})
}

async function resolveLegacyUser(legacyUser:SupabaseUser,request:number){
 const [{data:roleValue,error:roleError},{data:profile,error:profileError}]=await Promise.all([
  firebaseSupabase.rpc('get_my_role'),
  firebaseSupabase.from('profiles').select('id,display_name,first_name,last_name,phone,created_at').eq('id',legacyUser.id).single(),
 ])
 if(roleError)throw new Error(roleError.message)
 if(profileError||!profile)throw new Error(profileError?.message??'Unable to load the Percent profile.')
 const role=normalizeRole(roleValue)
 if(!role)throw new Error('The Percent account has no valid role.')
 if(request!==revision||firebaseAuth.currentUser)return
 const user:PercentSessionUser={id:legacyUser.id,displayName:profile.display_name||legacyUser.email||'Percent Member',firstName:profile.first_name??undefined,lastName:profile.last_name??undefined,phone:profile.phone??undefined,email:legacyUser.email,memberSince:memberSince(profile.created_at)}
 publish({loading:false,authenticated:true,firebaseUser:null,percentUserId:legacyUser.id,role,isAdmin:role==='admin'||role==='super_admin',isSuperAdmin:role==='super_admin',user,error:null})
}

export async function refreshPercentSession(){
 const request=++revision,firebaseUser=firebaseAuth.currentUser
 if(!firebaseUser){
  const {data}=await legacySupabaseAuth.auth.getSession()
  const legacyUser=data.session?.user
  if(!legacyUser){publish(signedOut);return null}
  publish({...signedOut,loading:true})
  try{await resolveLegacyUser(legacyUser,request)}catch(error){if(request===revision)publish({...signedOut,error:error instanceof Error?error.message:'Unable to verify the Percent session.'});throw error}
  return snapshot
 }
 const sameIdentity=snapshot.firebaseUser?.uid===firebaseUser.uid
 publish({...signedOut,loading:true,firebaseUser,user:sameIdentity?snapshot.user:null})
 try{await resolveFirebaseUser(firebaseUser,request)}catch(error){if(request===revision)publish({...signedOut,error:error instanceof Error?error.message:'Unable to verify the Percent session.'});throw error}
 return snapshot
}

subscribeToFirebaseSession(()=>{void refreshPercentSession().catch(()=>undefined)})
legacySupabaseAuth.auth.onAuthStateChange(()=>{window.setTimeout(()=>{void refreshPercentSession().catch(()=>undefined)},0)})
export const getPercentSessionSnapshot=()=>snapshot
export const subscribeToPercentSession=(subscriber:()=>void)=>{subscribers.add(subscriber);return()=>subscribers.delete(subscriber)}

export async function signOutPercentSession(){
 ++revision;publish(signedOut);await firebaseAuth.signOut()
 await legacySupabaseAuth.auth.signOut({scope:'local'}).catch(()=>undefined)
 localStorage.removeItem('percent-session');localStorage.removeItem('percent-auth-session')
}

export async function updateCurrentPercentProfile(profile:{firstName:string;lastName:string;phone:string}){
 const percentUserId=snapshot.percentUserId
 if(!snapshot.authenticated||!percentUserId)throw new Error('Please sign in.')
 const {error}=await firebaseSupabase.from('profiles').update({first_name:profile.firstName,last_name:profile.lastName,display_name:`${profile.firstName} ${profile.lastName}`.trim(),phone:profile.phone}).eq('id',percentUserId)
 if(error)throw new Error(error.message)
 await refreshPercentSession()
}
