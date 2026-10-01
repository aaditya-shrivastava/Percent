import { useEffect, useRef, useState } from 'react'
import { RefreshCw, Search, ShieldCheck, UserCog, Users, X } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import type { AdminIdentity } from '../../components/admin/AdminRouteGuard'
import { AdminEmptyState, AdminPageHeader, AdminStatCard, AdminStatusBadge } from '../../components/admin/AdminComponents'
import { listAdminStaff, setAdminStaffRole, StaffServiceError, type AssignableRole, type StaffListResult, type StaffMember, type StaffRole } from '../../backend/admin/staff'
import './admin-users-settings.css'

const formatDate = (value: string) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value))
const title = (member: StaffMember) => member.display_name?.trim() || member.email?.trim() || 'Percent staff member'
const initials = (member: StaffMember) => title(member).split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()

function RoleDialog({ member, onClose, onSaved }: { member: StaffMember; onClose: () => void; onSaved: () => void }) {
  const { user } = useOutletContext<AdminIdentity>()
  const dialog = useRef<HTMLDialogElement>(null)
  const [role, setRole] = useState<AssignableRole>(member.role)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [conflict, setConflict] = useState(false)
  useEffect(() => { dialog.current?.showModal() }, [])
  const close = () => { dialog.current?.close(); onClose() }
  const save = async () => {
    if (role === member.role) { close(); return }
    setBusy(true); setMessage(''); setConflict(false)
    try { await setAdminStaffRole(user.id, member, role); onSaved(); close() }
    catch (error) {
      if (error instanceof StaffServiceError && error.kind === 'conflict') { setConflict(true); setMessage('This staff role changed after the page loaded. Reload the latest staff list before trying again.') }
      else if (error instanceof StaffServiceError && error.kind === 'denied') setMessage('Only a current Super Admin may change staff roles.')
      else if (error instanceof StaffServiceError && error.kind === 'invalid') setMessage('This role change is no longer valid. The final Super Admin and your own role remain protected.')
      else setMessage('The role could not be updated. No change was applied.')
    } finally { setBusy(false) }
  }
  return <dialog ref={dialog} className="staff-role-dialog" aria-labelledby="staff-role-title" onCancel={event => { event.preventDefault(); if (!busy) close() }}>
    <form method="dialog" onSubmit={event => { event.preventDefault(); void save() }}>
      <header><div><span>Staff access</span><h2 id="staff-role-title">Change role for {title(member)}</h2></div><button type="button" onClick={close} disabled={busy} aria-label="Close role dialog"><X/></button></header>
      <p>Role authority is stored in the private Percent role system. Authentication credentials and Firebase identities are not changed here.</p>
      <label htmlFor="staff-role">Role<select id="staff-role" value={role} onChange={event => setRole(event.target.value as AssignableRole)} disabled={busy}><option value="admin">Admin</option><option value="super_admin">Super Admin</option><option value="customer">Remove Admin access</option></select></label>
      {role === 'super_admin' && member.role !== 'super_admin' && <p className="staff-role-warning">Super Admin grants authority to manage other staff roles.</p>}
      {role === 'customer' && <p className="staff-role-warning">This removes access to every Admin route. It does not delete the account.</p>}
      {message && <p className="staff-role-error" role="alert">{message}</p>}
      <footer><button type="button" className="admin-button" onClick={close} disabled={busy}>Cancel</button><button className="admin-button staff-primary" disabled={busy || conflict || role === member.role}>{busy ? 'Updating…' : 'Confirm role'}</button></footer>
    </form>
  </dialog>
}

function StaffCards({ items, canManage, onEdit }: { items: StaffMember[]; canManage: boolean; onEdit: (member: StaffMember) => void }) {
  return <div className="staff-cards">{items.map(member => <article key={member.id}><header><span className="staff-avatar" aria-hidden="true">{initials(member)}</span><div><strong>{title(member)}</strong><small>{member.email || 'No verified contact email'}</small></div>{member.is_current && <span className="staff-current">You</span>}</header><dl><div><dt>Role</dt><dd><AdminStatusBadge status={member.role}/></dd></div><div><dt>Joined</dt><dd>{formatDate(member.created_at)}</dd></div><div><dt>Role updated</dt><dd>{formatDate(member.updated_at)}</dd></div></dl>{canManage && !member.is_current ? <button className="admin-button" onClick={() => onEdit(member)}>Edit role</button> : <small className="staff-protection">{member.is_current ? 'Your own role is protected.' : 'Role changes require Super Admin.'}</small>}</article>)}</div>
}

export function AdminUsers() {
  const identity = useOutletContext<AdminIdentity>()
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [role, setRole] = useState<'all' | StaffRole>('all')
  const [revision, setRevision] = useState(0)
  const requestKey = JSON.stringify([identity.user.id, appliedSearch, role, revision])
  const [response, setResponse] = useState<{ key: string; data: StaffListResult }>()
  const [errorKey, setErrorKey] = useState('')
  const [selected, setSelected] = useState<StaffMember>()
  useEffect(() => { const timer = window.setTimeout(() => setAppliedSearch(search.trim()), 250); return () => window.clearTimeout(timer) }, [search])
  useEffect(() => {
    const controller = new AbortController()
    const [userId, query, selectedRole] = JSON.parse(requestKey) as [string, string, 'all' | StaffRole, number]
    void listAdminStaff(userId, query, selectedRole, controller.signal).then(data => { if (!controller.signal.aborted) { setResponse({ key: requestKey, data }); setErrorKey('') } }).catch(() => { if (!controller.signal.aborted) setErrorKey(requestKey) })
    return () => controller.abort()
  }, [requestKey])
  const result = response?.key === requestKey ? response.data : undefined
  const error = errorKey === requestKey
  const refresh = () => { setSelected(undefined); setErrorKey(''); setRevision(value => value + 1) }
  const filters: Array<['all' | StaffRole, string]> = [['all', 'All'], ['admin', 'Admin'], ['super_admin', 'Super Admin']]
  return <><AdminPageHeader title="Admin Users" description="Review staff access and manage roles through Percent’s private authorization system."/>
    <div className="admin-stats staff-stats"><AdminStatCard label="Staff Accounts" value={String(result?.count ?? 0)} note="Admins and Super Admins only" icon={Users}/><AdminStatCard label="Admins" value={String(result?.admin_count ?? 0)} note="Operational Admin access" icon={UserCog}/><AdminStatCard label="Super Admins" value={String(result?.super_admin_count ?? 0)} note="Protected role managers" icon={ShieldCheck}/></div>
    <section className="admin-panel staff-list"><header><div><h2>Staff Directory</h2><p>Customer accounts are excluded. No authentication credentials are exposed.</p></div><button className="admin-icon-button" aria-label="Refresh staff" onClick={refresh}><RefreshCw/></button></header>
      <div className="staff-toolbar"><label className="staff-search"><Search/><span className="sr-only">Search staff</span><input value={search} onChange={event => setSearch(event.target.value)} aria-label="Search staff by name or email" placeholder="Search name or contact email…"/></label><div className="staff-filters" role="group" aria-label="Filter staff by role">{filters.map(([value, label]) => <button key={value} type="button" aria-pressed={role === value} onClick={() => setRole(value)}>{label}</button>)}</div></div>
      {!result && !error ? <div className="admin-loading" aria-busy="true"><p role="status">Loading staff…</p></div> : error ? <div className="staff-state" role="alert"><AdminEmptyState icon={UserCog} title="Unable to load staff." description="The protected staff service did not return a usable response."/><button className="admin-button" onClick={refresh}>Retry</button></div> : result && !result.items.length ? <AdminEmptyState icon={Search} title="No matching staff." description="Try another search or role filter."/> : result && <><div className="staff-table" role="region" aria-label="Staff accounts" tabIndex={0}><table><thead><tr><th scope="col">Staff member</th><th scope="col">Role</th><th scope="col">Joined</th><th scope="col">Role updated</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{result.items.map(member => <tr key={member.id}><td><div className="staff-identity"><span className="staff-avatar" aria-hidden="true">{initials(member)}</span><div><strong>{title(member)} {member.is_current && <span className="staff-current">You</span>}</strong><small>{member.email || 'No verified contact email'}</small></div></div></td><td><AdminStatusBadge status={member.role}/></td><td>{formatDate(member.created_at)}</td><td>{formatDate(member.updated_at)}</td><td>{result.can_manage_roles && !member.is_current ? <button className="admin-button" onClick={() => setSelected(member)}>Edit role</button> : <span className="staff-protection">{member.is_current ? 'Protected' : 'View only'}</span>}</td></tr>)}</tbody></table></div><StaffCards items={result.items} canManage={result.can_manage_roles} onEdit={setSelected}/><footer><span>{result.count} staff account{result.count === 1 ? '' : 's'}</span><span>{result.can_manage_roles ? 'Super Admin role management enabled' : 'Staff roles are view only'}</span></footer></>}
    </section>{selected && <RoleDialog member={selected} onClose={() => setSelected(undefined)} onSaved={refresh}/>}</>
}
