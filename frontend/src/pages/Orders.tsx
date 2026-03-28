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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
  diterima: 'bg-palette-cream text-on-surface',
  diproses: 'bg-palette-sky text-on-surface',
  selesai: 'bg-palette-purple text-on-surface',
  batal: 'bg-palette-lavender/50 text-on-surface border border-palette-purple/35',
  cuci: 'bg-palette-sky text-on-surface',
  setrika: 'bg-palette-sky text-on-surface',
  siap_diambil: 'bg-palette-purple/80 text-on-surface',
  diambil: 'bg-palette-purple text-on-surface',
}

function getStatusBadgeClass(slug: string): string {
  return STATUS_BADGE_CLASS[slug] ?? 'bg-surface-container text-on-surface-variant'
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
    if (search) params.search = search
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
  }, [statusFilter, dateFrom, dateTo, search, page])

  useEffect(() => {
    setRowSelection({})
  }, [page, statusFilter, dateFrom, dateTo, search])

  const applyFilters = () => {
    const next = new URLSearchParams(searchParams)
    if (search) next.set('search', search)
    else next.delete('search')
    if (statusFilter && statusFilter !== 'all') next.set('status_id', statusFilter)
    else next.delete('status_id')
    if (dateFrom) next.set('from', dateFrom)
    else next.delete('from')
    if (dateTo) next.set('to', dateTo)
    else next.delete('to')
    next.set('page', '1')
    setSearchParams(next)
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
    params.page = String(page)
    ordersApi
      .list(params)
      .then((r) => setList(r.data as Paginated))
      .catch(() => {})
  }, [statusFilter, dateFrom, dateTo, debouncedSearch, page])

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
          <span className="text-sm text-on-surface-variant font-medium">
            {row.original.receipt_number ?? '—'}
          </span>
        ),
      },
      {
        accessorKey: 'created_at',
        header: 'Tanggal',
        cell: ({ row }) => (
          <span className="text-sm text-on-surface-variant">
            {formatDate(row.original.created_at)}
          </span>
        ),
      },
      {
        id: 'customer',
        header: 'Pelanggan',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-bold text-sm">{row.original.customer?.name ?? '—'}</span>
            <span className="text-xs text-on-surface-variant">
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
              <Badge
                variant="secondary"
                className="bg-surface-container text-on-surface-variant font-medium rounded-lg"
              >
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
          <div className="text-center font-semibold text-sm">{weightOrQty(row.original)}</div>
        ),
      },
      {
        id: 'total',
        header: 'Total Bayar',
        cell: ({ row }) => (
          <span className="font-bold text-sm">{fmt(Number(row.original.total))}</span>
        ),
      },
      {
        id: 'payment',
        header: 'Pembayaran',
        cell: ({ row }) => {
          const o = row.original
          return (
            <div className="text-sm text-on-surface-variant">
              <div>{paymentMethodLabel(o.payment_method)}</div>
              <div className="text-xs mt-1 font-semibold text-on-surface">
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
            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Link
                to={`/dashboard/orders/${o.id}`}
                title="Detail"
                className="inline-flex h-8 w-8 items-center justify-center text-primary hover:bg-primary/5 rounded-lg"
              >
                <span className="material-symbols-outlined text-xl">visibility</span>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-on-surface-variant hover:bg-surface-container rounded-lg"
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

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 font-body text-on-surface sm:space-y-8 sm:p-6 lg:p-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-extrabold text-on-surface sm:text-3xl">Daftar Order</h1>
          <p className="text-on-surface-variant mt-1">
            Kelola dan pantau status cucian pelanggan Anda.
          </p>
        </div>
        {canCreate && (
          <Link
            to="/dashboard/orders/new"
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-br from-primary to-primary-container text-on-primary hover:brightness-110 shadow-lg shadow-primary/10 rounded-xl font-semibold px-6 py-3 transition-all"
          >
            <span className="material-symbols-outlined text-xl">add_circle</span>
            Buat Order Baru
          </Link>
        )}
      </div>

      <Card className="bg-surface-container-low rounded-2xl border-0 shadow-none">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="w-full sm:min-w-[200px] sm:flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                Dari
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-surface-container-lowest rounded-xl border-outline-variant/30 h-9"
              />
            </div>
            <div className="w-full sm:min-w-[200px] sm:flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                Sampai
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-surface-container-lowest rounded-xl border-outline-variant/30 h-9"
              />
            </div>
            <div className="w-full sm:min-w-[200px]">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                Status Pesanan
              </label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? 'all')}>
                <SelectTrigger className="w-full bg-surface-container-lowest rounded-xl border-outline-variant/30 h-9">
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  {statuses.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {orderStatusLabel(s.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:min-w-[180px]">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                Cari
              </label>
              <Input
                placeholder="No. order / nota…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                className="bg-surface-container-lowest rounded-xl border-outline-variant/30 h-9"
              />
            </div>
            <div className="self-end pb-1">
              <Button
                size="icon"
                className="h-10 w-10 bg-secondary text-on-secondary rounded-xl hover:bg-secondary/90"
                onClick={applyFilters}
              >
                <span className="material-symbols-outlined">filter_alt</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10">
          <CardContent className="p-4 sm:p-6">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
              Total Order
            </p>
            <div className="flex items-end justify-between mt-2">
              <h3 className="text-2xl font-headline font-bold text-primary">{list?.total ?? '—'}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10">
          <CardContent className="p-4 sm:p-6">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
              Sedang Diproses (halaman ini)
            </p>
            <div className="flex items-end justify-between mt-2">
              <h3 className="text-2xl font-headline font-bold text-tertiary">{inProgressCount}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10">
          <CardContent className="p-4 sm:p-6">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
              Pendapatan (halaman ini)
            </p>
            <div className="flex items-end justify-between mt-2">
              <h3 className="text-2xl font-headline font-bold text-primary">{fmt(pageRevenue)}</h3>
              <span className="material-symbols-outlined text-secondary">trending_up</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10">
          <CardContent className="p-4 sm:p-6">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
              Siap Diambil (halaman ini)
            </p>
            <div className="flex items-end justify-between mt-2">
              <h3 className="text-2xl font-headline font-bold text-secondary">{readyCount}</h3>
              <span
                className="material-symbols-outlined text-secondary-container"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <DataTableBulkBar
          selectedCount={selectedCount}
          actions={bulkActions}
          onClear={() => setRowSelection({})}
        />

        <div className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm border border-outline-variant/10">
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
            className="relative z-50 w-full max-w-md rounded-xl bg-surface-container-lowest p-6 shadow-lg border border-outline-variant/20"
          >
            <h2 className="font-headline font-bold text-lg text-on-surface">Ubah status massal</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              Terpilih: {selectedCount} order
            </p>
            <div className="mt-4">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                Status baru
              </label>
              <Select value={bulkStatusId} onValueChange={(v) => setBulkStatusId(v ?? '')}>
                <SelectTrigger className="w-full bg-surface-container-low rounded-xl border-outline-variant/30">
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
            className="relative z-50 w-full max-w-lg max-h-[85vh] flex flex-col rounded-xl bg-surface-container-lowest shadow-lg border border-outline-variant/20"
          >
            <div className="p-6 pb-0">
              <h2
                id="bulk-wa-title"
                className="font-headline font-bold text-lg text-on-surface"
              >
                WhatsApp pelanggan
              </h2>
              <p className="mt-2 text-sm text-on-surface-variant">
                {selectedCount} order terpilih
                {bulkWaContacts.length > 0
                  ? ` · ${bulkWaContacts.length} nomor unik`
                  : ''}
                {selectedWithoutWaPhone > 0
                  ? ` · ${selectedWithoutWaPhone} tanpa nomor WA`
                  : ''}
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Satu nomor digabung jika beberapa order untuk pelanggan yang sama. Buka chat di
                browser / aplikasi WhatsApp (bukan Fonnte).
              </p>
            </div>
            <div className="p-6 pt-4 overflow-y-auto flex-1 min-h-0 space-y-2">
              {bulkWaContacts.length === 0 ? (
                <p className="text-sm text-on-surface-variant py-4 text-center">
                  Tidak ada nomor WhatsApp yang valid pada order terpilih.
                </p>
              ) : (
                bulkWaContacts.map((c) => (
                  <div
                    key={c.key}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-variant/15 bg-surface-container-low/50 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-on-surface truncate">{c.name}</p>
                      <p className="text-xs text-on-surface-variant">{c.phone}</p>
                      <p className="text-[11px] text-on-surface-variant/80 mt-0.5">
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
            <div className="p-6 pt-0 flex flex-wrap justify-end gap-2 border-t border-outline-variant/10">
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
    </div>
  )
}
