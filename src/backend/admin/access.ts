export type AdminRole = 'admin' | 'super_admin'
export type AdminAccess =
  | { status: 'allowed'; userId: string; role: AdminRole }
  | { status: 'denied' | 'unauthenticated' | 'error' }

export interface RoleSource {
  getUserId(): Promise<string | null>
  getMyRole(): Promise<unknown>
}

// Called only with the real Supabase adapter in the application. No cached role,
// user metadata or caller-supplied role participates in this decision.
export async function resolveAdminAccess(source: RoleSource, expectedUserId: string): Promise<AdminAccess> {
  try {
    const userId = await source.getUserId()
    if (!userId) return { status: 'unauthenticated' }
    if (userId !== expectedUserId) return { status: 'denied' }
    const role = await source.getMyRole()
    // A token/user switch during the RPC must not authorize the preceding user.
    if (await source.getUserId() !== userId) return { status: 'denied' }
    if (role !== 'admin' && role !== 'super_admin') return { status: 'denied' }
    return { status: 'allowed', userId, role }
  } catch {
    return { status: 'error' }
  }
}
