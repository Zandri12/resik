import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export const DASHBOARD_BASE = '/dashboard'

export const SIDEBAR_NAV_ITEMS = [
  { to: DASHBOARD_BASE, icon: 'grid_view', label: 'Dashboard', permission: 'dashboard' },
  { to: `${DASHBOARD_BASE}/orders`, icon: 'shopping_basket', label: 'Orders', permission: 'orders' },
  { to: `${DASHBOARD_BASE}/layanan`, icon: 'dry_cleaning', label: 'Layanan', permission: 'layanan' },
  { to: `${DASHBOARD_BASE}/konten-landing`, icon: 'campaign', label: 'Konten landing', permission: 'landing_content' },
  { to: `${DASHBOARD_BASE}/expenses`, icon: 'payments', label: 'Expenses', permission: 'expenses' },
  { to: `${DASHBOARD_BASE}/reports`, icon: 'summarize', label: 'Rekapan', permission: 'reports' },
  {
    to: `${DASHBOARD_BASE}/kinerja-karyawan`,
    icon: 'trending_up',
    label: 'Kinerja Karyawan',
    permission: 'employee_performance',
  },
  { to: `${DASHBOARD_BASE}/customers`, icon: 'group', label: 'Customers', permission: 'customers' },
  { to: `${DASHBOARD_BASE}/settings`, icon: 'settings', label: 'Settings', permission: 'settings' },
  { to: `${DASHBOARD_BASE}/users`, icon: 'manage_accounts', label: 'Users', permission: 'users' },
] as const

export function canAccess(permissions: Record<string, boolean> | undefined, permission: string): boolean {
  if (!permissions) return true
  return permissions[permission] !== false
}

type SidebarNavLinksProps = {
  /** Panggil saat navigasi (mis. tutup drawer mobile) */
  onNavigate?: () => void
}

export function SidebarNavLinks({ onNavigate }: SidebarNavLinksProps) {
  const { user } = useAuth()
  const permissions = user?.permissions ?? {}
  const navItems = SIDEBAR_NAV_ITEMS.filter((item) => canAccess(permissions, item.permission))

  return (
    <div className="space-y-1">
      {navItems.map(({ to, icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === DASHBOARD_BASE}
          onClick={() => onNavigate?.()}
          className={({ isActive }) =>
            `flex min-h-11 items-center gap-3 px-4 py-3 text-sm font-medium transition-colors rounded-lg ${
              isActive ? 'sidebar-active bg-primary/5' : 'text-on-surface-variant hover:bg-surface-container-high'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span
                className="material-symbols-outlined shrink-0"
                style={{ fontVariationSettings: isActive ? "'FILL' 1" : undefined }}
              >
                {icon}
              </span>
              {label}
            </>
          )}
        </NavLink>
      ))}
    </div>
  )
}

export function SidebarBrand() {
  const { user } = useAuth()
  return (
    <div className="flex items-center gap-3 p-6">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
        <span className="material-symbols-outlined">waves</span>
      </div>
      <div className="min-w-0">
        <h1 className="font-headline text-lg font-bold leading-tight text-primary">Resik Laundry</h1>
        <p className="text-xs font-medium text-on-surface-variant">
          {user?.role === 'owner' ? 'Owner Portal' : user?.role === 'admin' ? 'Admin Portal' : 'Portal Karyawan'}
        </p>
      </div>
    </div>
  )
}
