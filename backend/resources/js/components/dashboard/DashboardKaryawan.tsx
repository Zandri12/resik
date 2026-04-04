import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { Link } from 'react-router-dom'
import { memo, useMemo } from 'react'
import { OrderCreatorDisplay, type OrderCreator } from '@/components/order/OrderCreatorDisplay'
import { dashPanel, dashPanelHeader } from '@/components/dashboard/dashboard-card-styles'
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader'
import { DashboardPageShell } from '@/components/dashboard/DashboardPageShell'
import { DashboardStatCard } from '@/components/dashboard/DashboardStatCard'
import { MotionReveal } from '@/components/dashboard/MotionReveal'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DATA_TABLE_BODY_CELL_CLASS,
  DATA_TABLE_BODY_ROW_CLASS,
  DATA_TABLE_HEADER_CELL_CLASS,
  DATA_TABLE_HEADER_ROW_CLASS,
} from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

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
  lastUpdatedAt: Date | null
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
  lastUpdatedAt,
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
  const todayLabel = format(new Date(), 'EEEE, d MMM yyyy', { locale: id })

  return (
    <DashboardPageShell>
      <div className="mx-auto w-full min-w-0 max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          badges={
            <>
              <Badge variant="outline" className="text-xs font-medium">
                Dashboard karyawan
              </Badge>
              <Badge variant="secondary" className="gap-1.5 text-xs font-normal">
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/40 opacity-75 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                Live · {todayLabel}
              </Badge>
            </>
          }
          title={
            <>
              Halo, <span className="text-primary">{name}</span>
            </>
          }
          description={
            <>
              Fokus ke <span className="font-medium text-foreground">order hari ini</span> — status dan antrian kerja
              Anda.
            </>
          }
          meta={
            lastUpdatedAt ? (
              <p className="text-right text-xs text-muted-foreground tabular-nums">
                Terakhir diperbarui {format(lastUpdatedAt, 'd MMM yyyy, HH:mm:ss', { locale: id })}
              </p>
            ) : null
          }
          actions={
            <>
              <Button type="button" variant="outline" onClick={onRefresh} disabled={refreshing} className="gap-2">
                <span className={cn('material-symbols-outlined text-lg', refreshing && 'animate-spin')}>refresh</span>
                {refreshing ? 'Memuat…' : 'Segarkan'}
              </Button>
              <Link to="/dashboard/orders" className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}>
                <span className="material-symbols-outlined text-sm">list_alt</span>
                Semua order
              </Link>
              <Link to="/dashboard/orders/new" className={cn(buttonVariants(), 'gap-2')}>
                <span className="material-symbols-outlined text-sm">add</span>
                Buat order baru
              </Link>
            </>
          }
        />

        <div className="flex flex-wrap gap-1 overflow-x-auto rounded-lg border border-border bg-muted p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link
            to={ordersListHref}
            className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'shrink-0 rounded-md shadow-none')}
          >
            Order hari ini
          </Link>
          {sortedStatusChips.map((s) => (
            <Link
              key={s.id}
              to={`/dashboard/orders?status_id=${s.id}`}
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'shrink-0 rounded-md')}
            >
              {STATUS_LABEL[s.name] ?? s.name}
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MotionReveal index={0}>
            <DashboardStatCard
              icon="inventory_2"
              iconWrapperClassName="bg-primary/10 text-primary"
              label="Laundry masuk hari ini"
              value={data.orders_count}
            />
          </MotionReveal>
          <MotionReveal index={1}>
            <DashboardStatCard
              icon="pending_actions"
              iconWrapperClassName="bg-chart-2/15 text-chart-2"
              label="Masih diproses / antrian"
              value={pendingOps}
            />
          </MotionReveal>
          <MotionReveal index={2}>
            <DashboardStatCard
              icon="check_circle"
              iconWrapperClassName="bg-chart-3/15 text-chart-3"
              label="Selesai hari ini"
              value={deliveredToday}
            />
          </MotionReveal>
        </div>

        <Card className={dashPanel}>
          <CardHeader className={cn(dashPanelHeader, 'space-y-0')}>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base font-semibold tracking-tight">Antrian kerja (hari ini)</CardTitle>
              <CardAction>
                <Link to={ordersListHref} className={cn(buttonVariants({ variant: 'link', size: 'sm' }))}>
                  Lihat semua
                </Link>
              </CardAction>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-5 pt-4 sm:px-6">
            <p className="text-xs text-muted-foreground">
              Order masuk hari ini yang belum selesai, dibatalkan, atau diambil.
            </p>
            {workQueue.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada antrian aktif untuk hari ini.</p>
            ) : (
              <ul className="divide-y divide-border">
                {workQueue.slice(0, 10).map((o) => (
                  <li
                    key={o.id}
                    className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Link to={`/dashboard/orders/${o.id}`} className="font-semibold hover:text-primary">
                          {o.customer?.name ?? '—'}
                        </Link>
                        <span className="hidden text-muted-foreground sm:inline">·</span>
                        <OrderCreatorDisplay creator={o.created_by} compact className="max-w-56" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        #{o.order_number} · {getServiceLabel(o)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{formatWaktuOrder(o.created_at)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end md:flex-row md:items-center">
                      <Badge
                        variant="secondary"
                        className={cn(
                          'h-auto rounded-md border-0 px-3 py-1 text-[10px] font-semibold',
                          STATUS_CLASS[o.status?.name ?? ''] ?? 'bg-muted text-muted-foreground'
                        )}
                      >
                        {STATUS_LABEL[o.status?.name ?? ''] ?? o.status?.name ?? '—'}
                      </Badge>
                      <Link
                        to={`/dashboard/orders/${o.id}`}
                        className={cn(
                          buttonVariants({ variant: 'secondary', size: 'sm' }),
                          'inline-flex h-8 items-center gap-0.5 text-xs'
                        )}
                      >
                        Detail
                        <span className="material-symbols-outlined text-sm">chevron_right</span>
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className={cn(dashPanel, 'lg:col-span-2')}>
            <CardHeader
              className={cn(dashPanelHeader, 'flex flex-row items-center justify-between space-y-0')}
            >
              <CardTitle className="text-base font-semibold tracking-tight">Order terbaru</CardTitle>
              <CardAction>
                <Link to="/dashboard/orders" className={cn(buttonVariants({ variant: 'link', size: 'sm' }))}>
                  Semua order
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className={DATA_TABLE_HEADER_ROW_CLASS}>
                      <TableHead className={DATA_TABLE_HEADER_CELL_CLASS}>Customer</TableHead>
                      <TableHead className={DATA_TABLE_HEADER_CELL_CLASS}>Input order</TableHead>
                      <TableHead className={DATA_TABLE_HEADER_CELL_CLASS}>Waktu</TableHead>
                      <TableHead className={DATA_TABLE_HEADER_CELL_CLASS}>Layanan</TableHead>
                      <TableHead className={DATA_TABLE_HEADER_CELL_CLASS}>Status</TableHead>
                      <TableHead className={`${DATA_TABLE_HEADER_CELL_CLASS} w-14 sr-only`}>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentOrders.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className={`${DATA_TABLE_BODY_CELL_CLASS} py-8 text-center text-sm text-muted-foreground`}
                        >
                          Belum ada order.
                        </TableCell>
                      </TableRow>
                    ) : (
                      recentOrders.map((o) => (
                        <TableRow key={o.id} className={DATA_TABLE_BODY_ROW_CLASS}>
                          <TableCell className={DATA_TABLE_BODY_CELL_CLASS}>
                            <Link to={`/dashboard/orders/${o.id}`} className="block">
                              <p className="text-sm font-semibold">{o.customer?.name ?? '-'}</p>
                              <p className="text-xs text-muted-foreground">{o.order_number}</p>
                            </Link>
                          </TableCell>
                          <TableCell className={DATA_TABLE_BODY_CELL_CLASS}>
                            <OrderCreatorDisplay creator={o.created_by} compact className="max-w-[160px]" />
                          </TableCell>
                          <TableCell className={`${DATA_TABLE_BODY_CELL_CLASS} whitespace-nowrap text-xs text-muted-foreground`}>
                            {formatWaktuOrder(o.created_at)}
                          </TableCell>
                          <TableCell className={`${DATA_TABLE_BODY_CELL_CLASS} text-sm`}>{getServiceLabel(o)}</TableCell>
                          <TableCell className={DATA_TABLE_BODY_CELL_CLASS}>
                            <Badge
                              variant="secondary"
                              className={cn(
                                'h-auto rounded-md border-0 px-3 py-1 text-[10px] font-semibold',
                                STATUS_CLASS[o.status?.name ?? ''] ?? 'bg-muted text-muted-foreground'
                              )}
                            >
                              {STATUS_LABEL[o.status?.name ?? ''] ?? o.status?.name ?? '-'}
                            </Badge>
                          </TableCell>
                          <TableCell className={DATA_TABLE_BODY_CELL_CLASS}>
                            <Link
                              to={`/dashboard/orders/${o.id}`}
                              aria-label={`Buka order ${o.order_number}`}
                              className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'size-9')}
                            >
                              <span className="material-symbols-outlined text-xl">open_in_new</span>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className={dashPanel}>
            <CardHeader className={cn(dashPanelHeader, 'pb-3 pt-4')}>
              <CardTitle className="text-base font-semibold tracking-tight">Status order hari ini</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-5 pb-5 pt-3 sm:px-6">
              {(data.orders_by_status ?? []).map((item) => {
                const key = item.name
                const label = STATUS_LABEL[key] ?? key
                const st = statusByName.get(key)
                const href = st != null ? `${ordersListHref}&status_id=${st.id}` : ordersListHref
                return (
                  <Link
                    key={key}
                    to={href}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2 transition-colors hover:bg-muted/60"
                  >
                    <Badge
                      variant="secondary"
                      className={cn(
                        'h-auto rounded-md border-0 px-2.5 py-1 text-xs font-semibold',
                        STATUS_CLASS[key] ?? 'bg-muted text-muted-foreground'
                      )}
                    >
                      {label}
                    </Badge>
                    <span className="flex items-center gap-1 text-sm font-medium tabular-nums text-muted-foreground">
                      {item.count} order
                      <span className="material-symbols-outlined text-base opacity-70">chevron_right</span>
                    </span>
                  </Link>
                )
              })}
              {(data.orders_by_status ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Belum ada data status hari ini.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardPageShell>
  )
}

const DashboardKaryawan = memo(DashboardKaryawanInner)
export default DashboardKaryawan
export { TERMINAL_STATUS }
