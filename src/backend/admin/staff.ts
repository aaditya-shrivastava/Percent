import { supabase } from '../client'
import { getAdminAccess } from './role'

export type StaffRole = 'admin' | 'super_admin'
export type AssignableRole = StaffRole | 'customer'

export interface StaffMember {
  id: string
  display_name: string | null
  email: string | null
  role: StaffRole
  created_at: string
  updated_at: string
  is_current: boolean
}

export interface StaffListResult {
  items: StaffMember[]
  count: number
  admin_count: number
  super_admin_count: number
  can_manage_roles: boolean
}

export class StaffServiceError extends Error {
  constructor(public readonly kind: 'conflict' | 'denied' | 'invalid' | 'unavailable') {
    super(kind)
    this.name = 'StaffServiceError'
  }
}

const unavailable = () => new StaffServiceError('unavailable')

async function assertAdmin(userId: string) {
  const access = await getAdminAccess(userId)
  if (access.status !== 'allowed') throw new StaffServiceError(access.status === 'denied' ? 'denied' : 'unavailable')
}

const isStaffRole = (value: unknown): value is StaffRole => value === 'admin' || value === 'super_admin'

function normalizeResult(value: unknown): StaffListResult {
  if (!value || typeof value !== 'object') throw unavailable()
  const record = value as Record<string, unknown>
  if (!Array.isArray(record.items)) throw unavailable()
  const items = record.items.map(item => {
    if (!item || typeof item !== 'object') throw unavailable()
    const row = item as Record<string, unknown>
    if (typeof row.id !== 'string' || !isStaffRole(row.role) || typeof row.created_at !== 'string' || typeof row.updated_at !== 'string' || typeof row.is_current !== 'boolean') throw unavailable()
    return {
      id: row.id,
      display_name: typeof row.display_name === 'string' ? row.display_name : null,
      email: typeof row.email === 'string' ? row.email : null,
      role: row.role,
      created_at: row.created_at,
      updated_at: row.updated_at,
      is_current: row.is_current,
    }
  })
  const number = (field: string) => typeof record[field] === 'number' ? record[field] : 0
  return { items, count: number('count'), admin_count: number('admin_count'), super_admin_count: number('super_admin_count'), can_manage_roles: record.can_manage_roles === true }
}

export async function listAdminStaff(userId: string, search: string, role: 'all' | StaffRole, signal: AbortSignal) {
  await assertAdmin(userId)
  const { data, error } = await supabase.rpc('admin_list_staff', {
    search_text: search.trim().slice(0, 120) || undefined,
    role_filter: role,
  }).abortSignal(signal)
  if (error) throw new StaffServiceError(error.code === '42501' ? 'denied' : 'unavailable')
  return normalizeResult(data)
}

export async function setAdminStaffRole(userId: string, member: StaffMember, role: AssignableRole) {
  await assertAdmin(userId)
  const { data, error } = await supabase.rpc('admin_set_staff_role', {
    target_user_id: member.id,
    new_role: role,
    expected_updated_at: member.updated_at,
  })
  if (error) {
    if (error.code === 'PT409') throw new StaffServiceError('conflict')
    if (error.code === '42501') throw new StaffServiceError('denied')
    if (error.code === '22023' || error.code === 'P0002') throw new StaffServiceError('invalid')
    throw unavailable()
  }
  return data
}
