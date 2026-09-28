import { supabase } from '../client'
import { getPercentSessionSnapshot } from '../percentSession'
import { resolveAdminAccess } from './access'

export const getAdminAccess = (expectedUserId: string) => resolveAdminAccess({
  async getUserId() {
    const session = getPercentSessionSnapshot()
    return session.authenticated ? session.percentUserId : null
  },
  async getMyRole() {
    const { data, error } = await supabase.rpc('get_my_role')
    if (error) throw error
    return data
  },
}, expectedUserId)
