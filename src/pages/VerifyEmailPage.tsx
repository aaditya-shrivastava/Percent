import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { verifyContactEmail } from '../backend/usernameAuth'

type VerificationState='verifying'|'success'|'invalid'|'error'

export function VerifyEmailPage(){
 const location=useLocation()
 const token=new URLSearchParams(location.search).get('token')??''
 const tokenValid=/^[A-Za-z0-9_-]{43}$/.test(token)
 const [state,setState]=useState<VerificationState>(tokenValid?'verifying':'invalid')
 useEffect(()=>{
  window.history.replaceState({},'',location.pathname)
  if(!tokenValid)return
  void verifyContactEmail(token).then(result=>setState(result.verified?'success':'invalid')).catch(error=>{
   setState(error instanceof Error&&/invalid|expired/i.test(error.message)?'invalid':'error')
  })
 },[location.pathname,token,tokenValid])
 const copy={verifying:['Verifying your email…','Please keep this page open.'],success:['Email verified successfully.','Your contact email can now be used for secure account recovery.'],invalid:['This verification link is invalid or expired.','Request a new verification email from your account.'],error:["We couldn't verify this email right now.",'Please try again.']}[state]
 return <main className="auth-status-page"><section role="status" aria-live="polite"><p>Percent Account</p><h1>{copy[0]}</h1><span>{copy[1]}</span>{state!=='verifying'&&<Link to="/profile">Continue</Link>}</section></main>
}
