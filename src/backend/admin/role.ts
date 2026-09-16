import { supabase } from '../client'
import { resolveAdminAccess } from './access'

export const getAdminAccess = (expectedUserId: string) => resolveAdminAccess({
  async getUserId() {
    const { data, error } = await supabase.auth.getUser()
    if (error) throw error
    return data.user?.id ?? null
  },
  async getMyRole() {
    const { data, error } = await supabase.rpc('get_my_role')
    if (error) throw error
    return data
  },
}, expectedUserId)
