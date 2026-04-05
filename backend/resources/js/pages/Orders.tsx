import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
  type RowSelectionState,
} from '@tanstack/react-table'
import { toast } from 'sonner'
import { ordersApi, orderStatusesApi } from '../services/api'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertDialog } from '@/components/ui/alert-dialog'
import { normalizeIndonesianWaDigits, waMeHrefFromPhone } from '@/lib/phone'
import { cn } from '@/lib/utils'
import {
  orderStatusLabel,
  isReadyForPickupStatus,
  isInProgressStatus,
} from '@/lib/orderStatusDisplay'
import { paymentMethodLabel } from '@/lib/paymentMethods'
import { useAuth } from '@/contexts/AuthContext'
import {
  DataTable,
  DataTableBulkBar,
  DataTablePagination,
  createSelectColumn,
} from '@/components/data-table'
import { useDebounce } from '@/hooks/useDebounce'
import { OrderCreatorDisplay, type OrderCreator } from '@/components/order/OrderCreatorDisplay'
import { dashPanel } from '@/components/dashboard/dashboard-card-styles'
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader'
import { DashboardPageShell } from '@/components/dashboard/DashboardPageShell'
import { DashboardSectionCard } from '@/components/dashboard/DashboardSectionCard'
import { DashboardStatCard } from '@/components/dashboard/DashboardStatCard'
import { MotionReveal } from '@/components/dashboard/MotionReveal'

type OrderStatus = { id: number; name: string }
type Customer = { id: number; name: string; phone?: string }
type ServicePackage = { id: number; name: string; unit?: string }
type OrderItem = { quantity: number; service_package?: ServicePackage }
export type OrderRow = {
  id: number
  order_number: string
  total: number
  paid?: number
  payment_method?: string | null
  receipt_number?: string | null
  service_speed?: string | null
  created_at: string
  status: OrderStatus
  customer: Customer
  items: OrderItem[]
  created_by?: OrderCreator | null
}

type Paginated = {
  data: OrderRow[]
  total: number
  current_page: number
  last_page: number
  per_page: number
  from: number | null
  to: number | null
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  diterima: 'bg-muted text-on-surface',
  diproses: 'bg-palette-sky text-on-surface',
  selesai: 'bg-palette-purple text-on-surface',
  batal: 'bg-palette-lavender/50 text-on-surface border border-palette-purple/35',
  cuci: 'bg-palette-sky text-on-surface',
  setrika: 'bg-palette-sky text-on-surface',
  siap_diambil: 'bg-palette-purple/80 text-on-surface',
  diambil: 'bg-palette-purple text-on-surface',
}

function getStatusBadgeClass(slug: string): string {
  return STATUS_BADGE_CLASS[slug] ?? 'bg-muted text-foreground'
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(n)

const ORDER_SORTS = [
  { value: 'newest', label: 'Terbaru' },
  { value: 'oldest', label: 'Terlama' },
  { value: 'total_high', label: 'Total tertinggi' },
  { value: 'total_low', label: 'Total terendah' },
  { value: 'customer_az', label: 'Nama pelanggan A–Z' },
] as const

const ORDER_SORT_VALUES = new Set<string>(ORDER_SORTS.map((s) => s.value))
const PER_PAGE_OPTIONS = [15, 25, 50] as const

function formatIsoLocal(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function firstServiceName(order: OrderRow) {
  return order.items?.[0]?.service_package?.name ?? '—'
}

function weightOrQty(order: OrderRow) {
  const first = order.items?.[0]
  if (!first) return '—'
  const q = Number(first.quantity)
  const u = (first.service_package?.unit || '').toLowerCase()
  if (u === 'kg') {
    return `${q} kg`
  }
  const label =
    u === 'lembar' ? 'lembar' : u === 'pasang' ? 'pasang' : u === 'buah' ? 'buah' : 'pcs'
  return `${q} ${label}`
}

async function mapInChunks<T, R>(
  items: T[],
  chunkSize: number,
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = []
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize)
    const part = await Promise.allSettled(chunk.map(fn))
    out.push(...part)
  }
  return out
}

export default function Orders() {
  const { user } = useAuth()
  const canCreate = user?.permissions?.['orders.create'] !== false
  const canEdit = user?.permissions?.['orders.edit'] !== false
  const canDelete = user?.permissions?.['orders.delete'] !== false

  const [searchParams, setSearchParams] = useSearchParams()
  const [list, setList] = useState<Paginated | null>(null)
  const [statuses, setStatuses] = useState<OrderStatus[]>([])
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status_id') ?? 'all')
  const [dateFrom, setDateFrom] = useState(searchParams.get('from') ?? '')
  const [dateTo, setDateTo] = useState(searchParams.get('to') ?? '')
  const debouncedSearch = useDebounce(search, 300)
  const sortParam = searchParams.get('sort') ?? 'newest'
  const sort = ORDER_SORT_VALUES.has(sortParam) ? sortParam : 'newest'
  const perPageRaw = parseInt(searchParams.get('per_page') ?? '15', 10)
  const perPage = (PER_PAGE_OPTIONS as readonly number[]).includes(perPageRaw) ? perPageRaw : 15

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false)
  const [bulkStatusId, setBulkStatusId] = useState<string>('')
  const [bulkWaOpen, setBulkWaOpen] = useState(false)

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))

  useEffect(() => {
    orderStatusesApi.list().then((r) => setStatuses(r.data ?? []))
  }, [])

  useEffect(() => {
    const params: Record<string, string> = {}
    if (statusFilter && statusFilter !== 'all') params.status_id = statusFilter
    if (dateFrom) params.from = dateFrom
    if (dateTo) params.to = dateTo
    if (debouncedSearch) params.search = debouncedSearch
    if (sort !== 'newest') params.sort = sort
    if (perPage !== 15) params.per_page = String(perPage)
    params.page = String(page)
    ordersApi
      .list(params)
      .then((r) => setList(r.data as Paginated))
      .catch(() =>
        setList({
          data: [],
          total: 0,
          current_page: 1,
          last_page: 1,
          per_page: 15,
          from: null,
          to: null,
        })
      )
  }, [statusFilter, dateFrom, dateTo, debouncedSearch, page, sort, perPage])

  useEffect(() => {
    setRowSelection({})
  }, [page, statusFilter, dateFrom, dateTo, debouncedSearch, sort, perPage])

  /** Sinkronkan kata kunci pencarian ke URL (untuk dibagikan / bookmark). Data tabel sudah mengikuti ketikan (debounce). */
  const syncSearchToUrl = () => {
    const next = new URLSearchParams(searchParams)
    if (search) next.set('search', search)
    else next.delete('search')
    next.set('page', '1')
    setSearchParams(next)
  }

  const onStatusFilterChange = (v: string | null) => {
    const val = v ?? 'all'
    setStatusFilter(val)
    const next = new URLSearchParams(searchParams)
    if (val === 'all') next.delete('status_id')
    else next.set('status_id', val)
    next.set('page', '1')
    setSearchParams(next)
  }

  const onDateFromChange = (value: string) => {
    setDateFrom(value)
    const next = new URLSearchParams(searchParams)
    if (value) next.set('from', value)
    else next.delete('from')
    next.set('page', '1')
    setSearchParams(next)
  }

  const onDateToChange = (value: string) => {
    setDateTo(value)
    const next = new URLSearchParams(searchParams)
    if (value) next.set('to', value)
    else next.delete('to')
    next.set('page', '1')
    setSearchParams(next)
  }

  const setSort = (v: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (!v || v === 'newest') next.delete('sort')
    else next.set('sort', v)
    next.set('page', '1')
    setSearchParams(next)
  }

  const setPerPageParam = (v: string | null) => {
    const next = new URLSearchParams(searchParams)
    const n = parseInt(v ?? '15', 10)
    if (n === 15 || Number.isNaN(n)) next.delete('per_page')
    else next.set('per_page', String(n))
    next.set('page', '1')
    setSearchParams(next)
  }

  const applyQuickDatePreset = (preset: 'today' | 'week' | 'month') => {
    const today = new Date()
    const to = formatIsoLocal(today)
    let from = to
    if (preset === 'week') {
      const start = new Date(today)
      start.setDate(start.getDate() - 6)
      from = formatIsoLocal(start)
    } else if (preset === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      from = formatIsoLocal(start)
    }
    setDateFrom(from)
    setDateTo(to)
    const next = new URLSearchParams(searchParams)
    next.set('from', from)
    next.set('to', to)
    next.set('page', '1')
    setSearchParams(next)
  }

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setDateFrom('')
    setDateTo('')
    setRowSelection({})
    setSearchParams(new URLSearchParams({ page: '1' }))
  }

  const setPage = (p: number) => {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(Math.max(1, Math.min(p, list?.last_page ?? 1))))
    setSearchParams(next)
  }

  const refetch = useCallback(() => {
    const params: Record<string, string> = {}
    if (statusFilter && statusFilter !== 'all') params.status_id = statusFilter
    if (dateFrom) params.from = dateFrom
    if (dateTo) params.to = dateTo
    if (debouncedSearch) params.search = debouncedSearch
    if (sort !== 'newest') params.sort = sort
    if (perPage !== 15) params.per_page = String(perPage)
    params.page = String(page)
    ordersApi
      .list(params)
      .then((r) => setList(r.data as Paginated))
      .catch(() => {})
  }, [statusFilter, dateFrom, dateTo, debouncedSearch, page, sort, perPage])

  const selectedIds = useMemo(() => {
    const rows = list?.data ?? []
    return Object.keys(rowSelection)
      .filter((k) => rowSelection[k])
      .map((k) => rows.find((r) => String(r.id) === k)?.id)
      .filter((id): id is number => id != null)
  }, [list?.data, rowSelection])

  const selectedCount = selectedIds.length

  const { bulkWaContacts, selectedWithoutWaPhone } = useMemo(() => {
    const rows = list?.data ?? []
    const selected = new Set(selectedIds)
    const byPhone = new Map<
      string,
      { name: string; phone: string; orderNumbers: string[] }
    >()
    let withoutPhone = 0
    for (const o of rows) {
      if (!selected.has(o.id)) continue
      const raw = o.customer?.phone
      const digits = normalizeIndonesianWaDigits(String(raw ?? ''))
      if (!digits) {
        withoutPhone += 1
        continue
      }
      const on = o.order_number ?? String(o.id)
      const cur = byPhone.get(digits)
      if (cur) {
        cur.orderNumbers.push(on)
      } else {
        byPhone.set(digits, {
          name: o.customer?.name?.trim() || '—',
          phone: String(raw ?? '').trim(),
          orderNumbers: [on],
        })
      }
    }
    const bulkWaContacts = Array.from(byPhone.entries()).map(([digits, v]) => ({
      key: digits,
      name: v.name,
      phone: v.phone,
      orderNumbers: [...new Set(v.orderNumbers)],
      waHref: `https://wa.me/${digits}` as const,
    }))
    return { bulkWaContacts, selectedWithoutWaPhone: withoutPhone }
  }, [list?.data, selectedIds])

  const columns = useMemo<ColumnDef<OrderRow>[]>(() => {
    const cols: ColumnDef<OrderRow>[] = [
      createSelectColumn<OrderRow>(),
      {
        accessorKey: 'order_number',
        header: 'No. Order',
        cell: ({ row }) => (
          <span className="font-headline font-bold text-primary">#{row.original.order_number}</span>
        ),
      },
      {
        id: 'receipt',
        header: 'Nota masuk',
        cell: ({ row }) => (
          <span className="text-sm font-medium text-muted-foreground">
            {row.original.receipt_number ?? '—'}
          </span>
        ),
      },
      {
        accessorKey: 'created_at',
        header: 'Tanggal',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(row.original.created_at)}
          </span>
        ),
      },
      {
        id: 'customer',
        header: 'Pelanggan',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">{row.original.customer?.name ?? '—'}</span>
            <span className="text-xs text-muted-foreground">
              {row.original.customer?.phone ?? '—'}
            </span>
          </div>
        ),
      },
      {
        id: 'created_by',
        header: 'Input order',
        cell: ({ row }) => (
          <OrderCreatorDisplay creator={row.original.created_by} compact className="max-w-[200px]" />
        ),
      },
      {
        id: 'service',
        header: 'Layanan',
        cell: ({ row }) => {
          const sp = row.original.service_speed
          const tier =
            sp === 'express' ? 'Express' : sp === 'reguler' ? 'Reguler' : null
          return (
            <div className="flex flex-col items-start gap-1">
              <Badge variant="secondary" className="rounded-lg font-medium">
                {firstServiceName(row.original)}
              </Badge>
              {tier && (
                <span className="text-[10px] font-bold uppercase tracking-wide text-primary">{tier}</span>
              )}
            </div>
          )
        },
      },
      {
        id: 'qty',
        header: () => <span className="block text-center w-full">Berat/Qty</span>,
        cell: ({ row }) => (
          <div className="text-center text-sm font-semibold text-foreground">{weightOrQty(row.original)}</div>
        ),
      },
      {
        id: 'total',
        header: 'Total Bayar',
        cell: ({ row }) => (
          <span className="text-sm font-bold tabular-nums text-foreground">{fmt(Number(row.original.total))}</span>
        ),
      },
      {
        id: 'payment',
        header: 'Pembayaran',
        cell: ({ row }) => {
          const o = row.original
          return (
            <div className="text-sm text-muted-foreground">
              <div>{paymentMethodLabel(o.payment_method)}</div>
              <div className="mt-1 text-xs font-semibold text-foreground">
                {Number(o.paid ?? 0) >= Number(o.total) && Number(o.total) > 0
                  ? 'Lunas'
                  : Number(o.total) > 0
                    ? `Sisa ${fmt(Math.max(0, Number(o.total) - Number(o.paid ?? 0)))}`
                    : '—'}
              </div>
            </div>
          )
        },
      },
      {
        id: 'status',
        header: () => <span className="block text-center w-full">Status</span>,
        cell: ({ row }) => {
          const o = row.original
          return (
            <div className="text-center">
              <Badge
                className={cn(
                  'rounded-full text-[11px] font-bold border-0',
                  getStatusBadgeClass(o.status?.name ?? '')
                )}
              >
                {orderStatusLabel(o.status?.name ?? '')}
              </Badge>
            </div>
          )
        },
      },
      {
        id: 'actions',
        header: () => <span className="block text-right w-full">Aksi</span>,
        cell: ({ row }) => {
          const o = row.original
          return (
            <div className="flex items-center justify-end gap-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
              <Link
                to={`/dashboard/orders/${o.id}`}
                title="Detail"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-primary hover:bg-primary/10"
              >
                <span className="material-symbols-outlined text-xl">visibility</span>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                title="Cetak Struk"
                onClick={() => window.open(`/dashboard/orders/${o.id}/print`, '_blank')}
              >
                <span className="material-symbols-outlined text-xl">print</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[#25D366] hover:bg-[#25D366]/10 rounded-lg"
                title="Chat WhatsApp ke pelanggan"
                onClick={() => {
                  const href = waMeHrefFromPhone(o.customer?.phone)
                  if (href) window.open(href, '_blank')
                }}
              >
                <span className="material-symbols-outlined text-xl">chat</span>
              </Button>
            </div>
          )
        },
      },
    ]
    return cols
  }, [])

  const table = useReactTable({
    data: list?.data ?? [],
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: list?.last_page ?? 0,
    getRowId: (row) => String(row.id),
    enableRowSelection: true,
  })

  const handleBulkDelete = async () => {
    const results = await mapInChunks(selectedIds, 5, (id) => ordersApi.delete(id))
    const failed = results.filter((r) => r.status === 'rejected').length
    const ok = results.length - failed
    if (ok) toast.success(`${ok} order dihapus`)
    if (failed) toast.error(`${failed} order gagal dihapus`)
    setRowSelection({})
    setBulkDeleteOpen(false)
    refetch()
  }

  const handleBulkStatus = async () => {
    const sid = parseInt(bulkStatusId, 10)
    if (!sid || Number.isNaN(sid)) {
      toast.error('Pilih status')
      return
    }
    const results = await mapInChunks(selectedIds, 5, (id) =>
      ordersApi.updateStatus(id, sid)
    )
    const failed = results.filter((r) => r.status === 'rejected').length
    const ok = results.length - failed
    if (ok) toast.success(`Status diperbarui untuk ${ok} order`)
    if (failed) toast.error(`${failed} order gagal diperbarui`)
    setRowSelection({})
    setBulkStatusOpen(false)
    setBulkStatusId('')
    refetch()
  }

  const bulkActions = useMemo(() => {
    const actions: {
      id: string
      label: string
      onClick: () => void
      destructive?: boolean
      disabled?: boolean
    }[] = []
    actions.push({
      id: 'whatsapp',
      label: 'WhatsApp pelanggan…',
      onClick: () => setBulkWaOpen(true),
    })
    if (canEdit) {
      actions.push({
        id: 'status',
        label: 'Ubah status…',
        onClick: () => {
          setBulkStatusId(statuses[0] ? String(statuses[0].id) : '')
          setBulkStatusOpen(true)
        },
      })
    }
    if (canDelete) {
      actions.push({
        id: 'delete',
        label: 'Hapus terpilih…',
        destructive: true,
        onClick: () => setBulkDeleteOpen(true),
      })
    }
    return actions
  }, [canEdit, canDelete, statuses])

  const inProgressCount =
    list?.data?.filter((o) => isInProgressStatus(o.status?.name)).length ?? 0
  const readyCount =
    list?.data?.filter((o) => isReadyForPickupStatus(o.status?.name)).length ?? 0
  const pageRevenue = list?.data?.reduce((s, o) => s + Number(o.total), 0) ?? 0

  const hasActiveFilters =
    Boolean(search.trim()) ||
    statusFilter !== 'all' ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    sort !== 'newest' ||
    perPage !== 15

  return (
    <DashboardPageShell>
      <div className="mx-auto w-full min-w-0 max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          badges={
            <>
              <Badge variant="outline" className="text-xs font-medium">
                Order
              </Badge>
              <Badge variant="secondary" className="text-xs font-normal">
                Daftar & filter
              </Badge>
            </>
          }
          title="Daftar Order"
          description="Sama seperti ringkasan dashboard: tanggal dan status tercermin di URL. Pencarian memperbarui tabel setelah jeda mengetik; Enter atau Simpan ke URL untuk menyamakan kata kunci dengan link."
          actions={
            canCreate ? (
              <Link to="/dashboard/orders/new" className={cn(buttonVariants({ size: 'default' }), 'gap-2')}>
                <span className="material-symbols-outlined text-sm">add</span>
                Buat Order Baru
              </Link>
            ) : undefined
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MotionReveal index={0}>
            <DashboardStatCard
              icon="inventory_2"
              iconWrapperClassName="bg-primary/10 text-primary"
              label="Total order"
              subtitle="Semua halaman sesuai filter"
              value={list?.total ?? '—'}
            />
          </MotionReveal>
          <MotionReveal index={1}>
            <DashboardStatCard
              icon="pending_actions"
              iconWrapperClassName="bg-chart-2/15 text-chart-2"
              label="Sedang diproses"
              subtitle="Hanya di halaman tabel ini"
              value={inProgressCount}
            />
          </MotionReveal>
          <MotionReveal index={2}>
            <DashboardStatCard
              icon="payments"
              iconWrapperClassName="bg-chart-2/15 text-chart-2"
              label="Total bayar (halaman)"
              subtitle="Jumlah nominal order di baris ini"
              value={fmt(pageRevenue)}
            />
          </MotionReveal>
          <MotionReveal index={3}>
            <DashboardStatCard
              icon="check_circle"
              iconWrapperClassName="bg-chart-3/15 text-chart-3"
              label="Siap diambil"
              subtitle="Di halaman ini saja"
              value={readyCount}
            />
          </MotionReveal>
        </div>

        <MotionReveal index={4}>
          <DashboardSectionCard
            className="mb-0"
            title="Filter & urutan"
            description="Tanggal dan status langsung di URL. Gunakan preset cepat seperti di dashboard, atau isi manual."
          >
            <div className="space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                <div className="min-w-0 flex-1 space-y-2">
                  <label htmlFor="orders-search" className="text-sm font-medium text-foreground">
                    Cari
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">
                      search
                    </span>
                    <Input
                      id="orders-search"
                      placeholder="Nomor order, nota, nama pelanggan, atau WhatsApp…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && syncSearchToUrl()}
                      className="h-10 pl-9"
                    />
                  </div>
                </div>
                <div className="w-full shrink-0 space-y-2 lg:w-[9rem]">
                  <span className="block text-sm font-medium text-foreground">Per halaman</span>
                  <Select value={String(perPage)} onValueChange={setPerPageParam}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PER_PAGE_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} baris
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <span className="block text-sm font-medium text-foreground">Rentang tanggal</span>
                <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
                  <div className="flex flex-col divide-y divide-border/60 sm:flex-row sm:divide-x sm:divide-y-0">
                    <div className="flex min-w-0 flex-1 items-center gap-3 p-3 sm:p-4">
                      <span className="material-symbols-outlined shrink-0 text-muted-foreground">calendar_today</span>
                      <div className="grid min-w-0 flex-1 grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 sm:gap-x-4">
                        <span className="text-xs font-medium text-muted-foreground">Dari</span>
                        <Input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => onDateFromChange(e.target.value)}
                          className="h-9 w-full min-w-0 bg-background"
                        />
                        <span className="text-xs font-medium text-muted-foreground">Sampai</span>
                        <Input
                          type="date"
                          value={dateTo}
                          onChange={(e) => onDateToChange(e.target.value)}
                          className="h-9 w-full min-w-0 bg-background"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col justify-center gap-2 p-3 sm:w-[min(100%,15rem)] sm:p-4">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Preset
                      </span>
                      <div
                        className="inline-flex flex-wrap gap-0.5 rounded-lg border border-border bg-muted p-1"
                        role="group"
                        aria-label="Preset rentang tanggal"
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="rounded-md px-3 text-xs"
                          onClick={() => applyQuickDatePreset('today')}
                        >
                          Hari ini
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="rounded-md px-3 text-xs"
                          onClick={() => applyQuickDatePreset('week')}
                        >
                          7 hari
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="rounded-md px-3 text-xs"
                          onClick={() => applyQuickDatePreset('month')}
                        >
                          Bulan ini
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <span className="block text-sm font-medium text-foreground">Status pesanan</span>
                  <Select value={statusFilter} onValueChange={onStatusFilterChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Semua status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua status</SelectItem>
                      {statuses.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {orderStatusLabel(s.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <span className="block text-sm font-medium text-foreground">Urutkan</span>
                  <Select value={sort} onValueChange={setSort}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih urutan" />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDER_SORTS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="order-2 text-xs leading-relaxed text-muted-foreground sm:order-1 sm:max-w-md">
                  Reset mengembalikan semua pilihan. Simpan ke URL hanya memperbarui kata kunci di alamat browser.
                </p>
                <div className="order-1 flex flex-wrap justify-end gap-2 sm:order-2 sm:shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={!hasActiveFilters}
                    onClick={clearFilters}
                  >
                    <span className="material-symbols-outlined text-base">restart_alt</span>
                    Reset
                  </Button>
                  <Button type="button" size="sm" className="gap-1.5" onClick={syncSearchToUrl}>
                    <span className="material-symbols-outlined text-base">link</span>
                    Simpan ke URL
                  </Button>
                </div>
              </div>
            </div>
          </DashboardSectionCard>
        </MotionReveal>

        <div className="space-y-3">
        <DataTableBulkBar
          selectedCount={selectedCount}
          actions={bulkActions}
          onClear={() => setRowSelection({})}
        />

        <div className={cn(dashPanel, 'overflow-hidden')}>
          <DataTable
            table={table}
            loading={!list}
            emptyMessage="Belum ada order."
            emptyColSpan={11}
          />
          {list && list.last_page > 0 && (
            <DataTablePagination
              currentPage={list.current_page}
              lastPage={list.last_page}
              from={list.from}
              to={list.to}
              total={list.total}
              onPageChange={setPage}
              itemLabel="order"
            />
          )}
        </div>
        </div>
      </div>

      <AlertDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Hapus order terpilih?"
        description={`${selectedCount} order akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus"
        variant="destructive"
        onConfirm={handleBulkDelete}
      />

      {bulkStatusOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setBulkStatusOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            className="relative z-50 w-full max-w-md rounded-2xl border border-border/65 bg-card p-6 shadow-lg ring-1 ring-border/40"
          >
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Ubah status massal</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Terpilih: {selectedCount} order
            </p>
            <div className="mt-4">
              <label className="mb-2 block text-xs font-medium text-muted-foreground">
                Status baru
              </label>
              <Select value={bulkStatusId} onValueChange={(v) => setBulkStatusId(v ?? '')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {orderStatusLabel(s.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setBulkStatusOpen(false)}>
                Batal
              </Button>
              <Button onClick={() => void handleBulkStatus()}>Terapkan</Button>
            </div>
          </div>
        </div>
      )}

      {bulkWaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setBulkWaOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-labelledby="bulk-wa-title"
            className="relative z-50 flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-border/65 bg-card shadow-lg ring-1 ring-border/40"
          >
            <div className="p-6 pb-0">
              <h2
                id="bulk-wa-title"
                className="text-lg font-semibold tracking-tight text-foreground"
              >
                WhatsApp pelanggan
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {selectedCount} order terpilih
                {bulkWaContacts.length > 0
                  ? ` · ${bulkWaContacts.length} nomor unik`
                  : ''}
                {selectedWithoutWaPhone > 0
                  ? ` · ${selectedWithoutWaPhone} tanpa nomor WA`
                  : ''}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Satu nomor digabung jika beberapa order untuk pelanggan yang sama. Buka chat di
                browser / aplikasi WhatsApp (bukan Fonnte).
              </p>
            </div>
            <div className="p-6 pt-4 overflow-y-auto flex-1 min-h-0 space-y-2">
              {bulkWaContacts.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Tidak ada nomor WhatsApp yang valid pada order terpilih.
                </p>
              ) : (
                bulkWaContacts.map((c) => (
                  <div
                    key={c.key}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.phone}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground/90">
                        Order: {c.orderNumbers.join(', ')}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="shrink-0 bg-[#25D366] hover:bg-[#25D366]/90 text-white"
                      onClick={() => window.open(c.waHref, '_blank')}
                    >
                      Buka chat
                    </Button>
                  </div>
                ))
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-border/60 p-6 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setBulkWaOpen(false)}
              >
                Tutup
              </Button>
              {bulkWaContacts.length > 0 && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(bulkWaContacts.map((c) => c.waHref).join('\n'))
                        .then(() => toast.success('Link WhatsApp disalin'))
                    }}
                  >
                    Salin semua link
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      bulkWaContacts.forEach((c, i) => {
                        window.setTimeout(() => window.open(c.waHref, '_blank'), i * 550)
                      })
                      toast.message('Membuka tab WhatsApp…', {
                        description: 'Izinkan popup jika browser memblokir.',
                      })
                    }}
                  >
                    Buka semua (berurutan)
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardPageShell>
  )
}
