import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials } from '@/lib/avatar-initials'
import { DASHBOARD_BASE } from './SidebarNav'

type SidebarFooterProps = {
  onNavigate?: () => void
}

export default function SidebarFooter({ onNavigate }: SidebarFooterProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="border-t border-outline-variant/20 p-4">
      <NavLink
        to={`${DASHBOARD_BASE}/profile`}
        onClick={() => onNavigate?.()}
        className={({ isActive }) =>
          `flex min-h-11 items-center gap-3 rounded-lg p-2 transition-colors ${
            isActive ? 'bg-surface-container-high' : 'hover:bg-surface-container-high/70'
          }`
        }
      >
        <Avatar size="sm" className="shrink-0 ring-1 ring-outline-variant/15">
          {user?.avatar_url ? <AvatarImage src={user.avatar_url} alt="" /> : null}
          <AvatarFallback delay={0}>{getInitials(user?.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="truncate text-xs font-bold">{user?.name ?? 'User'}</p>
          <p className="truncate text-[10px] text-on-surface-variant">
            {user?.role === 'owner' ? 'Owner' : user?.role === 'admin' ? 'Admin' : 'Karyawan'}
          </p>
        </div>
      </NavLink>
      <button
        type="button"
        onClick={() => {
          onNavigate?.()
          void logout().then(() => navigate('/login'))
        }}
        className="mt-1 w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-on-surface-variant hover:bg-surface-container-high"
      >
        Keluar
      </button>
    </div>
  )
}
