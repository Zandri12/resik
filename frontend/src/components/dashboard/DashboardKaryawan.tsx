import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { Link } from 'react-router-dom'
import { memo, useMemo, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { OrderCreatorDisplay, type OrderCreator } from '@/components/order/OrderCreatorDisplay'

export type KaryawanOrderRow = {
  id: number
  order_number: string
  total: number
  created_at?: string
  customer?: { name: string }
  status?: { name: string }
  items?: { quantity: number; service_package?: { name: string } }[]
  created_by?: OrderCreator | null
}

type DashboardData = {
  orders_count: number
  pending_orders?: number
  delivered_orders?: number
  orders_by_status?: { name: string; count: number }[]
}

const STATUS_LABEL: Record<string, string> = {
  diterima: 'Diterima',
  diproses: 'Diproses',
  selesai: 'Selesai',
  batal: 'Batal',
  diambil: 'Selesai',
  siap_diambil: 'Siap diambil',
  setrika: 'Diproses',
  cuci: 'Diproses',
}

const STATUS_CLASS: Record<string, string> = {
  diterima: 'bg-palette-cream text-on-surface',
  diproses: 'bg-palette-sky text-on-surface',
  selesai: 'bg-palette-purple text-on-surface',
  batal: 'bg-palette-lavender/50 text-on-surface border border-palette-purple/35',
  cuci: 'bg-palette-sky text-on-surface',
  setrika: 'bg-palette-sky text-on-surface',
  siap_diambil: 'bg-palette-purple/80 text-on-surface',
  diambil: 'bg-palette-purple text-on-surface',
}

const TERMINAL_STATUS = new Set(['selesai', 'diambil', 'batal'])

function SummaryStatCard({
  icon,
  iconWrapperClassName,
  label,
  value,
  valueClassName = 'text-on-surface',
}: {
  icon: string
  iconWrapperClassName: string
  label: string
  value: ReactNode
  valueClassName?: string
}) {
  return (
    <div className="bg-surface-container-lowest p-6 rounded-xl border border-transparent shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${iconWrapperClassName}`}>
          <span className="material-symbols-outlined">{icon}</span>
        </div>
      </div>
      <div>
        <p className="text-on-surface-variant text-sm font-medium">{label}</p>
        <h3 className={`font-headline font-extrabold text-2xl mt-1 tabular-nums ${valueClassName}`}>{value}</h3>
      </div>
    </div>
  )
}

function getServiceLabel(order: KaryawanOrderRow): string {
  const items = order.items ?? []
  if (items.length === 0) return '-'
  const first = items[0]
  const name = first.service_package?.name ?? 'Layanan'
  const qty = first.quantity
  return `${name} - ${qty}kg`
}

function formatWaktuOrder(iso?: string): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return format(d, 'd MMM yyyy, HH:mm', { locale: id })
  } catch {
    return '—'
  }
}

type OrderStatusOpt = { id: number; name: string; sort_order?: number }

type Props = {
  name: string
  data: DashboardData
  recentOrders: KaryawanOrderRow[]
  workQueue: KaryawanOrderRow[]
  orderStatuses: OrderStatusOpt[]
  refreshing: boolean
  todayIso: string
  onRefresh: () => void
}

function DashboardKaryawanInner({
  name,
  data,
  recentOrders,
  workQueue,
  orderStatuses,
  refreshing,
  todayIso,
  onRefresh,
}: Props) {
  const pendingOps = data.pending_orders ?? 0
  const deliveredToday = data.delivered_orders ?? 0

  const statusByName = useMemo(() => {
    const m = new Map<string, OrderStatusOpt>()
    for (const s of orderStatuses) m.set(s.name, s)
    return m
  }, [orderStatuses])

  const sortedStatusChips = useMemo(() => {
    return [...orderStatuses].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  }, [orderStatuses])

  const ordersListHref = `/dashboard/orders?from=${todayIso}&to=${todayIso}`

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider mb-1 text-secondary">Dashboard karyawan</p>
          <h1 className="font-headline font-extrabold text-3xl text-on-surface tracking-tight">Halo, {name}</h1>
          <p className="text-on-surface-variant mt-1 font-body">
            Fokus ke order hari ini — status dan antrian kerja Anda.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-2.5 text-sm font-bold text-on-surface hover:bg-surface-container-high disabled:opacity-60"
          >
            <span className={cn('material-symbols-outlined text-lg', refreshing && 'animate-spin')}>refresh</span>
            {refreshing ? 'Memuat…' : 'Segarkan'}
          </button>
          <Link
            to="/dashboard/orders"
            className="inline-flex items-center gap-2 rounded-xl bg-surface-container-low px-5 py-2.5 text-sm font-bold text-primary hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined text-sm">list_alt</span>
            Semua order
          </Link>
          <Link
            to="/dashboard/orders/new"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-container px-6 py-2.5 text-sm font-bold text-on-primary shadow-lg shadow-primary/10 hover:opacity-90"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Buat order baru
          </Link>
        </div>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link
          to={ordersListHref}
          className="shrink-0 rounded-full border border-outline-variant/35 bg-surface-container-low px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container-high"
        >
          Order hari ini
        </Link>
        <Link
          to="/dashboard/orders"
          className="shrink-0 rounded-full border border-outline-variant/35 bg-surface-container-low px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container-high"
        >
          Semua antrian
        </Link>
        {sortedStatusChips.map((s) => (
          <Link
            key={s.id}
            to={`/dashboard/orders?status_id=${s.id}`}
            className="shrink-0 rounded-full border border-outline-variant/25 bg-surface-container-lowest px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low"
          >
            {STATUS_LABEL[s.name] ?? s.name}
          </Link>
        ))}
      </div>

      <div className="mb-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <SummaryStatCard
          icon="inventory_2"
          iconWrapperClassName="bg-primary/5 text-primary"
          label="Laundry masuk hari ini"
          value={data.orders_count}
        />
        <SummaryStatCard
          icon="pending_actions"
          iconWrapperClassName="bg-secondary/10 text-secondary"
          label="Masih diproses / antrian"
          value={pendingOps}
        />
        <SummaryStatCard
          icon="check_circle"
          iconWrapperClassName="bg-tertiary/5 text-tertiary"
          label="Selesai hari ini"
          value={deliveredToday}
        />
      </div>

      <div className="mb-10 rounded-xl bg-surface-container-lowest p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-headline text-lg font-bold">Antrian kerja (hari ini)</h2>
          <Link to={ordersListHref} className="text-sm font-bold text-primary hover:underline">
            Lihat semua
          </Link>
        </div>
        <p className="mb-4 text-xs text-on-surface-variant">
          Order masuk hari ini yang belum selesai, dibatalkan, atau diambil.
        </p>
        {workQueue.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Tidak ada antrian aktif untuk hari ini.</p>
        ) : (
          <ul className="divide-y divide-outline-variant/10">
            {workQueue.slice(0, 10).map((o) => (
              <li
                key={o.id}
                className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link to={`/dashboard/orders/${o.id}`} className="font-bold text-on-surface hover:text-primary">
                      {o.customer?.name ?? '—'}
                    </Link>
                    <span className="text-on-surface-variant/50 hidden sm:inline">·</span>
                    <OrderCreatorDisplay creator={o.created_by} compact className="max-w-56" />
                  </div>
                  <p className="text-xs text-on-surface-variant">
                    #{o.order_number} · {getServiceLabel(o)}
                  </p>
                  <p className="text-[11px] text-on-surface-variant">{formatWaktuOrder(o.created_at)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end md:flex-row md:items-center">
                  <span
                    className={cn(
                      'rounded-full px-3 py-1 text-[10px] font-bold',
                      STATUS_CLASS[o.status?.name ?? ''] ?? 'bg-palette-cream text-on-surface-variant'
                    )}
                  >
                    {STATUS_LABEL[o.status?.name ?? ''] ?? o.status?.name ?? '—'}
                  </span>
                  <Link
                    to={`/dashboard/orders/${o.id}`}
                    className="inline-flex items-center gap-0.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/15"
                  >
                    Detail
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between p-6">
            <h2 className="font-headline text-lg font-bold">Order terbaru</h2>
            <Link to="/dashboard/orders" className="text-sm font-bold text-primary hover:underline">
              Semua order
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low/50">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                    Customer
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                    Input order
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                    Waktu
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                    Layanan
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                    Status
                  </th>
                  <th className="sr-only w-14 px-4 py-4">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-sm text-on-surface-variant">
                      Belum ada order.
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((o) => (
                    <tr key={o.id} className="transition-colors hover:bg-surface-container-low/40">
                      <td className="px-6 py-4">
                        <Link to={`/dashboard/orders/${o.id}`} className="block">
                          <p className="text-sm font-bold">{o.customer?.name ?? '-'}</p>
                          <p className="text-xs text-on-surface-variant">{o.order_number}</p>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <OrderCreatorDisplay creator={o.created_by} compact className="max-w-[160px]" />
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-xs text-on-surface-variant">
                        {formatWaktuOrder(o.created_at)}
                      </td>
                      <td className="px-6 py-4 text-sm">{getServiceLabel(o)}</td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            'rounded-full px-3 py-1 text-[10px] font-bold',
                            STATUS_CLASS[o.status?.name ?? ''] ?? 'bg-palette-cream text-on-surface-variant'
                          )}
                        >
                          {STATUS_LABEL[o.status?.name ?? ''] ?? o.status?.name ?? '-'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          to={`/dashboard/orders/${o.id}`}
                          className="inline-flex size-9 items-center justify-center rounded-lg text-primary hover:bg-primary/10"
                          aria-label={`Buka order ${o.order_number}`}
                        >
                          <span className="material-symbols-outlined text-xl">open_in_new</span>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl bg-surface-container-lowest p-6 shadow-sm">
          <h2 className="mb-6 font-headline text-lg font-bold">Status order hari ini</h2>
          <div className="space-y-3">
            {(data.orders_by_status ?? []).map((item) => {
              const key = item.name
              const label = STATUS_LABEL[key] ?? key
              const st = statusByName.get(key)
              const href =
                st != null
                  ? `${ordersListHref}&status_id=${st.id}`
                  : ordersListHref
              return (
                <Link
                  key={key}
                  to={href}
                  className="flex items-center justify-between gap-3 rounded-lg bg-surface-container-low/50 px-3 py-2 transition-colors hover:bg-surface-container-low"
                >
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 text-xs font-bold',
                      STATUS_CLASS[key] ?? 'bg-palette-cream text-on-surface-variant'
                    )}
                  >
                    {label}
                  </span>
                  <span className="flex items-center gap-1 text-sm font-bold tabular-nums text-on-surface-variant">
                    {item.count} order
                    <span className="material-symbols-outlined text-base text-on-surface-variant/70">chevron_right</span>
                  </span>
                </Link>
              )
            })}
            {(data.orders_by_status ?? []).length === 0 && (
              <p className="text-sm text-on-surface-variant">Belum ada data status hari ini.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const DashboardKaryawan = memo(DashboardKaryawanInner)
export default DashboardKaryawan
export { TERMINAL_STATUS }
