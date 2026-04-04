import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type PaginationState,
} from '@tanstack/react-table'
import { format, startOfMonth, startOfWeek, endOfWeek } from 'date-fns'
import { id } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  employeePerformanceApi,
  type EmployeePerformanceRow,
  type EmployeePerformanceSummary,
} from '../services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { DataTable, DataTablePagination } from '@/components/data-table'

const PRESETS = [
  { id: 'today', label: 'Hari ini' },
  { id: 'week', label: 'Minggu ini' },
  { id: 'month', label: 'Bulan ini' },
  { id: 'custom', label: 'Kustom' },
] as const

type PresetId = (typeof PRESETS)[number]['id']
type SortKey = 'orders' | 'revenue' | 'paid' | 'name' | 'completed'
type SortDir = 'asc' | 'desc'

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n)
}

function presetRange(preset: PresetId): [string, string] {
  const today = new Date()
  switch (preset) {
    case 'today':
      return [format(today, 'yyyy-MM-dd'), format(today, 'yyyy-MM-dd')]
    case 'week':
      return [
        format(startOfWeek(today, { locale: id }), 'yyyy-MM-dd'),
        format(endOfWeek(today, { locale: id }), 'yyyy-MM-dd'),
      ]
    case 'month':
      return [format(startOfMonth(today), 'yyyy-MM-dd'), format(today, 'yyyy-MM-dd')]
    default:
      return [format(today, 'yyyy-MM-dd'), format(today, 'yyyy-MM-dd')]
  }
}

function downloadCsv(filename: string, rows: string[][]) {
  const bom = '\uFEFF'
  const body = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const blob = new Blob([bom + body], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

function SortHeaderButton({
  label,
  active,
  dir,
  onClick,
  align = 'left',
}: {
  label: string
  active: boolean
  dir: SortDir
  onClick: () => void
  align?: 'left' | 'right'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-[11px] font-bold uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1',
        align === 'right' ? 'w-full justify-end' : 'inline-flex'
      )}
    >
      {label}
      {active && (
        <span className="material-symbols-outlined text-sm shrink-0">
          {dir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
        </span>
      )}
    </button>
  )
}

export default function EmployeePerformance() {
  const { user } = useAuth()
  const [preset, setPreset] = useState<PresetId>('month')
  const [from, setFrom] = useState(() => presetRange('month')[0])
  const [to, setTo] = useState(() => presetRange('month')[1])
  const [sort, setSort] = useState<SortKey>('orders')
  const [dir, setDir] = useState<SortDir>('desc')
  const [nameFilter, setNameFilter] = useState('')
  const [rows, setRows] = useState<EmployeePerformanceRow[]>([])
  const [summary, setSummary] = useState<EmployeePerformanceSummary | null>(null)
  const [isOwnOnly, setIsOwnOnly] = useState(false)
  const [loading, setLoading] = useState(false)
  const [meta, setMeta] = useState<{ from: string; to: string } | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    setLoading(true)
    employeePerformanceApi
      .list({ from, to, sort, dir }, { signal: ac.signal })
      .then((r) => {
        const d = r.data
        setRows(d.rows ?? [])
        setSummary(d.summary ?? null)
        setIsOwnOnly(!!d.is_own_only)
        setMeta({ from: d.from, to: d.to })
      })
      .catch((err) => {
        if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return
        const msg = err?.response?.data?.message
        toast.error(typeof msg === 'string' ? msg : 'Gagal memuat kinerja karyawan')
        setRows([])
        setSummary(null)
      })
      .finally(() => setLoading(false))
    return () => ac.abort()
  }, [from, to, sort, dir])

  const filteredRows = useMemo(() => {
    const q = nameFilter.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.name.toLowerCase().includes(q))
  }, [rows, nameFilter])

  const handlePresetSelect = (id: string) => {
    const p = id as PresetId
    setPreset(p)
    if (p !== 'custom') {
      const [f, t] = presetRange(p)
      setFrom(f)
      setTo(t)
    }
  }

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sort === key) {
        setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setSort(key)
        setDir(key === 'name' ? 'asc' : 'desc')
      }
    },
    [sort]
  )

  const [tablePagination, setTablePagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  useEffect(() => {
    setTablePagination((p) => ({ ...p, pageIndex: 0 }))
  }, [filteredRows.length, nameFilter, from, to, sort, dir])

  const columns = useMemo<ColumnDef<EmployeePerformanceRow>[]>(() => {
    const cols: ColumnDef<EmployeePerformanceRow>[] = []
    if (!isOwnOnly) {
      cols.push({
        id: 'idx',
        header: '#',
        cell: ({ row, table }) => {
          const pi = table.getState().pagination.pageIndex
          const ps = table.getState().pagination.pageSize
          return (
            <span className="text-center text-on-surface-variant text-sm block">
              {pi * ps + row.index + 1}
            </span>
          )
        },
      })
    }
    cols.push(
      {
        accessorKey: 'name',
        header: () => (
          <SortHeaderButton
            label={isOwnOnly ? 'Kasir' : 'Karyawan'}
            active={sort === 'name'}
            dir={dir}
            onClick={() => toggleSort('name')}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        accessorKey: 'orders_count',
        header: () => (
          <div className="text-right">
            <SortHeaderButton
              label="Order"
              active={sort === 'orders'}
              dir={dir}
              onClick={() => toggleSort('orders')}
              align="right"
            />
          </div>
        ),
        cell: ({ row }) => (
          <span className="text-right tabular-nums block">{row.original.orders_count}</span>
        ),
      },
      {
        accessorKey: 'completed_count',
        header: () => (
          <div className="text-right">
            <SortHeaderButton
              label="Selesai"
              active={sort === 'completed'}
              dir={dir}
              onClick={() => toggleSort('completed')}
              align="right"
            />
          </div>
        ),
        cell: ({ row }) => (
          <span className="text-right tabular-nums block">{row.original.completed_count}</span>
        ),
      },
      {
        accessorKey: 'cancelled_count',
        header: () => (
          <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant block text-right hidden md:block">
            Batal
          </span>
        ),
        cell: ({ row }) => (
          <span className="text-right tabular-nums hidden md:table-cell">
            {row.original.cancelled_count}
          </span>
        ),
      },
      {
        id: 'pct',
        header: () => (
          <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant block text-right hidden lg:block">
            % Selesai
          </span>
        ),
        cell: ({ row }) => (
          <span className="text-right tabular-nums hidden lg:table-cell">
            {row.original.completion_rate}%
          </span>
        ),
      },
      {
        accessorKey: 'total_revenue',
        header: () => (
          <div className="text-right">
            <SortHeaderButton
              label="Nilai"
              active={sort === 'revenue'}
              dir={dir}
              onClick={() => toggleSort('revenue')}
              align="right"
            />
          </div>
        ),
        cell: ({ row }) => (
          <span className="text-right tabular-nums whitespace-nowrap block">
            {formatRupiah(row.original.total_revenue)}
          </span>
        ),
      },
      {
        accessorKey: 'avg_order_value',
        header: () => (
          <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant block text-right hidden xl:block">
            Rata-rata
          </span>
        ),
        cell: ({ row }) => (
          <span className="text-right tabular-nums whitespace-nowrap hidden xl:table-cell">
            {formatRupiah(row.original.avg_order_value)}
          </span>
        ),
      },
      {
        accessorKey: 'total_paid',
        header: () => (
          <div className="text-right">
            <SortHeaderButton
              label="Terbayar"
              active={sort === 'paid'}
              dir={dir}
              onClick={() => toggleSort('paid')}
              align="right"
            />
          </div>
        ),
        cell: ({ row }) => (
          <span className="text-right tabular-nums whitespace-nowrap font-medium text-primary block">
            {formatRupiah(row.original.total_paid)}
          </span>
        ),
      }
    )
    return cols
  }, [isOwnOnly, sort, dir, toggleSort])

  const perfTable = useReactTable({
    data: filteredRows,
    columns,
    state: { pagination: tablePagination },
    onPaginationChange: setTablePagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row, i) => String(row.user_id ?? `row-${i}`),
  })

  const exportCsv = () => {
    if (!meta || filteredRows.length === 0) {
      toast.message('Tidak ada data untuk diekspor')
      return
    }
    const header = [
      '#',
      'Nama',
      'Order',
      'Selesai',
      'Batal',
      '% Selesai',
      'Nilai order',
      'Rata-rata / order',
      'Terbayar',
    ]
    const dataRows = filteredRows.map((r, i) => [
      String(i + 1),
      r.name,
      String(r.orders_count),
      String(r.completed_count),
      String(r.cancelled_count),
      `${r.completion_rate}%`,
      String(Math.round(r.total_revenue)),
      String(Math.round(r.avg_order_value)),
      String(Math.round(r.total_paid)),
    ])
    downloadCsv(`kinerja-karyawan_${meta.from}_${meta.to}.csv`, [header, ...dataRows])
    toast.success('CSV diunduh')
  }

  const showSummary = summary && (summary.total_orders > 0 || !loading)

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6 p-4 font-body text-on-surface sm:space-y-8 sm:p-6 lg:p-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-extrabold text-on-surface sm:text-3xl">Kinerja Karyawan</h1>
          <p className="text-on-surface-variant mt-1">
            {isOwnOnly
              ? 'Ringkasan order yang Anda buat di periode terpilih.'
              : 'Per kasir (pembuat order): jumlah order, penyelesaian, dan nilai transaksi.'}
          </p>
        </div>
      </div>

      <Card className="bg-surface-container-low rounded-2xl border-0 shadow-none">
        <CardContent className="space-y-6 p-4 sm:p-6">
          <div className="flex flex-wrap items-end gap-4 sm:gap-6">
            <div className="w-full sm:min-w-[200px]">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                Periode
              </label>
              <Select value={preset} onValueChange={(v) => handlePresetSelect(v ?? 'month')}>
                <SelectTrigger className="w-full bg-surface-container-lowest rounded-xl border-outline-variant/30 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:min-w-[160px] sm:flex-1">
              <label
                htmlFor="perf-from"
                className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2"
              >
                Dari
              </label>
              <Input
                id="perf-from"
                type="date"
                value={from}
                disabled={preset !== 'custom'}
                onChange={(e) => {
                  setPreset('custom')
                  setFrom(e.target.value)
                }}
                className="bg-surface-container-lowest rounded-xl border-outline-variant/30 h-9 disabled:opacity-60"
              />
            </div>
            <div className="w-full sm:min-w-[160px] sm:flex-1">
              <label
                htmlFor="perf-to"
                className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2"
              >
                Sampai
              </label>
              <Input
                id="perf-to"
                type="date"
                value={to}
                disabled={preset !== 'custom'}
                onChange={(e) => {
                  setPreset('custom')
                  setTo(e.target.value)
                }}
                className="bg-surface-container-lowest rounded-xl border-outline-variant/30 h-9 disabled:opacity-60"
              />
            </div>
            {!isOwnOnly && (
              <div className="w-full sm:min-w-[220px] sm:flex-1">
                <label
                  htmlFor="perf-filter"
                  className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2"
                >
                  Cari nama
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg pointer-events-none">
                    search
                  </span>
                  <Input
                    id="perf-filter"
                    type="search"
                    placeholder="Filter baris tabel…"
                    value={nameFilter}
                    onChange={(e) => setNameFilter(e.target.value)}
                    className="pl-10 bg-surface-container-lowest rounded-xl border-outline-variant/30 h-9"
                  />
                </div>
              </div>
            )}
          </div>

          {!isOwnOnly && (
            <div className="flex flex-wrap gap-4 pt-2 border-t border-outline-variant/20">
              <Button
                type="button"
                onClick={exportCsv}
                disabled={!rows.length}
                className="bg-gradient-to-br from-primary to-primary-container text-on-primary px-6 py-3 rounded-xl font-bold shadow-sm hover:opacity-90 h-auto"
              >
                <span className="material-symbols-outlined text-xl mr-2">download</span>
                Ekspor CSV
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {showSummary && summary && (
        <Card className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl overflow-hidden">
          <CardContent className="p-6">
            <h2 className="font-headline font-bold text-lg text-on-surface mb-6">Ringkasan</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 sm:gap-4">
              <div className="bg-surface-container-low rounded-xl p-4">
                <p className="text-xs text-on-surface-variant font-medium">Order (periode)</p>
                <p className="text-xl font-bold text-primary mt-1 tabular-nums">{summary.total_orders}</p>
                {!isOwnOnly && (
                  <p className="text-xs text-on-surface-variant mt-2">{summary.karyawan_count} kasir</p>
                )}
              </div>
              <div className="bg-surface-container-low rounded-xl p-4">
                <p className="text-xs text-on-surface-variant font-medium">Selesai</p>
                <p className="text-xl font-bold text-on-surface mt-1 tabular-nums">
                  {summary.total_completed}
                </p>
              </div>
              <div className="bg-surface-container-low rounded-xl p-4">
                <p className="text-xs text-on-surface-variant font-medium">Batal</p>
                <p className="text-xl font-bold text-on-surface mt-1 tabular-nums">
                  {summary.total_cancelled}
                </p>
              </div>
              <div className="bg-surface-container-low rounded-xl p-4">
                <p className="text-xs text-on-surface-variant font-medium">Nilai order</p>
                <p className="text-lg font-bold text-on-surface mt-1 tabular-nums truncate">
                  {formatRupiah(summary.total_revenue)}
                </p>
              </div>
              <div className="bg-surface-container-low rounded-xl p-4 col-span-2 sm:col-span-1">
                <p className="text-xs text-on-surface-variant font-medium">Terbayar</p>
                <p className="text-lg font-bold text-primary mt-1 tabular-nums truncate">
                  {formatRupiah(summary.total_paid)}
                </p>
              </div>
            </div>
            {meta && (
              <p className="text-xs text-on-surface-variant mt-6">
                Periode data: {meta.from} — {meta.to}
                {summary ? ` · ${summary.period_days} hari kalender` : ''}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm border border-outline-variant/10 relative">
        {loading && rows.length > 0 && (
          <div
            className="absolute inset-0 bg-surface/50 z-10 flex items-center justify-center backdrop-blur-[1px]"
            aria-busy
          >
            <span className="text-sm text-on-surface-variant font-medium">Memperbarui…</span>
          </div>
        )}
        {loading && rows.length === 0 ? (
          <p className="px-6 py-12 text-center text-on-surface-variant">Memuat data…</p>
        ) : filteredRows.length === 0 ? (
          <p className="px-6 py-12 text-center text-on-surface-variant">
            {rows.length === 0
              ? `Tidak ada order pada periode ini${isOwnOnly && user?.name ? ` untuk ${user.name}` : ''}.`
              : 'Tidak ada baris yang cocok dengan pencarian nama.'}
          </p>
        ) : (
          <div>
            <DataTable table={perfTable} emptyColSpan={isOwnOnly ? 8 : 9} />
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-t border-outline-variant/10 bg-surface-container-low/30">
              <p className="text-xs text-on-surface-variant">Baris per halaman</p>
              <Select
                value={String(perfTable.getState().pagination.pageSize)}
                onValueChange={(v) =>
                  setTablePagination({ pageIndex: 0, pageSize: Number(v) })
                }
              >
                <SelectTrigger className="w-[100px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DataTablePagination
              currentPage={perfTable.getState().pagination.pageIndex + 1}
              lastPage={Math.max(1, perfTable.getPageCount())}
              from={
                filteredRows.length === 0
                  ? null
                  : perfTable.getState().pagination.pageIndex *
                      perfTable.getState().pagination.pageSize +
                    1
              }
              to={Math.min(
                (perfTable.getState().pagination.pageIndex + 1) *
                  perfTable.getState().pagination.pageSize,
                filteredRows.length
              )}
              total={filteredRows.length}
              onPageChange={(p: number) => perfTable.setPageIndex(p - 1)}
              itemLabel="kasir"
            />
          </div>
        )}
      </div>
    </div>
  )
}
