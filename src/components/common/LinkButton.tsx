import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export function LinkButton({ to, children, dark = false }: { to: string; children: React.ReactNode; dark?: boolean }) { return <Link className={`button ${dark ? 'button--dark' : ''}`} to={to}>{children}<ArrowUpRight size={17} /></Link> }
