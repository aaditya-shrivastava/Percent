const authPaths = new Set(['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'])
const unsafeCharacters = (value:string) => value.includes('\\') || Array.from(value).some(character=>character.charCodeAt(0)<=32||character.charCodeAt(0)===127)

export const demoPasswordMinimumLength = 6

export function isValidAuthContact(value: string) {
  const contact = value.trim()
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)
  const digits = contact.replace(/\D/g, '')
  const localPhone = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits
  return isEmail || /^[6-9]\d{9}$/.test(localPhone)
}

function safeInternalPath(candidate: string | null | undefined): string | null {
  if (!candidate?.startsWith('/') || candidate.startsWith('//') || unsafeCharacters(candidate)) return null
  try {
    decodeURIComponent(candidate)
    let pathname = candidate.split(/[?#]/, 1)[0]
    for (let layer = 0; layer < 5; layer++) {
      const decoded = decodeURIComponent(pathname)
      if (decoded === pathname) break
      pathname = decoded
    }
    if (pathname.includes('%') || pathname.startsWith('//') || unsafeCharacters(pathname)) return null
    const origin = 'https://percent.invalid'
    const normalized = new URL(pathname, origin)
    if (normalized.origin !== origin || normalized.pathname.startsWith('//') || authPaths.has(normalized.pathname.replace(/\/+$/, '').toLowerCase() || '/')) return null
    const destination = new URL(candidate, origin)
    if (destination.origin !== origin || destination.pathname.startsWith('//')) return null
    return destination.pathname + destination.search + destination.hash
  } catch { return null }
}

export function getSafeAuthReturnTo(candidate: string | null | undefined, fallback = '/profile') {
  return safeInternalPath(candidate) ?? safeInternalPath(fallback) ?? '/profile'
}

export function authRouteWithReturnTo(path: '/login' | '/register' | '/forgot-password', returnTo: string) {
  const safeReturnTo = getSafeAuthReturnTo(returnTo)
  return `${path}?returnTo=${encodeURIComponent(safeReturnTo)}`
}
