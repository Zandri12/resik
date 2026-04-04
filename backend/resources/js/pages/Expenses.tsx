import { useCallback, useEffect, useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table'
import { toast } from 'sonner'
import { expensesApi, expenseCategoriesApi, outletSettingsApi } from '../services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { AlertDialog } from '@/components/ui/alert-dialog'
import {
  DataTable,
  DataTableBulkBar,
  DataTablePagination,
  createSelectColumn,
} from '@/components/data-table'
import { useAuth } from '@/contexts/AuthContext'
import { PAYMENT_METHODS, paymentMethodLabel } from '@/lib/paymentMethods'

interface Expense {
  id: number
  amount: number
  expense_date: string
  description?: string
  payment_method?: string | null
  expense_category: { id: number; name: string }
}

const CATEGORY_BADGE_CLASSES = [
  'bg-primary-fixed/30 text-on-primary-fixed-variant',
  'bg-secondary-container/30 text-on-secondary-container',
  'bg-tertiary-fixed/40 text-on-tertiary-fixed-variant',
  'bg-outline-variant/30 text-on-surface-variant',
]

function getCategoryBadgeClass(_name: string, index: number): string {
  const i = index % CATEGORY_BADGE_CLASSES.length
  return CATEGORY_BADGE_CLASSES[i]
}

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n)
}

function formatRupiahShort(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(n)
}

export default function Expenses() {
  const { user } = useAuth()
  const canCreate = user?.permissions?.['expenses.create'] !== false
  const canEdit = user?.permissions?.['expenses.edit'] !== false
  const canDelete = user?.permissions?.['expenses.delete'] !== false
  const [list, setList] = useState<{ data: Expense[] } | null>(null)
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({
    expense_category_id: '',
    amount: '',
    expense_date: new Date().toISOString().slice(0, 10),
    description: '',
    payment_method: '',
  })
  const [loading, setLoading] = useState(false)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterDate, setFilterDate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [budgetTarget, setBudgetTarget] = useState(6_000_000)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 15,
  })
  const [sorting, setSorting] = useState<SortingState>([])
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const fetchData = useCallback(() => {
    Promise.all([
      expensesApi.list({ per_page: '500' }),
      expenseCategoriesApi.list(),
      outletSettingsApi.list(),
    ])
      .then(([expRes, catRes, settingsRes]) => {
        setList(expRes.data)
        setCategories(Array.isArray(catRes.data) ? catRes.data : [])
        const settings = settingsRes.data as Record<string, string>
        const target = parseInt(settings?.expense_budget_target ?? '6000000', 10)
        setBudgetTarget(isNaN(target) || target < 0 ? 6_000_000 : target)
      })
      .catch((err) => {
        const msg = err?.response?.data?.message ?? err?.message ?? 'Gagal memuat data.'
        toast.error(typeof msg === 'string' ? msg : 'Gagal memuat pengeluaran.')
        setList({ data: [] })
        setCategories([])
      })
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const hasActiveFilters = filterCategory !== 'all' || filterDate || searchQuery.trim()

  const filteredList = useMemo(() => {
    const data = list?.data ?? []
    return data.filter((e) => {
      if (filterCategory !== 'all' && String(e.expense_category.id) !== filterCategory) return false
      const expDate = (e.expense_date ?? '').slice(0, 10)
      if (filterDate && expDate !== filterDate) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchDesc = (e.description ?? '').toLowerCase().includes(q)
        const matchCat = e.expense_category.name.toLowerCase().includes(q)
        const payLabel = paymentMethodLabel(e.payment_method).toLowerCase()
        const matchPay = payLabel.includes(q) || (e.payment_method ?? '').toLowerCase().includes(q)
        if (!matchDesc && !matchCat && !matchPay) return false
      }
      return true
    })
  }, [list?.data, filterCategory, filterDate, searchQuery])

  const totalFiltered = useMemo(
    () => filteredList.reduce((s, e) => s + Number(e.amount), 0),
    [filteredList]
  )

  useEffect(() => {
    setRowSelection({})
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }, [filterCategory, filterDate, searchQuery])

  const selectedIds = useMemo(() => {
    return Object.keys(rowSelection)
      .filter((k) => rowSelection[k])
      .map((k) => parseInt(k, 10))
      .filter((id) => !Number.isNaN(id))
  }, [rowSelection])

  const handleEdit = useCallback((exp: Expense) => {
    setEditingId(exp.id)
    setForm({
      expense_category_id: String(exp.expense_category.id),
      amount: String(exp.amount),
      expense_date: exp.expense_date.slice(0, 10),
      description: exp.description ?? '',
      payment_method: exp.payment_method ?? '',
    })
    setShowForm(true)
  }, [])

  const handleDeleteOne = useCallback(
    async (id: number) => {
      if (!confirm('Hapus pengeluaran ini?')) return
      try {
        await expensesApi.delete(id)
        toast.success('Pengeluaran berhasil dihapus')
        fetchData()
      } catch (err: unknown) {
        const e = err as { response?: { data?: { message?: string } }; message?: string }
        const msg = e?.response?.data?.message ?? e?.message ?? 'Gagal menghapus.'
        toast.error(typeof msg === 'string' ? msg : 'Gagal menghapus pengeluaran.')
      }
    },
    [fetchData]
  )

  const columns = useMemo<ColumnDef<Expense>[]>(() => {
    return [
      createSelectColumn<Expense>(),
      {
        id: 'no',
        header: 'No.',
        cell: ({ row, table }) => {
          const pi = table.getState().pagination.pageIndex
          const ps = table.getState().pagination.pageSize
          return (
            <span className="text-sm tabular-nums text-on-surface-variant">
              {pi * ps + row.index + 1}
            </span>
          )
        },
      },
      {
        accessorKey: 'expense_date',
        header: 'Tanggal',
        cell: ({ row }) => (
          <span className="text-sm font-medium text-on-surface">
            {new Date(row.original.expense_date).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        ),
      },
      {
        id: 'category',
        header: 'Kategori',
        accessorFn: (r) => r.expense_category.name,
        cell: ({ row, table }) => {
          const e = row.original
          const pi = table.getState().pagination.pageIndex
          const ps = table.getState().pagination.pageSize
          const idx = pi * ps + row.index
          return (
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${getCategoryBadgeClass(
                e.expense_category.name,
                idx
              )}`}
            >
              {e.expense_category.name}
            </span>
          )
        },
      },
      {
        accessorKey: 'amount',
        header: () => <span className="block text-right w-full">Nominal</span>,
        cell: ({ row }) => (
          <span className="text-sm font-bold text-on-surface text-right block">
            {formatRupiahShort(Number(row.original.amount))}
          </span>
        ),
      },
      {
        accessorKey: 'description',
        header: 'Detail pencatatan',
        cell: ({ row }) => (
          <span className="text-sm text-on-surface-variant max-w-[220px] truncate block">
            {row.original.description || '—'}
          </span>
        ),
      },
      {
        id: 'payment',
        header: 'Jenis pembayaran',
        cell: ({ row }) => (
          <span className="text-sm text-on-surface">
            {paymentMethodLabel(row.original.payment_method)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => (
          <span className="block text-center w-full text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Aksi
          </span>
        ),
        cell: ({ row }) => {
          const e = row.original
          return (
            <div className="flex justify-center gap-2">
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="p-1.5 text-on-surface-variant hover:text-primary h-8 w-8"
                  onClick={() => handleEdit(e)}
                >
                  <span className="material-symbols-outlined text-xl">edit</span>
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="p-1.5 text-on-surface-variant hover:text-error h-8 w-8"
                  onClick={() => handleDeleteOne(e.id)}
                >
                  <span className="material-symbols-outlined text-xl">delete</span>
                </Button>
              )}
            </div>
          )
        },
      },
    ]
  }, [canEdit, canDelete, handleEdit, handleDeleteOne])

  const table = useReactTable({
    data: filteredList,
    columns,
    state: { rowSelection, pagination, sorting },
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => String(row.id),
    enableRowSelection: true,
  })

  const confirmBulkDelete = useCallback(async () => {
    let ok = 0
    let fail = 0
    for (const id of selectedIds) {
      try {
        await expensesApi.delete(id)
        ok++
      } catch {
        fail++
      }
    }
    if (ok) toast.success(`${ok} pengeluaran dihapus`)
    if (fail) toast.error(`${fail} gagal dihapus`)
    setRowSelection({})
    setBulkDeleteOpen(false)
    fetchData()
  }, [selectedIds, fetchData])

  const summary = useMemo(() => {
    const data = list?.data ?? []
    const now = new Date()
    const thisMonth = data.filter((e) => {
      const d = new Date(e.expense_date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    const totalBulanIni = thisMonth.reduce((s, e) => s + Number(e.amount), 0)
    const byCategory: Record<string, number> = {}
    thisMonth.forEach((e) => {
      const name = e.expense_category.name
      byCategory[name] = (byCategory[name] ?? 0) + Number(e.amount)
    })
    const kategoriTerbesar =
      Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-'
    const pctTerbesar =
      totalBulanIni > 0 && kategoriTerbesar !== '-'
        ? Math.round(((byCategory[kategoriTerbesar] ?? 0) / totalBulanIni) * 100)
        : 0
    return {
      totalBulanIni,
      kategoriTerbesar,
      pctTerbesar,
      sisaAnggaran: budgetTarget - totalBulanIni,
      targetBulanan: budgetTarget,
    }
  }, [list?.data, budgetTarget])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const catId = form.expense_category_id.trim()
    const amountVal = parseFloat(form.amount)
    if (!catId) {
      toast.error('Pilih kategori pengeluaran')
      return
    }
    if (isNaN(amountVal) || amountVal < 0) {
      toast.error('Nominal (Rp) harus diisi dengan angka yang valid')
      return
    }
    setLoading(true)
    try {
      const pay = (form.payment_method || '').trim()
      if (editingId) {
        await expensesApi.update(editingId, {
          expense_category_id: Number(catId),
          amount: amountVal,
          expense_date: form.expense_date,
          description: form.description || undefined,
          payment_method: pay || null,
        })
        toast.success('Pengeluaran berhasil diperbarui')
        setEditingId(null)
      } else {
        await expensesApi.create({
          expense_category_id: Number(catId),
          amount: amountVal,
          expense_date: form.expense_date,
          description: form.description || undefined,
          payment_method: pay || null,
        })
        toast.success('Pengeluaran berhasil ditambahkan')
      }
      setForm({
        expense_category_id: '',
        amount: '',
        expense_date: new Date().toISOString().slice(0, 10),
        description: '',
        payment_method: '',
      })
      setShowForm(false)
      fetchData()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string }
      const msg = e?.response?.data?.message ?? e?.message ?? 'Gagal menyimpan.'
      toast.error(typeof msg === 'string' ? msg : 'Gagal menyimpan pengeluaran.')
    } finally {
      setLoading(false)
    }
  }

  const clearFilters = () => {
    setFilterCategory('all')
    setFilterDate('')
    setSearchQuery('')
  }

  const exportToCsv = () => {
    if (filteredList.length === 0) {
      toast.info('Tidak ada data untuk diekspor')
      return
    }
    const headers = [
      'No.',
      'Tanggal',
      'Kategori',
      'Nominal (Rp)',
      'Detail Pencatatan',
      'Jenis Pembayaran',
    ]
    const rows = filteredList.map((e, i) => [
      String(i + 1),
      new Date(e.expense_date).toLocaleDateString('id-ID'),
      e.expense_category.name,
      e.amount.toString(),
      e.description ?? '',
      paymentMethodLabel(e.payment_method),
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pengeluaran-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Berhasil diekspor')
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm({
      expense_category_id: '',
      amount: '',
      expense_date: new Date().toISOString().slice(0, 10),
      description: '',
      payment_method: '',
    })
  }

  if (!list) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-4 sm:p-8">
        <p className="text-on-surface-variant">Memuat pengeluaran...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1200px] p-4 sm:p-6 lg:p-10">
      {/* Header */}
      <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl lg:text-4xl">
            Daftar Pengeluaran
          </h2>
          <p className="text-on-surface-variant text-base">
            Kelola dan pantau semua pengeluaran operasional laundry Anda secara efisien.
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={() => {
              resetForm()
              setShowForm((v) => !v)
            }}
            className="bg-gradient-to-br from-primary to-primary-container text-on-primary px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-sm hover:opacity-90 transition-opacity h-auto"
          >
            <span className="material-symbols-outlined text-xl">add_circle</span>
            {showForm && !editingId ? 'Tutup' : 'Tambah Pengeluaran'}
          </Button>
        )}
      </header>

      {/* Form Tambah / Edit */}
      {showForm && (canCreate || canEdit) && (
        <Card className="mb-10 bg-surface-container-lowest border border-outline-variant/20 rounded-xl overflow-hidden">
          <CardContent className="p-4 sm:p-8">
            <h3 className="font-headline font-bold text-xl text-on-surface mb-6">
              {editingId ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <input type="hidden" value={form.expense_category_id} required />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-on-surface-variant px-1">
                    Tanggal <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="date"
                    value={form.expense_date}
                    onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                    className="bg-surface-container-low border-0 rounded-lg py-3 px-4 h-auto"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-on-surface-variant px-1">
                    Kategori <span className="text-destructive">*</span>
                  </label>
                  <Select
                    value={form.expense_category_id || undefined}
                    onValueChange={(v) => setForm({ ...form, expense_category_id: v ?? '' })}
                  >
                    <SelectTrigger className="w-full bg-surface-container-low border-0 rounded-lg py-3 px-4 h-auto" aria-required>
                      <SelectValue placeholder="Pilih kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-on-surface-variant px-1">
                    Nominal (Rp) <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-on-surface-variant">
                      Rp
                    </span>
                    <Input
                      type="number"
                      min={0}
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      placeholder="0"
                      className="bg-surface-container-low border-0 rounded-lg py-3 pl-12 pr-4 font-bold text-on-surface h-auto"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-on-surface-variant px-1">
                    Jenis pembayaran
                  </label>
                  <Select
                    value={form.payment_method || '__none__'}
                    onValueChange={(v) =>
                      setForm({ ...form, payment_method: v === '__none__' ? '' : (v ?? '') })
                    }
                  >
                    <SelectTrigger className="w-full bg-surface-container-low border-0 rounded-lg py-3 px-4 h-auto">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {PAYMENT_METHODS.filter((m) => m.value !== 'cash').map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-semibold text-on-surface-variant px-1">
                    Detail pencatatan
                  </label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Catatan tambahan (opsional)"
                    className="bg-surface-container-low border-0 rounded-lg py-3 px-4 focus-visible:ring-2 focus-visible:ring-surface-tint/40 text-on-surface h-auto"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-4 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={resetForm}
                  className="text-on-surface-variant hover:text-on-surface"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-br from-primary to-primary-container text-on-primary px-10 py-3 rounded-lg font-bold shadow-lg hover:opacity-90 h-auto"
                >
                  <span className="material-symbols-outlined text-lg mr-2">save</span>
                  {editingId ? 'Simpan Perubahan' : 'Simpan Pengeluaran'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <Card className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <p className="text-on-surface-variant text-sm font-medium">
                Total Pengeluaran Bulan Ini
              </p>
              <span className="text-secondary p-1.5 bg-secondary-container/30 rounded-lg">
                <span className="material-symbols-outlined text-lg">trending_up</span>
              </span>
            </div>
            <p className="text-on-surface text-3xl font-bold font-headline mb-1">
              {formatRupiah(summary.totalBulanIni)}
            </p>
            <p className="text-secondary text-sm font-semibold flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">arrow_upward</span>
              Bulan berjalan
            </p>
          </CardContent>
        </Card>
        <Card className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <p className="text-on-surface-variant text-sm font-medium">Kategori Terbesar</p>
              <span className="text-tertiary-container p-1.5 bg-tertiary-fixed/30 rounded-lg">
                <span className="material-symbols-outlined text-lg">category</span>
              </span>
            </div>
            <p className="text-on-surface text-3xl font-bold font-headline mb-1">
              {summary.kategoriTerbesar}
            </p>
            <p className="text-on-surface-variant text-sm">
              {summary.pctTerbesar > 0 ? `${summary.pctTerbesar}% dari total pengeluaran` : '-'}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <p className="text-on-surface-variant text-sm font-medium">Sisa Anggaran</p>
              <span className="text-primary p-1.5 bg-primary-fixed/30 rounded-lg">
                <span className="material-symbols-outlined text-lg">account_balance</span>
              </span>
            </div>
            <p className="text-on-surface text-3xl font-bold font-headline mb-1">
              {formatRupiah(Math.max(0, summary.sisaAnggaran))}
            </p>
            <p className="text-on-surface-variant text-sm">
              Target bulanan {formatRupiah(summary.targetBulanan)}
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Filters & Table */}
      <section className="bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant/20">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant/10 p-4 sm:p-6">
          <div className="flex w-full max-w-full flex-wrap gap-4 items-center sm:w-auto">
            <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v ?? 'all')}>
              <SelectTrigger className="w-full min-w-0 bg-surface-container-low border-0 rounded-lg py-2 h-auto sm:w-[180px]">
                <SelectValue placeholder="Semua Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full min-w-0 bg-surface-container-low border-0 rounded-lg py-2 h-auto sm:w-[160px]"
            />
            <div className="relative w-full min-w-0 sm:max-w-[280px] sm:flex-1 sm:min-w-[200px]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg pointer-events-none">
                search
              </span>
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari detail, kategori, atau jenis bayar..."
                className="bg-surface-container-low border-0 rounded-lg py-2 pl-10 pr-4 h-auto w-full"
              />
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-lg mr-1">filter_alt_off</span>
                Hapus filter
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCsv}
              className="border-outline-variant text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-lg mr-1">download</span>
              Ekspor CSV
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {filteredList.length === 0 ? (
            <div className="overflow-x-auto rounded-xl border border-outline-variant/15">
              <div className="px-6 py-16 text-center">
                <div className="flex flex-col items-center gap-4">
                  <span className="material-symbols-outlined text-5xl text-on-surface-variant/50">
                    receipt_long
                  </span>
                  <div>
                    <p className="text-on-surface-variant font-medium">
                      {hasActiveFilters
                        ? 'Tidak ada pengeluaran yang cocok dengan filter.'
                        : 'Belum ada pengeluaran.'}
                    </p>
                    <p className="text-on-surface-variant/80 text-sm mt-1">
                      {hasActiveFilters
                        ? 'Coba ubah filter atau hapus filter untuk melihat semua data.'
                        : 'Klik "Tambah Pengeluaran" untuk mencatat pengeluaran pertama.'}
                    </p>
                  </div>
                  {hasActiveFilters ? (
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Hapus filter
                    </Button>
                  ) : canCreate ? (
                    <Button
                      onClick={() => {
                        resetForm()
                        setShowForm(true)
                      }}
                      className="bg-primary text-on-primary"
                    >
                      <span className="material-symbols-outlined text-lg mr-2">add</span>
                      Tambah Pengeluaran
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <>
              {canDelete && (
                <DataTableBulkBar
                  selectedCount={selectedIds.length}
                  actions={[
                    {
                      id: 'bulk-del',
                      label: 'Hapus terpilih…',
                      destructive: true,
                      onClick: () => setBulkDeleteOpen(true),
                    },
                  ]}
                  onClear={() => setRowSelection({})}
                />
              )}
              <div className="overflow-x-auto rounded-xl border border-outline-variant/15">
                <DataTable table={table} emptyColSpan={8} />
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-t border-outline-variant/10 bg-surface-container-low/30">
                  <p className="text-xs text-on-surface-variant">Baris per halaman</p>
                  <Select
                    value={String(table.getState().pagination.pageSize)}
                    onValueChange={(v) => {
                      const n = Number(v)
                      setPagination({ pageIndex: 0, pageSize: n })
                    }}
                  >
                    <SelectTrigger className="w-[100px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="15">15</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DataTablePagination
                  currentPage={table.getState().pagination.pageIndex + 1}
                  lastPage={Math.max(1, table.getPageCount())}
                  from={
                    filteredList.length === 0
                      ? null
                      : table.getState().pagination.pageIndex *
                          table.getState().pagination.pageSize +
                        1
                  }
                  to={Math.min(
                    (table.getState().pagination.pageIndex + 1) *
                      table.getState().pagination.pageSize,
                    filteredList.length
                  )}
                  total={filteredList.length}
                  onPageChange={(p) => table.setPageIndex(p - 1)}
                  itemLabel="pengeluaran"
                />
                <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[2fr_1fr_auto] gap-2 px-6 py-4 bg-surface-container-low/50 font-bold border-t border-outline-variant/10">
                  <span className="text-on-surface">
                    Total ({filteredList.length} pengeluaran)
                  </span>
                  <span className="text-on-surface text-right tabular-nums">
                    {formatRupiahShort(totalFiltered)}
                  </span>
                  <span className="hidden sm:block" />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-6 bg-surface-container-low/30 border-t border-outline-variant/10">
          <p className="text-sm text-on-surface-variant">
            {filteredList.length === 0
              ? 'Tidak ada pengeluaran'
              : `Menampilkan ${filteredList.length} pengeluaran${hasActiveFilters ? ' (filter aktif)' : ''}`}
          </p>
        </div>

        <AlertDialog
          open={bulkDeleteOpen}
          onOpenChange={setBulkDeleteOpen}
          title="Hapus pengeluaran terpilih?"
          description="Data akan dihapus permanen."
          confirmLabel="Hapus"
          variant="destructive"
          onConfirm={confirmBulkDelete}
        />
      </section>
    </div>
  )
}
