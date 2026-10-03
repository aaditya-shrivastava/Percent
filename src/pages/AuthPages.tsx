import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { FirebaseError } from 'firebase/app'
import { confirmPasswordReset, createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, updateProfile } from 'firebase/auth'
import { Eye, EyeOff } from 'lucide-react'
import { GoogleIcon } from '../components/common/GoogleIcon'
import { firebaseAuth, googleAuthProvider } from '../backend/firebase'
import { ensureFirebaseAuthenticatedClaim } from '../backend/firebaseSession'
import { checkUsernameAvailability, finalizeUsernameRegistration, recoverUsernameRegistration, releaseUsernameRegistration, requestUsernamePasswordRecovery, reserveUsernameRegistration, resolveUsernameLogin, sendContactEmailVerification, usernameAuthEnabled } from '../backend/usernameAuth'
import { authRouteWithReturnTo, getSafeAuthReturnTo } from '../data/auth'
import { usePercentSession } from '../hooks/usePercentSession'
import { completeCustomerSignupName } from '../backend/percentSession'
import { parseCustomerName } from '../backend/customerName'

const authErrorMessage=(error:unknown)=>{
 if(!(error instanceof FirebaseError))return error instanceof Error?error.message:'Unable to complete your request.'
 const messages:Record<string,string>={
  'auth/invalid-credential':'Invalid username/email or password.',
  'auth/email-already-in-use':'An account already exists for this email.',
  'auth/weak-password':'Choose a stronger password with at least 8 characters.',
  'auth/popup-closed-by-user':'Google sign-in was cancelled.',
  'auth/popup-blocked':'Allow pop-ups to continue with Google.',
  'auth/network-request-failed':'Check your connection and try again.',
  'auth/account-exists-with-different-credential':'Sign in with the method already connected to this email.',
  'auth/expired-action-code':'This password reset link has expired.',
  'auth/invalid-action-code':'This password reset link is invalid or was already used.',
  'auth/too-many-requests':'Too many attempts. Please wait and try again.',
 }
 return messages[error.code]??'Unable to complete your request.'
}

function PasswordField({label,value,onChange,autoComplete,invalid,describedBy}:{label:string;value:string;onChange:(value:string)=>void;autoComplete:'current-password'|'new-password';invalid:boolean;describedBy?:string}){
 const [visible,setVisible]=useState(false)
 return <label className="auth-field">{label}<div className="auth-input-control auth-password-control"><input required minLength={autoComplete==='current-password'?1:8} type={visible?'text':'password'} autoComplete={autoComplete} value={value} onChange={event=>onChange(event.target.value)} aria-invalid={invalid} aria-describedby={describedBy}/><button type="button" onClick={()=>setVisible(current=>!current)} aria-label={visible?'Hide password':'Show password'}>{visible?<EyeOff aria-hidden="true"/>:<Eye aria-hidden="true"/>}</button></div></label>
}

function AuthPage({mode}:{mode:'login'|'register'|'recover'|'reset'}) {
 const {isAuthenticated,loading,refreshSession}=usePercentSession()
 const location=useLocation()
 const returnTo=getSafeAuthReturnTo(new URLSearchParams(location.search).get('returnTo'))
 const heading=useRef<HTMLHeadingElement>(null)
 useEffect(()=>{heading.current?.focus()},[mode])
 const [email,setEmail]=useState(''),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[confirm,setConfirm]=useState('')
 const [availability,setAvailability]=useState<'idle'|'checking'|'available'|'unavailable'>('idle')
 const [agreed,setAgreed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
 const title={login:'Sign In',register:'Join Percent',recover:'Forgot Password',reset:'Set New Password'}[mode]
 if(!busy&&!loading&&isAuthenticated && (mode==='login'||mode==='register'&&!error))return <Navigate to={returnTo} replace />
 const submit=async(event:FormEvent)=>{
  event.preventDefault();setError('');setMessage('');setBusy(true)
  try {
   if(mode==='register'&&(!agreed||(!usernameAuthEnabled&&!name.trim())))throw new Error(usernameAuthEnabled?'Accept the terms to continue.':'Enter your name and accept the terms.')
   if((mode==='register'||mode==='reset')&&password!==confirm)throw new Error('Passwords do not match.')
   if(mode==='login'){
    const identifier=email.trim()
    if(!usernameAuthEnabled)await signInWithEmailAndPassword(firebaseAuth,identifier,password)
    else if(identifier.includes('@')){
     try{await signInWithEmailAndPassword(firebaseAuth,identifier,password)}catch(first){
      if(!(first instanceof FirebaseError)||first.code!=='auth/invalid-credential')throw first
      const {login_alias}=await resolveUsernameLogin(identifier)
      await signInWithEmailAndPassword(firebaseAuth,login_alias,password)
     }
    }else{
     if(!/^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$/.test(identifier.toLowerCase())||/[._][._]/.test(identifier))throw new Error('Invalid username/email or password.')
     const {login_alias}=await resolveUsernameLogin(identifier)
     await signInWithEmailAndPassword(firebaseAuth,login_alias,password)
    }
    await refreshSession()
   }
   if(mode==='register'){
    if(usernameAuthEnabled){
     const canonical=username.trim().toLowerCase()
     if(!/^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$/.test(canonical)||/[._][._]/.test(canonical))throw new Error('Choose a valid username with 3–24 letters, numbers, periods, or underscores.')
     const available=await checkUsernameAvailability(canonical)
     if(!available.available)throw new Error('That username is unavailable.')
     const reservation=await reserveUsernameRegistration(canonical,email.trim())
     let firebaseCreated=false
     try{
      await createUserWithEmailAndPassword(firebaseAuth,reservation.login_alias,password);firebaseCreated=true
      const token=await ensureFirebaseAuthenticatedClaim()
      sessionStorage.setItem('percent-username-registration',JSON.stringify({reservation_id:reservation.reservation_id,reservation_token:reservation.reservation_token,expires_at:reservation.expires_at}))
      try{await finalizeUsernameRegistration(reservation,token)}catch{
       const recovered=await recoverUsernameRegistration(token)
       await finalizeUsernameRegistration(recovered,token)
      }
      sessionStorage.removeItem('percent-username-registration')
      await refreshSession()
      await sendContactEmailVerification(token).then(()=>setMessage('Account created. Check your email to verify account recovery.')).catch(()=>setMessage('Account created. Verify your email later to enable account recovery.'))
     }catch(registrationError){
      if(!firebaseCreated)await releaseUsernameRegistration(reservation).catch(()=>undefined)
      else setMessage('Your sign-in was created, but account setup needs to be retried. Do not create another account.')
      throw registrationError
     }
    }else{
     const parsedName=parseCustomerName(name)
     if(!parsedName)throw new Error('Enter a full name of up to 120 characters.')
     const credential=await createUserWithEmailAndPassword(firebaseAuth,email.trim(),password)
     await updateProfile(credential.user,{displayName:parsedName.display_name})
     await completeCustomerSignupName(parsedName.display_name)
    }
    setMessage('Your Percent account is ready.')
   }
   if(mode==='recover'){if(usernameAuthEnabled)await requestUsernamePasswordRecovery(email.trim());else await sendPasswordResetEmail(firebaseAuth,email.trim(),{url:`${window.location.origin}/login`});setMessage('If an account exists, recovery instructions will be sent.')}
   if(mode==='reset'){const code=new URLSearchParams(location.search).get('oobCode');if(!code)throw new Error('This password reset link is invalid.');await confirmPasswordReset(firebaseAuth,code,password);setMessage('Password updated. You can sign in with your new password.')}
  }catch(e){setError(mode==='login'&&usernameAuthEnabled?'Invalid username/email or password.':authErrorMessage(e))}finally{setBusy(false)}
 }
 const googleSignIn=async()=>{setError('');setMessage('');setBusy(true);try{await signInWithPopup(firebaseAuth,googleAuthProvider);await refreshSession()}catch(e){setError(authErrorMessage(e))}finally{setBusy(false)}}
 return <main className="auth-page"><section className="auth-visual"><div className="auth-visual-image" style={{backgroundImage:`url(/images/auth-${mode==='register'?'register':'login'}.png)`}}/><div className="auth-visual-overlay"><p>% Percent</p><h2>Less Ordinary.<br/>More You.</h2></div></section><section className="auth-panel"><div className="auth-panel-inner"><header><p>Percent Account</p><h1 ref={heading} tabIndex={-1}>{title}</h1></header><form className="auth-form" onSubmit={submit}>
 {mode==='register'&&!usernameAuthEnabled&&<label className="auth-field">Full Name<div className="auth-input-control"><input required autoComplete="name" value={name} onChange={e=>setName(e.target.value)} aria-invalid={Boolean(error)} aria-describedby="auth-error"/></div></label>}
 {mode==='register'&&usernameAuthEnabled&&<label className="auth-field">Username<div className="auth-input-control"><input required autoComplete="username" value={username} aria-invalid={availability==='unavailable'} aria-describedby="username-status" onChange={e=>{setUsername(e.target.value);setAvailability('idle')}} onBlur={async()=>{const value=username.trim().toLowerCase();if(!value)return;setAvailability('checking');try{setAvailability((await checkUsernameAvailability(value)).available?'available':'unavailable')}catch{setAvailability('unavailable')}}}/></div><small id="username-status">{availability==='checking'?'Checking…':availability==='available'?'Username available.':availability==='unavailable'?'Username unavailable.':'3–24 lowercase letters, numbers, periods, or underscores.'}</small></label>}
 {mode!=='reset'&&<label className="auth-field">{mode==='login'&&usernameAuthEnabled?'Username or Email':'Email'}<div className="auth-input-control"><input required type={mode==='login'&&usernameAuthEnabled?'text':'email'} autoComplete={mode==='login'?'username':'email'} value={email} onChange={e=>setEmail(e.target.value)} aria-invalid={Boolean(error)} aria-describedby="auth-error"/></div></label>}
 {mode!=='recover'&&<PasswordField label="Password" value={password} onChange={setPassword} autoComplete={mode==='login'?'current-password':'new-password'} invalid={Boolean(error)} describedBy="auth-error"/>}
 {(mode==='register'||mode==='reset')&&<PasswordField label="Confirm Password" value={confirm} onChange={setConfirm} autoComplete="new-password" invalid={Boolean(error)} describedBy="auth-error"/>}
 {mode==='register'&&<label className="auth-terms"><input required type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/><span>I agree to the <Link to="/policies/terms">Terms and Conditions</Link> and <Link to="/policies/privacy">Privacy Policy</Link>.</span></label>}
 {error&&<p id="auth-error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
 <button className="auth-primary-button" disabled={busy||loading}>{busy?'Please wait…':title}</button>
 </form>{(mode==='login'||mode==='register')&&<><div className="auth-divider">Or</div><button className="auth-google-button" type="button" disabled={busy||loading} onClick={googleSignIn}><span className="auth-google-icon" aria-hidden="true"><GoogleIcon /></span><span className="auth-google-label">Continue with Google</span></button></>}<p className="auth-switch"><Link to={authRouteWithReturnTo('/login',returnTo)}>Sign In</Link> · <Link to={authRouteWithReturnTo('/register',returnTo)}>Create Account</Link> · <Link to={authRouteWithReturnTo('/forgot-password',returnTo)}>Forgot Password?</Link></p>{mode==='reset'&&<Link to="/login">Return to Sign In</Link>}</div></section></main>
}
export const LoginPage=()=> <AuthPage mode="login"/>
export const RegisterPage=()=> <AuthPage mode="register"/>
export const ForgotPasswordPage=()=> <AuthPage mode="recover"/>
export const ResetPasswordPage=()=> <AuthPage mode="reset"/>
