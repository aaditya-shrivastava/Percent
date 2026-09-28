import { supabasePublishableKey, supabaseUrl } from './supabaseConfig'

export const usernameAuthEnabled = import.meta.env.VITE_PERCENT_USERNAME_AUTH_ENABLED === 'true'
const endpoint = `${supabaseUrl}/functions/v1/percent-username-auth`

type Reservation = { reservation_id:string; reservation_token:string; login_alias:string; expires_at:string }

async function invoke<T>(body:Record<string,unknown>, token?:string):Promise<T>{
 const response=await fetch(endpoint,{method:'POST',headers:{apikey:supabasePublishableKey,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)})
 const data=await response.json().catch(()=>({})) as Record<string,unknown>
 if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'Unable to complete username request.')
 return data as T
}
export const checkUsernameAvailability=(username:string)=>invoke<{available:boolean}>({action:'check-availability',username})
export const resolveUsernameLogin=(identifier:string)=>invoke<{login_alias:string}>({action:'resolve-login',identifier})
export const reserveUsernameRegistration=(username:string,contactEmail:string)=>invoke<Reservation>({action:'reserve-registration',username,contact_email:contactEmail})
export const releaseUsernameRegistration=(reservation:Pick<Reservation,'reservation_id'|'reservation_token'>)=>invoke<{ok:true}>({action:'release-registration',...reservation})
export const finalizeUsernameRegistration=(reservation:Pick<Reservation,'reservation_id'|'reservation_token'>,firebaseToken:string)=>invoke<{ok:true}>({action:'finalize-registration',...reservation},firebaseToken)
export const recoverUsernameRegistration=(firebaseToken:string)=>invoke<Pick<Reservation,'reservation_id'|'reservation_token'|'expires_at'>>({action:'recover-registration'},firebaseToken)
export const sendContactEmailVerification=(firebaseToken:string)=>invoke<{ok:true}>({action:'send-verification'},firebaseToken)
export const verifyContactEmail=(token:string)=>invoke<{verified:boolean}>({action:'verify-contact-email',token})
export const requestUsernamePasswordRecovery=(identifier:string)=>invoke<{ok:true}>({action:'request-password-recovery',identifier})
