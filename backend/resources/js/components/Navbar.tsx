import { useLocation } from 'react-router-dom'
import ClickSpark from './ClickSpark'
import { NavbarSearchCommand } from './NavbarSearchCommand'

const DASHBOARD_BASE = '/dashboard'
const TITLE_BY_PATH: Record<string, string> = {
  [DASHBOARD_BASE]: 'Dashboard',
  [`${DASHBOARD_BASE}/orders`]: 'Orders',
  [`${DASHBOARD_BASE}/orders/new`]: 'Buat Order',
  [`${DASHBOARD_BASE}/layanan`]: 'Layanan & Harga',
  [`${DASHBOARD_BASE}/konten-landing`]: 'Konten landing',
  [`${DASHBOARD_BASE}/expenses`]: 'Expenses',
  [`${DASHBOARD_BASE}/kinerja-karyawan`]: 'Kinerja Karyawan',
  [`${DASHBOARD_BASE}/customers`]: 'Customers',
  [`${DASHBOARD_BASE}/settings`]: 'Settings',
  [`${DASHBOARD_BASE}/profile`]: 'Profil',
  [`${DASHBOARD_BASE}/users`]: 'Manajemen User',
  [`${DASHBOARD_BASE}/users/new`]: 'Tambah User',
}

const SEARCH_PLACEHOLDER_BY_PATH: Record<string, string> = {
  [`${DASHBOARD_BASE}/orders`]: 'Cari nomor order atau pelanggan...',
  [`${DASHBOARD_BASE}/orders/new`]: 'Cari order atau pelanggan...',
  [`${DASHBOARD_BASE}/customers`]: 'Cari nama atau telepon pelanggan...',
}

export function getPageTitle(pathname: string): string {
  if (pathname.startsWith(`${DASHBOARD_BASE}/orders/`) && pathname !== `${DASHBOARD_BASE}/orders/new`) {
    return pathname.endsWith('/new') ? 'Buat Order' : 'Detail Order'
  }
  if (pathname.startsWith(`${DASHBOARD_BASE}/customers/`)) return pathname.endsWith('/new') ? 'Pelanggan Baru' : 'Edit Pelanggan'
  if (
    pathname.startsWith(`${DASHBOARD_BASE}/users/`) &&
    pathname !== `${DASHBOARD_BASE}/users/new`
  ) {
    return 'Edit User'
  }
  return TITLE_BY_PATH[pathname] ?? 'Dashboard'
}

export function getBreadcrumb(pathname: string): string[] | null {
  if (pathname === DASHBOARD_BASE || pathname === `${DASHBOARD_BASE}/`) return ['Beranda', 'Dashboard']
  if (pathname === `${DASHBOARD_BASE}/orders`) return ['Order', 'Daftar Order']
  if (pathname === `${DASHBOARD_BASE}/orders/new`) return ['Order', 'Buat Order']
  if (pathname.match(new RegExp(`^${DASHBOARD_BASE}/orders/[^/]+/print$`))) return ['Order', 'Cetak Struk']
  if (pathname.match(new RegExp(`^${DASHBOARD_BASE}/orders/[^/]+$`))) return ['Order', 'Detail Order']
  if (pathname === `${DASHBOARD_BASE}/customers`) return ['Pelanggan', 'Daftar Pelanggan']
  if (pathname === `${DASHBOARD_BASE}/customers/new`) return ['Pelanggan', 'Tambah Pelanggan Baru']
  if (pathname.match(new RegExp(`^${DASHBOARD_BASE}/customers/[^/]+$`))) return ['Pelanggan', 'Edit Pelanggan']
  if (pathname === `${DASHBOARD_BASE}/layanan`) return ['Layanan', 'Kelola Harga']
  if (pathname === `${DASHBOARD_BASE}/konten-landing`) return ['Marketing', 'Konten landing']
  if (pathname === `${DASHBOARD_BASE}/expenses`) return ['Pengeluaran', 'Daftar Pengeluaran']
  if (pathname === `${DASHBOARD_BASE}/settings`) return ['Pengaturan', 'Settings']
  if (pathname === `${DASHBOARD_BASE}/profile`) return ['Akun', 'Profil']
  return null
}

type NavbarProps = {
  searchPlaceholder?: string
  onOpenMobileNav?: () => void
}

export default function Navbar({ searchPlaceholder, onOpenMobileNav }: NavbarProps) {
  const { pathname } = useLocation()
  const pageTitle = getPageTitle(pathname)
  const breadcrumb = getBreadcrumb(pathname)
  const placeholder = searchPlaceholder ?? SEARCH_PLACEHOLDER_BY_PATH[pathname] ?? 'Cari transaksi...'

  return (
    <header className="pt-safe-header sticky top-0 z-10 border-b border-outline-variant/10 bg-surface-bright/80 backdrop-blur-md">
      <ClickSpark
        sparkColor="#005160"
        sparkSize={10}
        sparkRadius={15}
        sparkCount={8}
        duration={400}
        className="flex w-full min-w-0 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 lg:px-10"
      >
        <div className="flex min-w-0 items-center gap-2">
          {onOpenMobileNav ? (
            <button
              type="button"
              onClick={onOpenMobileNav}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-on-surface hover:bg-surface-container-high md:hidden"
              aria-label="Buka menu navigasi"
            >
              <span className="material-symbols-outlined" aria-hidden>
                menu
              </span>
            </button>
          ) : null}
          <div className="min-w-0 flex-1 text-sm font-medium text-on-surface-variant">
            {breadcrumb ? (
              <div className="flex min-w-0 items-center gap-1">
                <span className="shrink-0">{breadcrumb[0]}</span>
                <span className="material-symbols-outlined shrink-0 text-sm">chevron_right</span>
                <span className="truncate font-semibold text-on-surface">{breadcrumb[1]}</span>
              </div>
            ) : (
              <h2 className="font-headline truncate text-lg font-extrabold text-primary sm:text-xl">{pageTitle}</h2>
            )}
          </div>
        </div>
        <div className="w-full min-w-0 shrink-0 sm:w-auto sm:max-w-md">
          <NavbarSearchCommand placeholder={placeholder} />
        </div>
      </ClickSpark>
    </header>
  )
}
