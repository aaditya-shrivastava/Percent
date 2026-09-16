import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { supabase, checkError } from '../backend/client'
import { getSafeAuthReturnTo } from '../data/auth'
import { usePercentSession } from '../hooks/usePercentSession'

function AuthPage({mode}:{mode:'login'|'register'|'recover'|'reset'}) {
 const {isAuthenticated,loading}=usePercentSession()
 const location=useLocation()
 const returnTo=getSafeAuthReturnTo(new URLSearchParams(location.search).get('returnTo'))
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[confirm,setConfirm]=useState('')
 const [agreed,setAgreed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
 const title={login:'Sign In',register:'Join Percent',recover:'Forgot Password',reset:'Set New Password'}[mode]
 if(isAuthenticated && (mode==='login'||mode==='register'))return <Navigate to={returnTo} replace />
 const submit=async(event:FormEvent)=>{
  event.preventDefault();setError('');setMessage('');setBusy(true)
  try {
   if(mode==='register'&&(!agreed||!name.trim()))throw new Error('Enter your name and accept the terms.')
   if((mode==='register'||mode==='reset')&&password!==confirm)throw new Error('Passwords do not match.')
   if(mode==='login'){const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});checkError(error)}
   if(mode==='register'){
    const {data,error}=await supabase.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:window.location.origin+'/profile',data:{display_name:name.trim()}}});checkError(error)
    if(data.session){const {error}=await supabase.from('profiles').update({display_name:name.trim()}).eq('id',data.user!.id);checkError(error)}
    setMessage('Check your email to confirm your account before signing in.')
   }
   if(mode==='recover'){const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin+'/reset-password'});checkError(error);setMessage('If an account exists, a recovery link will be sent to its email address.')}
   if(mode==='reset'){const {error}=await supabase.auth.updateUser({password});checkError(error);setMessage('Password updated. You can return to your account.')}
  }catch(e){setError(e instanceof Error?e.message:'Unable to complete your request.')}finally{setBusy(false)}
 }
 return <main className="auth-page"><section className="auth-visual"><div className="auth-visual-image" style={{backgroundImage:`url(/images/auth-${mode==='register'?'register':'login'}.png)`}}/><div className="auth-visual-overlay"><p>% Percent</p><h2>Less Ordinary.<br/>More You.</h2></div></section><section className="auth-panel"><div className="auth-panel-inner"><header><p>Percent Account</p><h1>{title}</h1></header><form className="auth-form" onSubmit={submit}>
 {mode==='register'&&<label className="auth-field">Full Name<input required autoComplete="name" value={name} onChange={e=>setName(e.target.value)}/></label>}
 {mode!=='reset'&&<label className="auth-field">Email<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>}
 {mode!=='recover'&&<label className="auth-field">Password<input required minLength={mode==='login'?1:8} type="password" autoComplete={mode==='login'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)}/></label>}
 {(mode==='register'||mode==='reset')&&<label className="auth-field">Confirm Password<input required type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>}
 {mode==='register'&&<label className="auth-terms"><input required type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/>I agree to the <Link to="/policies/terms">Terms</Link> and <Link to="/policies/privacy">Privacy Policy</Link>.</label>}
 {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
 <button className="auth-primary-button" disabled={busy||loading}>{busy?'Please wait…':title}</button>
 </form><p className="auth-switch"><Link to="/login">Sign In</Link> · <Link to="/register">Create Account</Link> · <Link to="/forgot-password">Forgot Password?</Link></p>{mode==='reset'&&<Link to="/profile">Return to Account</Link>}</div></section></main>
}
export const LoginPage=()=> <AuthPage mode="login"/>
export const RegisterPage=()=> <AuthPage mode="register"/>
export const ForgotPasswordPage=()=> <AuthPage mode="recover"/>
export const ResetPasswordPage=()=> <AuthPage mode="reset"/>
