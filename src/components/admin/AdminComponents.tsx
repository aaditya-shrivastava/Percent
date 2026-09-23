import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export function AdminPageHeader({title,description,children}:{title:string;description:string;children?:ReactNode}) {
  return <header className="admin-page-header"><div><h1>{title}</h1><p>{description}</p></div><div className="admin-header-right"><p>Your brand. Your rules.<br/>Clean. Minimal. Complete.</p>{children}</div></header>
}
export function AdminEmptyState({icon:Icon,title,description}:{icon:LucideIcon;title:string;description?:string}) {
  return <div className="admin-empty"><span className="admin-empty-icon"><Icon aria-hidden="true"/></span><h3>{title}</h3>{description&&<p>{description}</p>}</div>
}
export function AdminStatusBadge({status}:{status:string}) {
  const tone=['active','approved','paid','completed','delivered'].includes(status)?'success':['pending','processing','Run Near Limit','Low Stock'].includes(status)?'warning':['rejected','cancelled','Sold Out','failed'].includes(status)?'danger':'neutral'
  return <span className={`admin-badge is-${tone}`}>{status.replaceAll('_',' ')}</span>
}
export function AdminStatCard({label,value,note,icon:Icon}:{label:string;value:string;note:string;icon:LucideIcon}) {
  return <section className="admin-stat"><span className="admin-stat-icon"><Icon aria-hidden="true"/></span><div><h2>{label}</h2><strong>{value}</strong><p>{note}</p></div></section>
}
