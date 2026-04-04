import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
  type RowSelectionState,
} from '@tanstack/react-table'
import { toast } from 'sonner'
import { customersApi } from '../services/api'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { isMemberBenefitsActiveNow } from '@/lib/memberValidity'
import { useAuth } from '@/contexts/AuthContext'
import { useDebounce } from '@/hooks/useDebounce'
import {
  DataTable,
  DataTableBulkBar,
  DataTablePagination,
  createSelectColumn,
} from '@/components/data-table'
import { AlertDialog } from '@/components/ui/alert-dialog'

interface Customer {
  id: number
  name: string
  phone: string
  email?: string
  is_member?: boolean
  member_discount?: number | null
  member_valid_from?: string | null
  member_valid_until?: string | null
  note?: string | null
  is_blacklisted?: boolean
}

type PaginatedCustomers = {
  data: Customer[]
  total: number
  current_page: number
  last_page: number
  per_page: number
  from: number | null
  to: number | null
}

const PER_PAGE = 15

export default function Customers() {
  const { user } = useAuth()
  const canCreate = user?.permissions?.['customers.create'] !== false
  const canEdit = user?.permissions?.['customers.edit'] !== false
  const canDelete = user?.permissions?.['customers.delete'] !== false

  const [paginated, setPaginated] = useState<PaginatedCustomers | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [page, setPage] = useState(1)
  const [memberFilter, setMemberFilter] = useState<'all' | 'member' | 'nonmember'>('all')
  const [blacklistFilter, setBlacklistFilter] = useState<'all' | 'yes' | 'no'>('all')
  const [membershipClock, setMembershipClock] = useState(0)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const fetchList = useCallback(() => {
    setLoading(true)
    const params: Record<string, string> = {
      page: String(page),
      per_page: String(PER_PAGE),
    }
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim()
    if (memberFilter === 'member') params.is_member = 'true'
    if (memberFilter === 'nonmember') params.is_member = 'false'
    if (blacklistFilter === 'yes') params.blacklisted = 'true'
    if (blacklistFilter === 'no') params.blacklisted = 'false'

    customersApi
      .list(params)
      .then((r) => {
        const body = r.data as PaginatedCustomers
        setPaginated(body)
      })
      .catch(() => {
        setPaginated({
          data: [],
          total: 0,
          current_page: 1,
          last_page: 1,
          per_page: PER_PAGE,
          from: null,
          to: null,
        })
        toast.error('Gagal memuat pelanggan')
      })
      .finally(() => setLoading(false))
  }, [debouncedSearch, page, memberFilter, blacklistFilter])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, memberFilter, blacklistFilter])

  useEffect(() => {
    setRowSelection({})
  }, [page, debouncedSearch, memberFilter, blacklistFilter])

  useEffect(() => {
    const id = setInterval(() => setMembershipClock((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return
      fetchList()
      setMembershipClock((n) => n + 1)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [fetchList])

  const rows = paginated?.data ?? []

  const selectedIds = useMemo(() => {
    return Object.keys(rowSelection)
      .filter((k) => rowSelection[k])
      .map((k) => parseInt(k, 10))
      .filter((id) => !Number.isNaN(id))
  }, [rowSelection])

  const columns = useMemo<ColumnDef<Customer>[]>(() => {
    return [
      createSelectColumn<Customer>(),
      {
        accessorKey: 'name',
        header: 'Nama',
        cell: ({ row }) => (
          <span className="font-headline font-semibold text-on-surface">{row.original.name}</span>
        ),
      },
      {
        accessorKey: 'phone',
        header: 'Telepon',
        cell: ({ row }) => (
          <span className="text-sm text-on-surface-variant">{row.original.phone || '—'}</span>
        ),
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) => (
          <span className="text-sm text-on-surface-variant">{row.original.email || '—'}</span>
        ),
      },
      {
        id: 'member',
        header: 'Member',
        cell: ({ row }) => {
          const c = row.original
          const memberActiveNow = isMemberBenefitsActiveNow(c)
          return (
            <Badge
              variant="outline"
              className={cn(
                'border font-medium',
                c.is_member
                  ? !memberActiveNow
                    ? 'bg-amber-500/10 text-amber-800 dark:text-amber-200 border-amber-500/30'
                    : 'bg-primary/10 text-primary border-primary/30'
                  : 'bg-surface-container text-on-surface-variant'
              )}
            >
              {c.is_member
                ? !memberActiveNow
                  ? `Kedaluwarsa${c.member_discount != null && c.member_discount > 0 ? ` (${c.member_discount}%)` : ''}`
                  : `Member${c.member_discount != null && c.member_discount > 0 ? ` (${c.member_discount}%)` : ''}`
                : 'Bukan Member'}
            </Badge>
          )
        },
      },
      {
        id: 'note',
        header: 'Catatan',
        cell: ({ row }) => {
          const c = row.original
          return c.note?.trim() ? (
            <p
              className="text-sm text-on-surface-variant line-clamp-2 break-words max-w-[280px]"
              title={c.note}
            >
              {c.note.trim()}
            </p>
          ) : (
            <span className="text-sm text-on-surface-variant">—</span>
          )
        },
      },
      {
        id: 'blacklist',
        header: 'Blacklist',
        cell: ({ row }) => {
          const c = row.original
          return c.is_blacklisted ? (
            <Badge
              variant="outline"
              className="border font-medium bg-destructive/10 text-destructive border-destructive/30"
            >
              Blacklist
            </Badge>
          ) : (
            <span className="text-sm text-on-surface-variant">—</span>
          )
        },
      },
      {
        id: 'actions',
        header: () => (
          <span className="block text-right w-full text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
            Aksi
          </span>
        ),
        cell: ({ row }) => {
          const c = row.original
          return (
            <div className="text-right">
              {canEdit && (
                <Link
                  to={`/dashboard/customers/${c.id}`}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                >
                  <span className="material-symbols-outlined text-lg">edit</span>
                  Edit
                </Link>
              )}
            </div>
          )
        },
      },
    ]
  }, [canEdit, membershipClock])

  const table = useReactTable({
    data: rows,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: paginated?.last_page ?? 0,
    getRowId: (row) => String(row.id),
    enableRowSelection: true,
  })

  const confirmBulkDelete = async () => {
    let ok = 0
    let fail = 0
    for (const id of selectedIds) {
      try {
        await customersApi.delete(id)
        ok++
      } catch {
        fail++
      }
    }
    if (ok) toast.success(`${ok} pelanggan dihapus`)
    if (fail) toast.error(`${fail} gagal dihapus`)
    setRowSelection({})
    setBulkDeleteOpen(false)
    if (rows.length === ok && paginated && paginated.current_page > 1) {
      setPage(paginated.current_page - 1)
    } else {
      fetchList()
    }
  }

  const emptyMsg =
    search || memberFilter !== 'all' || blacklistFilter !== 'all'
      ? 'Tidak ada pelanggan yang cocok.'
      : 'Belum ada pelanggan.'

  return (
    <div
      className="mx-auto w-full min-w-0 max-w-7xl space-y-6 p-4 font-body text-on-surface sm:space-y-8 sm:p-6 lg:p-8"
      data-membership-tick={membershipClock}
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-extrabold text-on-surface sm:text-3xl">Daftar Pelanggan</h1>
          <p className="text-on-surface-variant mt-1">
            Kelola data pelanggan dan tingkat keanggotaan.
          </p>
        </div>
        {canCreate && (
          <Link
            to="/dashboard/customers/new"
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-br from-primary to-primary-container text-on-primary hover:brightness-110 shadow-lg shadow-primary/10 rounded-xl font-semibold px-6 py-3 transition-all"
          >
            <span className="material-symbols-outlined text-xl">person_add</span>
            Tambah Pelanggan
          </Link>
        )}
      </div>

      <Card className="bg-surface-container-low rounded-2xl border-0 shadow-none">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-full sm:min-w-[200px] sm:flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                Cari pelanggan
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg pointer-events-none">
                  search
                </span>
                <Input
                  type="text"
                  placeholder="Nama, telepon, atau email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-surface-container-lowest rounded-xl border-outline-variant/30 h-10 focus-visible:ring-2 focus-visible:ring-surface-tint/40"
                />
              </div>
            </div>
            <div className="w-full sm:min-w-[160px]">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                Member
              </label>
              <Select
                value={memberFilter}
                onValueChange={(v) => setMemberFilter((v as typeof memberFilter) ?? 'all')}
              >
                <SelectTrigger className="w-full bg-surface-container-lowest rounded-xl border-outline-variant/30 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="nonmember">Bukan member</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:min-w-[160px]">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                Blacklist
              </label>
              <Select
                value={blacklistFilter}
                onValueChange={(v) => setBlacklistFilter((v as typeof blacklistFilter) ?? 'all')}
              >
                <SelectTrigger className="w-full bg-surface-container-lowest rounded-xl border-outline-variant/30 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="yes">Blacklist</SelectItem>
                  <SelectItem value="no">Bukan blacklist</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {canDelete && (
          <DataTableBulkBar
            selectedCount={selectedIds.length}
            actions={[
              {
                id: 'bulk-delete',
                label: 'Hapus terpilih…',
                destructive: true,
                onClick: () => setBulkDeleteOpen(true),
              },
            ]}
            onClear={() => setRowSelection({})}
          />
        )}

        <div className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm border border-outline-variant/10">
          <DataTable
            table={table}
            loading={loading}
            emptyMessage={emptyMsg}
            emptyColSpan={8}
          />
          {paginated && paginated.last_page > 0 && (
            <DataTablePagination
              currentPage={paginated.current_page}
              lastPage={paginated.last_page}
              from={paginated.from}
              to={paginated.to}
              total={paginated.total}
              onPageChange={setPage}
              itemLabel="pelanggan"
            />
          )}
        </div>
      </div>

      <AlertDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Hapus pelanggan terpilih?"
        description="Data pelanggan akan dihapus permanen. Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Hapus"
        variant="destructive"
        onConfirm={confirmBulkDelete}
      />
    </div>
  )
}
