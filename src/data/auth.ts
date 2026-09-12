const authPaths = new Set(['/login', '/register', '/forgot-password'])

export const demoPasswordMinimumLength = 6

export function isValidAuthContact(value: string) {
  const contact = value.trim()
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)
  const digits = contact.replace(/\D/g, '')
  const localPhone = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits
  return isEmail || /^[6-9]\d{9}$/.test(localPhone)
}

export function getSafeAuthReturnTo(candidate: string | null | undefined, fallback = '/profile') {
  if (!candidate?.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) return fallback
  const pathname = candidate.split(/[?#]/, 1)[0]
  return authPaths.has(pathname) ? fallback : candidate
}

export function authRouteWithReturnTo(path: '/login' | '/register' | '/forgot-password', returnTo: string) {
  const safeReturnTo = getSafeAuthReturnTo(returnTo)
  return safeReturnTo === '/profile' ? path : `${path}?returnTo=${encodeURIComponent(safeReturnTo)}`
}
