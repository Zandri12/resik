import { format, differenceInDays } from 'date-fns'
import { id } from 'date-fns/locale'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
import { TooltipContent, TooltipProvider, TooltipRoot, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { DashboardKaryawanSkeleton } from '@/components/dashboard/DashboardKaryawanSkeleton'
import { DashboardNotificationStrip } from '@/components/dashboard/DashboardNotificationStrip'
import { DashboardOwnerSkeleton } from '@/components/dashboard/DashboardOwnerSkeleton'
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader'
import { DashboardPageShell } from '@/components/dashboard/DashboardPageShell'
import { DashboardSectionCard } from '@/components/dashboard/DashboardSectionCard'
import { dashPanel, dashPanelHeader } from '@/components/dashboard/dashboard-card-styles'
import { DashboardStatCard } from '@/components/dashboard/DashboardStatCard'
import { MotionReveal } from '@/components/dashboard/MotionReveal'
import { OrderCreatorDisplay, type OrderCreator } from '@/components/order/OrderCreatorDisplay'
import DashboardKaryawan, { TERMINAL_STATUS } from '../components/dashboard/DashboardKaryawan'
import DashboardRekapanSection from '../components/dashboard/DashboardRekapanSection'
import { canAccess } from '../components/SidebarNav'
import { dashboardApi, ordersApi, orderStatusesApi } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

type DashboardData = {
  orders_count: number
  gross_total: number
  income: number
  expenses: number
  profit: number
  period: string
  /** Rentang agregasi (selaras kartu, grafik kas, order terbaru). */
  range_start?: string
  range_end?: string
  pending_orders?: number
  delivered_orders?: number
  unpaid_orders?: number
  total_paid?: number
  cash_received?: number
  income_accrual?: number
  profit_accrual?: number
  receivables?: number
  orders_by_status?: { name: string; count: number }[]
  expense_budget_target?: number
  budget_remaining?: number | null
}

type TrendPoint = {
  date: string
  label: string
  orders_count: number
  income: number
  cash_received?: number
  by_status?: { name: string; count: number }[]
}

/** Satu titik untuk tren pendapatan (harian / rentang) dari weeklyTrend */
type IncomeTrendPoint = {
  date: string
  day_label: string
  orders_count: number
  income: number
  cash_received?: number
}

function trendSeriesCash(p: IncomeTrendPoint): number {
  return p.cash_received ?? p.income
}

type OrderRow = {
  id: number
  order_number: string
  total: number
  created_at?: string
  customer?: { name: string }
  status?: { name: string }
  items?: {
    quantity: number
    service_package?: { name: string }
    servicePackage?: { name: string }
  }[]
  created_by?: OrderCreator | null
}

function extractOrderRows(res: { data: unknown }): OrderRow[] {
  const body = res.data as { data?: OrderRow[] } | OrderRow[] | null | undefined
  if (Array.isArray(body)) return body
  if (body && typeof body === 'object' && Array.isArray(body.data)) return body.data
  return []
}

const STATUS_LABEL: Record<string, string> = {
  diterima: 'Diterima',
  diproses: 'Diproses',
  selesai: 'Selesai',
  batal: 'Batal',
  diambil: 'Selesai',
  siap_diambil: 'Selesai',
  setrika: 'Diproses',
  cuci: 'Diproses',
}

/** Badge status — palet lembut (sama di Order Terbaru & panel status order) */
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

const INCOME_CHART_COLOR = 'var(--primary)'

/** Warna untuk stacked bar chart order per status (Tailwind bg-*) */
const CHART_STATUS_COLORS: Record<string, string> = {
  diterima: 'bg-palette-sky',
  diproses: 'bg-palette-lavender',
  selesai: 'bg-palette-cream',
  batal: 'bg-palette-purple/80',
  cuci: 'bg-palette-lavender',
  setrika: 'bg-palette-lavender',
  siap_diambil: 'bg-palette-cream',
  diambil: 'bg-palette-cream',
}

/** Urutan status di chart (sesuai backend sort_order) */
const ORDER_STATUS_CHART_ORDER = ['diterima', 'diproses', 'selesai', 'batal'] as const

function formatRupiah(n: number) {
  const s = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(
    Math.abs(n)
  )
  return n < 0 ? `-${s}` : s
}

function formatShortRupiah(n: number) {
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(0)}jt`
  if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}k`
  return formatRupiah(n)
}

function IncomeChartTooltipBody({ point }: { point: IncomeTrendPoint }) {
  const kas = trendSeriesCash(point)
  const nota = point.income
  return (
    <div className="space-y-1">
      <p className="font-semibold text-sm text-popover-foreground">
        {point.day_label}, {point.date}
      </p>
      <p className="tabular-nums text-popover-foreground">
        Kas masuk: <strong>{formatRupiah(kas)}</strong>
      </p>
      {point.cash_received != null && Math.abs(nota - kas) > 0.01 && (
        <p className="tabular-nums text-xs text-muted-foreground">
          Nilai nota (masuk hari ini): {formatRupiah(nota)}
        </p>
      )}
      <p className="text-muted-foreground">{point.orders_count} order (nota masuk)</p>
    </div>
  )
}

function MonthlyChartTooltipBody({ point }: { point: TrendPoint }) {
  const segments = (point.by_status ?? []).filter((s) => s.count > 0)
  const kas = point.cash_received
  return (
    <div className="space-y-1.5">
      <p className="font-semibold text-sm text-popover-foreground">{point.label}</p>
      {kas != null && (
        <p className="tabular-nums text-popover-foreground">
          Kas masuk: <strong>{formatRupiah(kas)}</strong>
        </p>
      )}
      <p className="tabular-nums text-popover-foreground">
        Total: <strong>{point.orders_count}</strong> order
      </p>
      {segments.length > 0 && (
        <ul className="space-y-0.5 border-t border-border pt-1.5 mt-1.5">
          {segments.map((seg) => (
            <li key={seg.name} className="flex justify-between gap-4 text-muted-foreground">
              <span>{STATUS_LABEL[seg.name] ?? seg.name}</span>
              <span className="font-medium tabular-nums text-popover-foreground">{seg.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function getServiceLabel(order: OrderRow): string {
  const items = order.items ?? []
  if (items.length === 0) return '-'
  const first = items[0]
  const pkg = first.service_package ?? first.servicePackage
  const name = pkg?.name ?? 'Layanan'
  const qty = first.quantity
  return `${name} - ${qty}kg`
}

type ChartType = 'bar' | 'line' | 'area'
type OwnerPreset = 'today' | 'week' | 'month'

const OWNER_PRESET_LABEL: Record<OwnerPreset, string> = {
  today: 'Hari ini',
  week: 'Minggu ini',
  month: 'Bulan ini',
}

const MONTHLY_TREND_MONTHS = 12
/** Selaras dengan backend `DashboardController::MAX_CUSTOM_RANGE_DAYS`. */
const MAX_CUSTOM_RANGE_DAYS = 92

function formatDashboardRangeLabel(rs?: string, re?: string): string {
  if (!rs || !re) return '—'
  try {
    const a = new Date(`${rs}T12:00:00`)
    const b = new Date(`${re}T12:00:00`)
    if (format(a, 'yyyy-MM-dd') === format(b, 'yyyy-MM-dd')) {
      return format(a, 'd MMM yyyy', { locale: id })
    }
    return `${format(a, 'd MMM', { locale: id })} – ${format(b, 'd MMM yyyy', { locale: id })}`
  } catch {
    return `${rs} – ${re}`
  }
}

export default function Dashboard() {
  const { user } = useAuth()
  const isKaryawan = user?.role === 'karyawan'
  const [data, setData] = useState<DashboardData | null>(null)
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [incomeTrend, setIncomeTrend] = useState<IncomeTrendPoint[]>([])
  const [recentOrders, setRecentOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chartType, setChartType] = useState<ChartType>('bar')
  const [ownerPreset, setOwnerPreset] = useState<OwnerPreset>('today')
  const [ownerCustomRange, setOwnerCustomRange] = useState<{ from: Date; to: Date } | null>(null)
  const [rangePopoverOpen, setRangePopoverOpen] = useState(false)
  const [rangeDraft, setRangeDraft] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  })
  /** Mencegah popover tertutup saat klik hari pertama (fokus/outside) sebelum hari akhir dipilih. */
  const rangeSelectionIncompleteRef = useRef(false)
  const hasShownEmptyToast = useRef(false)
  const [workQueue, setWorkQueue] = useState<OrderRow[]>([])
  const [orderStatuses, setOrderStatuses] = useState<{ id: number; name: string; sort_order?: number }[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)

  function normalizeDashboardPayload(d: DashboardData | undefined): DashboardData {
    return {
      orders_count: Number(d?.orders_count ?? 0),
      gross_total: Number(d?.gross_total ?? d?.income ?? 0),
      income: Number(d?.income ?? 0),
      expenses: Number(d?.expenses ?? 0),
      profit: Number(d?.profit ?? 0),
      period: d?.period ?? 'today',
      range_start: typeof d?.range_start === 'string' ? d.range_start : undefined,
      range_end: typeof d?.range_end === 'string' ? d.range_end : undefined,
      pending_orders: d?.pending_orders != null ? Number(d.pending_orders) : undefined,
      delivered_orders: d?.delivered_orders != null ? Number(d.delivered_orders) : undefined,
      unpaid_orders: d?.unpaid_orders != null ? Number(d.unpaid_orders) : undefined,
      total_paid: d?.total_paid != null ? Number(d.total_paid) : undefined,
      cash_received: d?.cash_received != null ? Number(d.cash_received) : undefined,
      income_accrual: d?.income_accrual != null ? Number(d.income_accrual) : undefined,
      profit_accrual: d?.profit_accrual != null ? Number(d.profit_accrual) : undefined,
      receivables: d?.receivables != null ? Number(d.receivables) : undefined,
      orders_by_status: Array.isArray(d?.orders_by_status) ? d.orders_by_status : undefined,
      expense_budget_target:
        d?.expense_budget_target != null ? Number(d.expense_budget_target) : undefined,
      budget_remaining:
        d?.budget_remaining != null && !Number.isNaN(Number(d.budget_remaining))
          ? Number(d.budget_remaining)
          : d?.budget_remaining === null
            ? null
            : undefined,
    }
  }

  const fetchDashboard = useCallback(
    async (opts?: { soft?: boolean }) => {
      const soft = opts?.soft === true
      const todayStr = format(new Date(), 'yyyy-MM-dd')

      setError(null)
      if (soft) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      try {
        const dashParams = isKaryawan
          ? { period: 'today' as const }
          : ownerCustomRange
            ? {
                from: format(ownerCustomRange.from, 'yyyy-MM-dd'),
                to: format(ownerCustomRange.to, 'yyyy-MM-dd'),
              }
            : { period: ownerPreset }

        const dashRes = await dashboardApi.get(dashParams)
        const raw = dashRes.data as DashboardData | { data?: DashboardData }
        const d = (raw && typeof raw === 'object' && 'data' in raw ? raw.data : raw) as DashboardData | undefined
        const parsed = normalizeDashboardPayload(d)

        const rs = parsed.range_start ?? todayStr
        const re = parsed.range_end ?? todayStr

        const recentParams: Record<string, string> = isKaryawan
          ? { page: '1', per_page: '8' }
          : { page: '1', per_page: '5', from: rs, to: re }

        const [incomeRes, monthlyRes, recentRes, statusesRes, todayListRes] = await Promise.all([
          isKaryawan
            ? Promise.resolve({ data: {} as { days?: IncomeTrendPoint[] } })
            : dashboardApi.weeklyTrend({
                from_date: rs,
                to_date: re,
                all_statuses: true,
              }),
          isKaryawan
            ? Promise.resolve({ data: {} as { months?: unknown[] } })
            : dashboardApi.monthlyTrend(MONTHLY_TREND_MONTHS, re),
          ordersApi.list(recentParams),
          orderStatusesApi.list(),
          isKaryawan
            ? ordersApi.list({ from: todayStr, to: todayStr, per_page: '50' })
            : Promise.resolve({ data: { data: [] as OrderRow[] } }),
        ])

        const incomeRaw = incomeRes.data as { days?: IncomeTrendPoint[] } | { data?: { days?: IncomeTrendPoint[] } }
        const incomeUnwrapped =
          incomeRaw && typeof incomeRaw === 'object' && 'data' in incomeRaw
            ? (incomeRaw as { data?: { days?: IncomeTrendPoint[] } }).data
            : (incomeRaw as { days?: IncomeTrendPoint[] })
        const incomeDays = Array.isArray(incomeUnwrapped?.days) ? incomeUnwrapped.days : []

        type MonthRow = {
          date: string
          month_label: string
          orders_count: number
          income: number
          cash_received?: number
          by_status?: { name: string; count: number }[]
        }
        const monthlyRaw = monthlyRes.data as { months?: MonthRow[] } | { data?: { months?: MonthRow[] } }
        const monthlyUnwrapped =
          monthlyRaw && typeof monthlyRaw === 'object' && 'data' in monthlyRaw
            ? (monthlyRaw as { data?: { months?: MonthRow[] } }).data
            : (monthlyRaw as { months?: MonthRow[] })
        const months = Array.isArray(monthlyUnwrapped?.months) ? monthlyUnwrapped.months : []
        const monthly = months.map((m) => ({
          date: m.date,
          label: m.month_label,
          orders_count: m.orders_count,
          income: m.income,
          cash_received: m.cash_received != null ? Number(m.cash_received) : undefined,
          by_status: Array.isArray(m.by_status) ? m.by_status : [],
        }))

        const recent = extractOrderRows(recentRes)
        const statusesRaw = statusesRes.data as { id: number; name: string; sort_order?: number }[] | undefined
        const statuses = Array.isArray(statusesRaw) ? statusesRaw : []
        const todayList = isKaryawan ? extractOrderRows(todayListRes) : []

        setLastUpdatedAt(new Date())
        setData(parsed)
        setIncomeTrend(incomeDays)
        setTrend(monthly)
        setRecentOrders(recent)
        setOrderStatuses(statuses)
        if (isKaryawan) {
          setWorkQueue(todayList.filter((o) => !TERMINAL_STATUS.has(o.status?.name ?? '')))
        } else {
          setWorkQueue([])
        }
      } catch (e: unknown) {
        const err = e as { response?: { data?: { message?: string; error?: string } }; message?: string }
        const msg = err?.response?.data?.message ?? err?.response?.data?.error ?? err?.message ?? 'Gagal memuat dashboard.'
        const text = typeof msg === 'string' ? msg : 'Gagal memuat dashboard.'
        if (soft) {
          toast.error(text)
        } else {
          setError(text)
        }
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [isKaryawan, ownerPreset, ownerCustomRange]
  )

  useEffect(() => {
    void fetchDashboard()
  }, [fetchDashboard])

  useEffect(() => {
    hasShownEmptyToast.current = false
  }, [ownerPreset, ownerCustomRange])

  useEffect(() => {
    if (
      !loading &&
      data &&
      data.orders_count === 0 &&
      recentOrders.length === 0 &&
      !hasShownEmptyToast.current
    ) {
      hasShownEmptyToast.current = true
      toast.info(isKaryawan ? 'Belum ada order hari ini' : 'Belum ada aktivitas pada periode yang dipilih', {
        description: isKaryawan
          ? 'Order baru akan muncul di daftar setelah dicatat.'
          : 'Ubah filter tanggal di atas atau buat order baru.',
      })
    }
  }, [loading, data, recentOrders.length, isKaryawan])

  if (loading && !data) {
    if (isKaryawan) {
      return <DashboardKaryawanSkeleton />
    }
    return <DashboardOwnerSkeleton />
  }

  if (error && !data) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-4 sm:p-8">
        <p className="text-center text-sm text-muted-foreground">{error}</p>
        <Button type="button" onClick={() => fetchDashboard()}>
          Coba lagi
        </Button>
      </div>
    )
  }

  if (!data) return null

  const name = user?.name ?? (isKaryawan ? 'Karyawan' : 'Admin')
  const todayIso = format(new Date(), 'yyyy-MM-dd')

  if (isKaryawan) {
    return (
      <DashboardKaryawan
        name={name}
        data={data}
        recentOrders={recentOrders}
        workQueue={workQueue}
        orderStatuses={orderStatuses}
        refreshing={refreshing}
        todayIso={todayIso}
        lastUpdatedAt={lastUpdatedAt}
        onRefresh={() => fetchDashboard({ soft: true })}
      />
    )
  }

  const maxIncome = Math.max(...incomeTrend.map((d) => trendSeriesCash(d)), 1)

  const grossTotal = data.gross_total ?? data.income
  const unpaidOrders = data.unpaid_orders ?? 0
  const totalPaid = data.total_paid ?? 0
  const receivables = data.receivables ?? 0
  const maxOrders = Math.max(...trend.map((d) => d.orders_count), 1)
  const rangeLabel = formatDashboardRangeLabel(data.range_start, data.range_end)
  const rangeStartIso = data.range_start ?? format(new Date(), 'yyyy-MM-dd')
  const rangeEndIso = data.range_end ?? format(new Date(), 'yyyy-MM-dd')
  const budgetTarget = data.expense_budget_target ?? 0
  const showBudgetCard = budgetTarget > 0
  const todayLabel = format(new Date(), 'EEEE, d MMMM yyyy', { locale: id })
  return (
    <DashboardPageShell>
      <div className="mx-auto w-full min-w-0 max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          badges={
            <>
              <Badge variant="outline" className="text-xs font-medium">
                Ringkasan bisnis
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
              Selamat datang, <span className="text-primary">{name}</span>
            </>
          }
          description="Satu filter tanggal mengatur ringkasan, grafik kas harian, order terbaru, dan status — semuanya memakai rentang yang sama."
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                size="default"
                disabled={refreshing}
                onClick={() => fetchDashboard({ soft: true })}
                className="gap-2"
              >
                <span className={cn('material-symbols-outlined text-lg', refreshing && 'animate-spin')}>
                  refresh
                </span>
                {refreshing ? 'Memperbarui…' : 'Segarkan data'}
              </Button>
              <Link to="/dashboard/orders/new" className={cn(buttonVariants({ size: 'default' }), 'gap-2')}>
                <span className="material-symbols-outlined text-sm">add</span>
                Buat Order Baru
              </Link>
            </>
          }
        />

        <DashboardNotificationStrip />

        <div>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Ringkasan</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Rentang aktif: <span className="font-medium text-foreground">{rangeLabel}</span>
              </p>
            </div>
            <div
              className="inline-flex flex-wrap gap-0.5 rounded-lg border border-border bg-muted p-1"
              role="group"
              aria-label="Periode dashboard"
            >
              {(['today', 'week', 'month'] as const).map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant={ownerCustomRange == null && ownerPreset === p ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setOwnerCustomRange(null)
                    setOwnerPreset(p)
                  }}
                  className="rounded-md px-3 text-xs"
                >
                  {OWNER_PRESET_LABEL[p]}
                </Button>
              ))}
              <Popover
                open={rangePopoverOpen}
                onOpenChange={(open, eventDetails) => {
                  if (!open && rangeSelectionIncompleteRef.current) {
                    if (eventDetails.reason !== 'escape-key') {
                      eventDetails.cancel()
                      return
                    }
                  }
                  if (open) {
                    rangeSelectionIncompleteRef.current = false
                  }
                  setRangePopoverOpen(open)
                  if (open && ownerCustomRange) {
                    setRangeDraft({ from: ownerCustomRange.from, to: ownerCustomRange.to })
                  }
                  if (!open) {
                    setRangeDraft({ from: undefined, to: undefined })
                    rangeSelectionIncompleteRef.current = false
                  }
                }}
              >
                <PopoverTrigger
                  className={cn(
                    buttonVariants({ variant: ownerCustomRange != null ? 'default' : 'ghost', size: 'sm' }),
                    'rounded-md px-3 text-xs gap-1'
                  )}
                >
                  Rentang
                  <span className="material-symbols-outlined text-[16px]" aria-hidden>
                    date_range
                  </span>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align="end" initialFocus={false}>
                  <Calendar
                    mode="range"
                    selected={
                      rangeDraft.from || rangeDraft.to
                        ? { from: rangeDraft.from, to: rangeDraft.to }
                        : ownerCustomRange
                          ? { from: ownerCustomRange.from, to: ownerCustomRange.to }
                          : undefined
                    }
                    onSelect={(range) => {
                      if (!range) return
                      const from = range.from ?? null
                      const to = range.to ?? null
                      rangeSelectionIncompleteRef.current = Boolean(from && !to)
                      setRangeDraft({ from: from ?? undefined, to: to ?? undefined })
                      if (from && to) {
                        rangeSelectionIncompleteRef.current = false
                        const days = differenceInDays(to, from) + 1
                        if (days > MAX_CUSTOM_RANGE_DAYS) {
                          toast.error(`Maksimal ${MAX_CUSTOM_RANGE_DAYS} hari`, {
                            description: 'Pilih rentang yang lebih pendek.',
                          })
                          return
                        }
                        setOwnerCustomRange({ from, to })
                        setRangePopoverOpen(false)
                        setRangeDraft({ from: undefined, to: undefined })
                      }
                    }}
                    locale={id}
                    defaultMonth={rangeDraft.from ?? ownerCustomRange?.from ?? new Date()}
                  />
                  <p className="px-1 pt-2 text-[10px] text-muted-foreground">
                    Maks. {MAX_CUSTOM_RANGE_DAYS} hari — pilih hari mulai lalu hari selesai.
                  </p>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <MotionReveal index={0}>
              <DashboardStatCard
                icon="inventory_2"
                iconWrapperClassName="bg-primary/10 text-primary"
                label="Laundry Masuk"
                subtitle={rangeLabel}
                value={data.orders_count}
              />
            </MotionReveal>
            <MotionReveal index={1}>
              <DashboardStatCard
                icon="payments"
                iconWrapperClassName="bg-chart-2/15 text-chart-2"
                label="Nilai Transaksi"
                subtitle={`Semua status · ${rangeLabel}`}
                value={formatShortRupiah(grossTotal)}
              />
            </MotionReveal>
            <MotionReveal index={2}>
              <DashboardStatCard
                icon="task_alt"
                iconWrapperClassName="bg-palette-purple/20 text-palette-purple"
                label="Omzet selesai"
                subtitle={`Nota status selesai · ${rangeLabel}`}
                value={formatShortRupiah(data.income)}
              />
            </MotionReveal>
            <MotionReveal index={3}>
              <DashboardStatCard
                icon="account_balance_wallet"
                iconWrapperClassName="bg-destructive/10 text-destructive"
                label="Total Pengeluaran"
                subtitle={rangeLabel}
                value={formatShortRupiah(data.expenses)}
              />
            </MotionReveal>
            <MotionReveal index={4}>
              <DashboardStatCard
                icon="trending_up"
                iconWrapperClassName="bg-chart-3/15 text-chart-3"
                label="Laba (kas)"
                subtitle={rangeLabel}
                value={
                  data.profit_accrual != null && Math.abs(data.profit_accrual - data.profit) > 0.01 ? (
                    <span className="block">
                      <span className="block">{formatShortRupiah(data.profit)}</span>
                      <span className="mt-1 block text-xs font-normal text-muted-foreground">
                        Akrual: {formatShortRupiah(data.profit_accrual)}
                      </span>
                    </span>
                  ) : (
                    formatShortRupiah(data.profit)
                  )
                }
                valueClassName="text-primary"
              />
            </MotionReveal>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <MotionReveal index={5}>
              <DashboardStatCard
                icon="pending_actions"
                iconWrapperClassName="bg-chart-2/15 text-chart-2"
                label="Masih diproses / antrian"
                subtitle={`Belum selesai atau batal · dibuat ${rangeLabel}`}
                value={data.pending_orders ?? 0}
              />
            </MotionReveal>
            <MotionReveal index={6}>
              <DashboardStatCard
                icon="check_circle"
                iconWrapperClassName="bg-chart-3/15 text-chart-3"
                label="Order selesai"
                subtitle={`Status selesai · dibuat ${rangeLabel}`}
                value={data.delivered_orders ?? 0}
              />
            </MotionReveal>
          </div>

          <div
            className={cn(
              'mt-4 grid grid-cols-1 gap-4 md:grid-cols-2',
              showBudgetCard ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
            )}
          >
            <MotionReveal index={7}>
              <DashboardStatCard
                icon="schedule"
                iconWrapperClassName="bg-muted-foreground/15 text-muted-foreground"
                label="Laundry belum bayar"
                subtitle={rangeLabel}
                value={unpaidOrders}
              />
            </MotionReveal>
            <MotionReveal index={8}>
              <DashboardStatCard
                icon="price_check"
                iconWrapperClassName="bg-muted-foreground/15 text-muted-foreground"
                label="Kas masuk"
                subtitle={rangeLabel}
                value={formatShortRupiah(totalPaid)}
              />
            </MotionReveal>
            <MotionReveal index={9}>
              <DashboardStatCard
                icon="receipt_long"
                iconWrapperClassName="bg-chart-4/15 text-chart-4"
                label="Piutang (belum lunas)"
                subtitle="Total semua order"
                value={formatShortRupiah(receivables)}
              />
            </MotionReveal>
            {showBudgetCard ? (
              <MotionReveal index={10}>
                <DashboardStatCard
                  icon="savings"
                  iconWrapperClassName="bg-primary/10 text-primary"
                  label="Sisa anggaran pengeluaran"
                  subtitle={`Target ${formatRupiah(budgetTarget)} · ${rangeLabel}`}
                  value={formatRupiah(data.budget_remaining ?? 0)}
                  valueClassName={(data.budget_remaining ?? 0) < 0 ? 'text-destructive' : 'text-primary'}
                />
              </MotionReveal>
            ) : null}
          </div>
        </div>

        <Separator className="bg-border" />

        {canAccess(user?.permissions, 'reports') ? <DashboardRekapanSection /> : null}

      <DashboardSectionCard
        title="Tren Kas Masuk"
        description={`Kas masuk per hari untuk rentang yang sama dengan ringkasan (${rangeLabel}).`}
        actions={
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <div className="flex items-center gap-2 sm:mr-2">
              <span className="h-3 w-3 shrink-0 rounded-full bg-primary" />
              <span className="text-xs text-muted-foreground">Kas masuk</span>
            </div>
            <div className="flex items-center gap-0.5 overflow-hidden rounded-lg border border-border bg-muted p-0.5">
              {(['bar', 'line', 'area'] as const).map((ct) => (
                <Button
                  key={ct}
                  type="button"
                  variant={chartType === ct ? 'default' : 'ghost'}
                  size="icon-sm"
                  title={ct === 'bar' ? 'Batang' : ct === 'line' ? 'Garis' : 'Area'}
                  className="rounded-md"
                  onClick={() => setChartType(ct)}
                >
                  <span className="material-symbols-outlined text-lg">
                    {ct === 'bar' ? 'bar_chart' : ct === 'line' ? 'show_chart' : 'area_chart'}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        }
      >
        <div className="relative flex h-64 flex-col">
          <TooltipProvider>
            {incomeTrend.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                <span className="material-symbols-outlined text-4xl text-muted-foreground/70" aria-hidden>
                  payments
                </span>
                <p className="text-sm font-medium text-foreground">Belum ada data untuk grafik kas</p>
                <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
                  Tidak ada kas masuk per hari pada rentang ini. Coba ubah filter tanggal di atas.
                </p>
              </div>
            ) : (chartType === 'line' || chartType === 'area') ? (
              <>
                <div className="flex-1 min-h-0 w-full relative px-2">
                  <div className="absolute inset-x-0 top-0 z-0 h-full flex flex-col justify-between pointer-events-none opacity-5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} className="w-full border-t border-on-surface" />
                    ))}
                  </div>
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="pointer-events-none absolute inset-0 z-0 h-full w-full"
                  >
                    {(() => {
                      const n = incomeTrend.length
                      const points = incomeTrend.map((d, i) => {
                        const x = ((i + 0.5) / n) * 100
                        const y = 100 - (maxIncome > 0 ? (trendSeriesCash(d) / maxIncome) * 100 : 0)
                        return { ...d, x, y }
                      })
                      const linePoints = points.map((p) => `${p.x},${p.y}`).join(' ')
                      const areaPoints = `0,100 ${linePoints} 100,100`
                      return (
                        <>
                          {chartType === 'area' && (
                            <polygon
                              points={areaPoints}
                              fill={INCOME_CHART_COLOR}
                              fillOpacity={0.2}
                              className="transition-opacity"
                            />
                          )}
                          <polyline
                            points={linePoints}
                            fill="none"
                            stroke={INCOME_CHART_COLOR}
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                            className="transition-opacity"
                          />
                        </>
                      )
                    })()}
                  </svg>
                  <div className="absolute inset-0 z-[1] flex items-stretch">
                    {incomeTrend.map((point) => (
                      <TooltipRoot key={point.date}>
                        <TooltipTrigger
                          delay={80}
                          render={(props) => (
                            <div
                              {...props}
                              className={cn(
                                'h-full min-w-0 flex-1 cursor-default outline-none',
                                props.className
                              )}
                              aria-label={`${point.day_label}, ${point.date}: kas ${formatRupiah(trendSeriesCash(point))}, ${point.orders_count} order`}
                            />
                          )}
                        />
                        <TooltipContent side="top">
                          <IncomeChartTooltipBody point={point} />
                        </TooltipContent>
                      </TooltipRoot>
                    ))}
                  </div>
                </div>
                <div className="flex flex-shrink-0 px-2 pt-3">
                  {incomeTrend.map((point) => (
                    <span
                      key={point.date}
                      className="text-[10px] font-bold text-on-surface-variant truncate flex-1 min-w-0 text-center"
                    >
                      {point.day_label}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="relative flex flex-1 min-h-0 items-end justify-between gap-1 px-2 lg:gap-2">
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-full flex-col justify-between opacity-5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-full border-t border-on-surface" />
                  ))}
                </div>
                {incomeTrend.map((point) => {
                  const pct = maxIncome > 0 ? (trendSeriesCash(point) / maxIncome) * 100 : 0
                  return (
                    <TooltipRoot key={point.date}>
                      <TooltipTrigger
                        delay={80}
                        render={(props) => (
                          <div
                            {...props}
                            className={cn(
                              'group flex w-full min-w-0 flex-1 cursor-default flex-col items-center gap-3 outline-none',
                              props.className
                            )}
                            aria-label={`${point.day_label}, ${point.date}: kas ${formatRupiah(trendSeriesCash(point))}, ${point.orders_count} order`}
                          >
                            <div className="relative flex h-32 min-h-[40px] w-full max-w-16 flex-col justify-end rounded-t-md bg-primary/15 transition-all group-hover:bg-primary/25">
                              <div
                                className="absolute bottom-0 w-full min-h-[4px] rounded-t-md bg-primary"
                                style={{ height: `${Math.max(pct, 4)}%` }}
                              />
                            </div>
                            <span className="w-full truncate text-center text-[10px] font-bold text-muted-foreground">
                              {point.day_label}
                            </span>
                          </div>
                        )}
                      />
                      <TooltipContent side="top">
                        <IncomeChartTooltipBody point={point} />
                      </TooltipContent>
                    </TooltipRoot>
                  )
                })}
              </div>
            )}
          </TooltipProvider>
        </div>
      </DashboardSectionCard>

      <DashboardSectionCard
        title="Tren Order Bulanan per Status"
        description={`${MONTHLY_TREND_MONTHS} bulan ke belakang, diakhiri bulan ${format(new Date(`${rangeEndIso}T12:00:00`), 'MMMM yyyy', { locale: id })} (bulan akhir rentang filter).`}
        actions={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {ORDER_STATUS_CHART_ORDER.map((key) => (
              <div key={key} className="flex items-center gap-1.5">
                <span
                  className={`h-3 w-3 shrink-0 rounded-full ${CHART_STATUS_COLORS[key] ?? 'bg-muted-foreground/40'}`}
                />
                <span className="text-[10px] font-medium text-muted-foreground">{STATUS_LABEL[key] ?? key}</span>
              </div>
            ))}
          </div>
        }
      >
        <div className="relative flex h-64 flex-col">
          <TooltipProvider>
            {trend.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
                <span className="material-symbols-outlined text-4xl text-muted-foreground/70" aria-hidden>
                  bar_chart
                </span>
                <p className="text-sm font-medium text-foreground">Belum ada data bulanan</p>
                <p className="max-w-md text-xs text-muted-foreground">
                  Grafik akan terisi setelah ada order tercatat di sistem.
                </p>
              </div>
            ) : (
              <div className="relative flex flex-1 min-h-0 items-end justify-between gap-1 px-2 lg:gap-2">
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-full flex-col justify-between opacity-5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-full border-t border-on-surface" />
                  ))}
                </div>
                {trend.map((point) => {
                  const barHeightPct = maxOrders > 0 ? (point.orders_count / maxOrders) * 100 : 0
                  const segments = point.by_status ?? []
                  const total = point.orders_count || 1
                  const ariaParts = [
                    `${point.label}: ${point.orders_count} order`,
                    ...segments.filter((s) => s.count > 0).map(
                      (s) => `${STATUS_LABEL[s.name] ?? s.name} ${s.count}`
                    ),
                  ]
                  return (
                    <TooltipRoot key={point.date}>
                      <TooltipTrigger
                        delay={80}
                        render={(props) => (
                          <div
                            {...props}
                            className={cn(
                              'group flex w-full min-w-0 flex-1 cursor-default flex-col items-center gap-3 outline-none',
                              props.className
                            )}
                            aria-label={ariaParts.join(', ')}
                          >
                            <div
                              className="relative flex h-32 min-h-[40px] w-full max-w-16 flex-col justify-end overflow-hidden rounded-t-lg transition-all group-hover:opacity-90"
                              style={{ minHeight: 128 }}
                            >
                              <div
                                className="flex min-h-[4px] w-full flex-col-reverse rounded-t-lg"
                                style={{ height: `${Math.max(barHeightPct, 4)}%` }}
                              >
                                {segments.map((seg) => {
                                  const segPct = total > 0 ? (seg.count / total) * 100 : 0
                                  if (segPct <= 0) return null
                                  return (
                                    <div
                                      key={seg.name}
                                      className={`min-h-[2px] w-full ${CHART_STATUS_COLORS[seg.name] ?? 'bg-muted-foreground/40'}`}
                                      style={{ height: `${segPct}%` }}
                                    />
                                  )
                                })}
                              </div>
                            </div>
                            <span className="w-full truncate text-center text-[10px] font-bold text-muted-foreground">
                              {point.label}
                            </span>
                          </div>
                        )}
                      />
                      <TooltipContent side="top">
                        <MonthlyChartTooltipBody point={point} />
                      </TooltipContent>
                    </TooltipRoot>
                  )
                })}
              </div>
            )}
          </TooltipProvider>
        </div>
      </DashboardSectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className={cn(dashPanel, 'lg:col-span-2')}>
          <CardHeader
            className={cn(dashPanelHeader, 'flex flex-row items-center justify-between space-y-0')}
          >
            <CardTitle className="text-base font-semibold tracking-tight">Order Terbaru</CardTitle>
            <CardAction>
              <Link
                to={`/dashboard/orders?from=${encodeURIComponent(rangeStartIso)}&to=${encodeURIComponent(rangeEndIso)}`}
                className={cn(buttonVariants({ variant: 'link', size: 'sm' }))}
              >
                Semua Order
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
                  <TableHead className={DATA_TABLE_HEADER_CELL_CLASS}>Layanan</TableHead>
                  <TableHead className={DATA_TABLE_HEADER_CELL_CLASS}>Status</TableHead>
                  <TableHead className={DATA_TABLE_HEADER_CELL_CLASS}>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className={`${DATA_TABLE_BODY_CELL_CLASS} py-8 text-center text-sm text-muted-foreground`}
                    >
                      Belum ada order pada rentang ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  recentOrders.map((o) => (
                    <TableRow key={o.id} className={DATA_TABLE_BODY_ROW_CLASS}>
                      <TableCell className={`${DATA_TABLE_BODY_CELL_CLASS} text-sm`}>
                        <Link to={`/dashboard/orders/${o.id}`} className="block">
                          <p className="font-bold">{o.customer?.name ?? '-'}</p>
                          <p className="text-xs text-on-surface-variant">{o.order_number}</p>
                        </Link>
                      </TableCell>
                      <TableCell className={`${DATA_TABLE_BODY_CELL_CLASS} text-sm`}>
                        <OrderCreatorDisplay creator={o.created_by} compact className="max-w-44 min-w-0" />
                      </TableCell>
                      <TableCell className={`${DATA_TABLE_BODY_CELL_CLASS} text-sm`}>
                        {getServiceLabel(o)}
                      </TableCell>
                      <TableCell className={DATA_TABLE_BODY_CELL_CLASS}>
                        <Badge
                          variant="secondary"
                          className={cn(
                            'border-0 px-3 py-1 text-[11px] font-bold',
                            STATUS_CLASS[o.status?.name ?? ''] ?? 'bg-palette-cream text-on-surface-variant'
                          )}
                        >
                          {STATUS_LABEL[o.status?.name ?? ''] ?? o.status?.name ?? '-'}
                        </Badge>
                      </TableCell>
                      <TableCell className={`${DATA_TABLE_BODY_CELL_CLASS} text-sm font-bold`}>
                        {formatRupiah(Number(o.total))}
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
            <CardTitle className="text-base font-semibold tracking-tight">
              Status order — {rangeLabel}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-5 pb-5 pt-3 sm:px-6">
            {(data.orders_by_status ?? []).length > 0 ? (
              data.orders_by_status!.map((item) => {
                const st = orderStatuses.find((s) => s.name === item.name)
                const orderQs = new URLSearchParams({
                  from: rangeStartIso,
                  to: rangeEndIso,
                })
                if (st != null) orderQs.set('status_id', String(st.id))
                const href = `/dashboard/orders?${orderQs.toString()}`
                const label = STATUS_LABEL[item.name] ?? item.name
                const row = (
                  <>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'border-0 px-2.5 py-1 text-xs font-bold',
                        STATUS_CLASS[item.name] ?? 'bg-muted text-muted-foreground'
                      )}
                    >
                      {label}
                    </Badge>
                    <span className="flex items-center gap-0.5 text-sm font-medium tabular-nums text-muted-foreground">
                      {item.count} order
                      <span className="material-symbols-outlined text-base opacity-50" aria-hidden>
                        chevron_right
                      </span>
                    </span>
                  </>
                )
                return (
                  <Link
                    key={item.name}
                    to={href}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2 transition-colors hover:bg-muted/65"
                  >
                    {row}
                  </Link>
                )
              })
            ) : (
              <p className="text-sm text-muted-foreground">
                Breakdown status belum tersedia. Buka halaman Orders untuk melihat daftar lengkap.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </DashboardPageShell>
  )
}
