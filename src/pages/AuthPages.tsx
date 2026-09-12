import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { authRouteWithReturnTo, demoPasswordMinimumLength, getSafeAuthReturnTo, isValidAuthContact } from '../data/auth'
import { usePercentSession } from '../hooks/usePercentSession'

const authImages = {
  login: {
    src: '/images/auth-login.png',
    alt: 'Two contrasting Percent streetwear looks in a neutral architectural studio',
  },
  register: {
    src: '/images/auth-register.png',
    alt: 'A Percent customer exploring a curated monochrome clothing collection',
  },
}

type AuthAction = 'form' | 'google' | null

function GoogleIcon() {
  return <svg className="auth-google-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.7 12.2c0-.7-.1-1.3-.2-1.9H12v3.5h4.9a4.2 4.2 0 0 1-1.8 2.7v2.3H18c1.7-1.6 2.7-3.9 2.7-6.6Z" fill="currentColor" /><path d="M12 21c2.4 0 4.4-.8 5.9-2.2l-2.8-2.3c-.8.5-1.8.9-3.1.9-2.3 0-4.3-1.6-5-3.7H4.1V16A8.9 8.9 0 0 0 12 21Z" fill="currentColor" opacity=".78" /><path d="M7 13.7a5.4 5.4 0 0 1 0-3.4V8H4.1a9 9 0 0 0 0 8L7 13.7Z" fill="currentColor" opacity=".55" /><path d="M12 6.6c1.4 0 2.6.5 3.5 1.4l2.6-2.6A8.8 8.8 0 0 0 4.1 8L7 10.3a5.3 5.3 0 0 1 5-3.7Z" fill="currentColor" opacity=".9" /></svg>
}

function AuthShell({ eyebrow, title, description, image, children }: { eyebrow: string; title: string; description: string; image: typeof authImages.login; children: ReactNode }) {
  return <main className="auth-page">
    <section className="auth-visual" aria-label="Percent brand story"><div className="auth-visual-image" role="img" aria-label={image.alt} style={{ backgroundImage: `url(${image.src})` }} /><div className="auth-visual-overlay"><p>% Percent</p><h2>Less Ordinary.<br />More You.</h2><span>Limited pieces. Personal stories.</span></div></section>
    <section className="auth-panel"><div className="auth-panel-inner"><header><p>{eyebrow}</p><h1>{title}</h1><span>{description}</span></header>{children}<small className="auth-demo-note">Frontend demo access only. No real account lookup or authentication service is connected.</small></div></section>
  </main>
}

function PasswordField({ id, label, value, error, onChange }: { id: string; label: string; value: string; error?: string; onChange: (value: string) => void }) {
  const [visible, setVisible] = useState(false)
  return <div className="auth-field"><label htmlFor={id}>{label}</label><div className="auth-password-field"><LockKeyhole aria-hidden="true" /><input id={id} type={visible ? 'text' : 'password'} autoComplete={id.startsWith('register-') ? 'new-password' : 'current-password'} value={value} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => onChange(event.target.value)} /><button type="button" aria-label={`${visible ? 'Hide' : 'Show'} ${label.replace(' *', '').toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible((current) => !current)}>{visible ? <EyeOff /> : <Eye />}</button></div>{error && <small id={`${id}-error`} role="alert">{error}</small>}</div>
}

function ContactField({ id, label, value, error, onChange }: { id: string; label: string; value: string; error?: string; onChange: (value: string) => void }) {
  return <div className="auth-field"><label htmlFor={id}>{label}</label><div><Mail aria-hidden="true" /><input id={id} type="text" autoComplete="username" placeholder="Email or +91 98765 43210" value={value} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => onChange(event.target.value)} /></div>{error && <small id={`${id}-error`} role="alert">{error}</small>}</div>
}

function AuthDivider() { return <div className="auth-divider"><span>Or Continue With</span></div> }

function GoogleButton({ loading, disabled, onClick }: { loading: boolean; disabled: boolean; onClick: () => void }) {
  return <button className="auth-google-button" type="button" disabled={disabled} onClick={onClick}><GoogleIcon />{loading ? 'Continuing…' : 'Continue with Google'}</button>
}

function useAuthPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const session = usePercentSession()
  const returnTo = getSafeAuthReturnTo(new URLSearchParams(location.search).get('returnTo'))
  const authenticate = async (setAction: (action: AuthAction) => void, action: Exclude<AuthAction, null>) => {
    setAction(action)
    await new Promise((resolve) => window.setTimeout(resolve, 420))
    session.signInDemo()
    navigate(returnTo, { replace: true })
  }
  return { ...session, returnTo, authenticate }
}

export function LoginPage() {
  const { isAuthenticated, returnTo, authenticate } = useAuthPage()
  const [contact, setContact] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [action, setAction] = useState<AuthAction>(null)

  useEffect(() => { const previousTitle = document.title; document.title = 'Sign In | Percent'; return () => { document.title = previousTitle } }, [])
  if (isAuthenticated) return <Navigate to={returnTo} replace />

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (action) return
    const nextErrors: Record<string, string> = {}
    if (!isValidAuthContact(contact)) nextErrors.contact = 'Please enter a valid phone number or email.'
    if (!password) nextErrors.password = 'Please enter your password.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    await authenticate(setAction, 'form')
  }

  return <AuthShell eyebrow="Welcome Back" title="Sign In" description="Access your Percent account and continue your journey with us." image={authImages.login}>
    <form className="auth-form" onSubmit={submit} noValidate><ContactField id="login-contact" label="Phone Number or Email" value={contact} error={errors.contact} onChange={(value) => { setContact(value); setErrors((current) => ({ ...current, contact: '' })) }} /><PasswordField id="login-password" label="Password" value={password} error={errors.password} onChange={(value) => { setPassword(value); setErrors((current) => ({ ...current, password: '' })) }} /><Link className="auth-forgot-link" to={authRouteWithReturnTo('/forgot-password', returnTo)}>Forgot Password?</Link><button className="auth-primary-button" type="submit" disabled={Boolean(action)}>{action === 'form' ? 'Signing In…' : <>Sign In <ArrowRight /></>}</button></form>
    <AuthDivider /><GoogleButton loading={action === 'google'} disabled={Boolean(action)} onClick={() => authenticate(setAction, 'google')} />
    <p className="auth-switch">New to Percent? <Link to={authRouteWithReturnTo('/register', returnTo)}>Create Account</Link></p>
  </AuthShell>
}

export function RegisterPage() {
  const { isAuthenticated, returnTo, authenticate } = useAuthPage()
  const [fullName, setFullName] = useState('')
  const [contact, setContact] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [action, setAction] = useState<AuthAction>(null)

  useEffect(() => { const previousTitle = document.title; document.title = 'Create Account | Percent'; return () => { document.title = previousTitle } }, [])
  if (isAuthenticated) return <Navigate to={returnTo} replace />

  const validateTerms = () => {
    if (agreed) return true
    setErrors((current) => ({ ...current, terms: 'Please accept the Terms & Conditions and Privacy Policy.' }))
    return false
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (action) return
    const nextErrors: Record<string, string> = {}
    if (!fullName.trim()) nextErrors.fullName = 'Please enter your full name.'
    if (!isValidAuthContact(contact)) nextErrors.contact = 'Please enter a valid phone number or email.'
    if (password.length < demoPasswordMinimumLength) nextErrors.password = `Use at least ${demoPasswordMinimumLength} characters.`
    if (confirmPassword !== password) nextErrors.confirmPassword = 'Passwords do not match.'
    if (!agreed) nextErrors.terms = 'Please accept the Terms & Conditions and Privacy Policy.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    await authenticate(setAction, 'form')
  }
  const continueWithGoogle = async () => {
    if (action || !validateTerms()) return
    await authenticate(setAction, 'google')
  }

  return <AuthShell eyebrow="Create Account" title="Join Percent" description="Create an account to shop, save your favorites and access your account." image={authImages.register}>
    <form className="auth-form" onSubmit={submit} noValidate><div className="auth-field"><label htmlFor="register-name">Full Name *</label><div><input id="register-name" type="text" autoComplete="name" value={fullName} aria-invalid={Boolean(errors.fullName)} aria-describedby={errors.fullName ? 'register-name-error' : undefined} onChange={(event) => { setFullName(event.target.value); setErrors((current) => ({ ...current, fullName: '' })) }} /></div>{errors.fullName && <small id="register-name-error" role="alert">{errors.fullName}</small>}</div><ContactField id="register-contact" label="Email or Phone Number *" value={contact} error={errors.contact} onChange={(value) => { setContact(value); setErrors((current) => ({ ...current, contact: '' })) }} /><PasswordField id="register-password" label="Password *" value={password} error={errors.password} onChange={(value) => { setPassword(value); setErrors((current) => ({ ...current, password: '' })) }} /><PasswordField id="register-confirm-password" label="Confirm Password *" value={confirmPassword} error={errors.confirmPassword} onChange={(value) => { setConfirmPassword(value); setErrors((current) => ({ ...current, confirmPassword: '' })) }} /><div className="auth-terms"><input id="register-terms" type="checkbox" checked={agreed} aria-invalid={Boolean(errors.terms)} aria-describedby={errors.terms ? 'register-terms-error' : undefined} onChange={(event) => { setAgreed(event.target.checked); setErrors((current) => ({ ...current, terms: '' })) }} /><label htmlFor="register-terms">I agree to the <Link to="/policies/terms">Terms &amp; Conditions</Link> and <Link to="/policies/privacy">Privacy Policy</Link>.</label>{errors.terms && <small id="register-terms-error" role="alert">{errors.terms}</small>}</div><button className="auth-primary-button" type="submit" disabled={Boolean(action)}>{action === 'form' ? 'Creating Account…' : <>Create Account <ArrowRight /></>}</button></form>
    <AuthDivider /><GoogleButton loading={action === 'google'} disabled={Boolean(action)} onClick={continueWithGoogle} />
    <p className="auth-switch">Already have an account? <Link to={authRouteWithReturnTo('/login', returnTo)}>Sign In</Link></p>
  </AuthShell>
}

export function ForgotPasswordPage() {
  const { isAuthenticated, returnTo } = useAuthPage()
  const [contact, setContact] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => { const previousTitle = document.title; document.title = 'Forgot Password | Percent'; return () => { document.title = previousTitle } }, [])
  if (isAuthenticated) return <Navigate to={returnTo} replace />

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return
    if (!isValidAuthContact(contact)) { setError('Please enter a valid phone number or email.'); return }
    setError('')
    setLoading(true)
    await new Promise((resolve) => window.setTimeout(resolve, 420))
    setLoading(false)
    setReady(true)
  }

  return <AuthShell eyebrow="Account Access" title="Forgot Password" description="Enter the email address or phone number associated with your Percent account." image={authImages.login}>
    {ready ? <section className="auth-recovery-ready" aria-live="polite"><span><Check /></span><p>Account Recovery</p><h2>Reset Request Ready</h2><p>Password recovery will be available once account services are connected.</p><button type="button" onClick={() => { setReady(false); setContact('') }}>Use Another Email or Phone</button></section> : <form className="auth-form auth-recovery-form" onSubmit={submit} noValidate><ContactField id="recovery-contact" label="Email or Phone Number" value={contact} error={error} onChange={(value) => { setContact(value); setError('') }} /><button className="auth-primary-button" type="submit" disabled={loading}>{loading ? 'Preparing…' : <>Continue <ArrowRight /></>}</button></form>}
    <Link className="auth-back-link" to={authRouteWithReturnTo('/login', returnTo)}><ArrowLeft /> Back to Sign In</Link>
    <div className="auth-privacy-note"><ShieldCheck /><span>No reset email, OTP, or real account request is created in this frontend demo.</span></div>
  </AuthShell>
}
