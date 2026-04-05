import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowUpDownIcon } from 'lucide-react'
import { servicePackagesApi } from '../services/api'
import { Input } from '@/components/ui/input'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { AlertDialog } from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useDebounce } from '@/hooks/useDebounce'
import {
  DataTable,
  DataTableBulkBar,
  DataTablePagination,
  createSelectColumn,
} from '@/components/data-table'

const PER_PAGE_OPTIONS = [10, 15, 25, 50] as const

const FIELD_LABEL_CLASS = 'text-sm font-bold text-on-surface-variant'
const INPUT_FIELD_CLASS =
  'w-full h-11 rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-2 text-on-surface placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/40'
const READONLY_UNIT_CLASS =
  'flex h-11 w-full items-center rounded-xl border border-outline-variant/30 bg-muted/40 px-4 text-sm font-medium text-on-surface'
const TYPE_BUTTON_GRID_CLASS = 'grid grid-cols-2 gap-2 sm:gap-3'

type Package = {
  id: number
  name: string
  type: string
  price_per_unit: number
  unit: string
  category?: string | null
  sort_order?: number
  group_slug?: string | null
  group_title?: string | null
  variant_label?: string | null
  speed?: string | null
  estimate_minutes?: number
  is_active?: boolean
  deletable?: boolean
}

type PackageForm = {
  name: string
  type: 'kiloan' | 'satuan'
  satuan_unit: 'pcs' | 'lembar' | 'pasang' | 'buah'
  price_per_unit: string
  estimate_minutes: string
  category: string
  sort_order: string
  group_slug: string
  group_title: string
  variant_label: string
  speed: '' | 'reguler' | 'express'
}

const SATUAN_UNIT_OPTIONS: { value: PackageForm['satuan_unit']; label: string }[] = [
  { value: 'pcs', label: 'pcs' },
  { value: 'lembar', label: 'lembar' },
  { value: 'pasang', label: 'pasang' },
  { value: 'buah', label: 'buah' },
]

const TYPE_OPTIONS: { value: PackageForm['type']; label: string }[] = [
  { value: 'kiloan', label: 'Kiloan' },
  { value: 'satuan', label: 'Satuan' },
]

function normalizePackageType(raw: string | undefined | null): PackageForm['type'] {
  const t = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (t === 'satuan') return 'satuan'
  if (t === 'paket') return 'kiloan'
  return 'kiloan'
}

function formatTypeLabel(type: string | undefined): string {
  return normalizePackageType(type) === 'satuan' ? 'Satuan' : 'Kiloan'
}

function normalizeSatuanUnit(raw: string | undefined | null): PackageForm['satuan_unit'] {
  const u = String(raw ?? 'pcs')
    .trim()
    .toLowerCase()
  if (u === 'lembar' || u === 'pasang' || u === 'buah' || u === 'pcs') return u
  return 'pcs'
}

const emptyForm = (): PackageForm => ({
  name: '',
  type: 'kiloan',
  satuan_unit: 'pcs',
  price_per_unit: '',
  estimate_minutes: '',
  category: '',
  sort_order: '0',
  group_slug: '',
  group_title: '',
  variant_label: '',
  speed: '',
})

const pkgToForm = (pkg: Package): PackageForm => ({
  name: pkg.name,
  type: normalizePackageType(pkg.type),
  satuan_unit: normalizeSatuanUnit(pkg.unit),
  price_per_unit: String(Number(pkg.price_per_unit)),
  estimate_minutes:
    pkg.estimate_minutes != null && pkg.estimate_minutes > 0 ? String(pkg.estimate_minutes) : '',
  category: pkg.category ?? '',
  sort_order: pkg.sort_order != null ? String(pkg.sort_order) : '0',
  group_slug: pkg.group_slug ?? '',
  group_title: pkg.group_title ?? '',
  variant_label: pkg.variant_label ?? '',
  speed: pkg.speed === 'reguler' || pkg.speed === 'express' ? pkg.speed : '',
})

function formToApiPayload(form: PackageForm): Record<string, unknown> {
  const price = parseFloat(form.price_per_unit)
  const sortOrder = parseInt(form.sort_order, 10)
  return {
    name: form.name.trim(),
    type: form.type,
    price_per_unit: price,
    unit: form.type === 'kiloan' ? 'kg' : form.satuan_unit,
    estimate_minutes: form.estimate_minutes ? parseInt(form.estimate_minutes, 10) : 0,
    category: form.category.trim() || undefined,
    sort_order: Number.isFinite(sortOrder) && sortOrder >= 0 ? sortOrder : 0,
    group_slug: form.group_slug.trim() || undefined,
    group_title: form.group_title.trim() || undefined,
    variant_label: form.variant_label.trim() || undefined,
    speed: form.speed || undefined,
  }
}

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

function getPackageIcon(name: string, unit: string): string {
  const u = (unit || '').toLowerCase()
  if (u === 'lembar') return 'view_week'
  if (u === 'pcs' || u === 'pasang' || u === 'buah') return 'checkroom'
  if (name.toLowerCase().includes('setrika') && !name.toLowerCase().includes('cuci')) return 'iron'
  return 'laundry'
}

function apiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { message?: string } } })?.response?.data
  if (data?.message && typeof data.message === 'string') return data.message
  return fallback
}

function speedLabel(speed: string | null | undefined): string {
  if (speed === 'express') return 'Express'
  if (speed === 'reguler') return 'Reguler'
  return 'Netral'
}

export default function ServicePackages() {
  const { user } = useAuth()
  const canCreate = user?.permissions?.['layanan.create'] !== false
  const canEdit = user?.permissions?.['layanan.edit'] !== false
  const canDelete = user?.permissions?.['layanan.delete'] !== false

  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [typeFilter, setTypeFilter] = useState<'all' | 'kiloan' | 'satuan'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<PackageForm>(emptyForm())

  const [editOpen, setEditOpen] = useState(false)
  const [editPkg, setEditPkg] = useState<Package | null>(null)
  const [editForm, setEditForm] = useState<PackageForm>(emptyForm())

  const [deleteTarget, setDeleteTarget] = useState<Package | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const [sorting, setSorting] = useState<SortingState>([{ id: 'sort_order', desc: false }])
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 15 })
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const load = useCallback(() => {
    setLoading(true)
    servicePackagesApi
      .listAll()
      .then((r) => setPackages(Array.isArray(r.data) ? r.data : (r.data as { data?: Package[] })?.data ?? []))
      .catch(() => {
        setPackages([])
        toast.error('Gagal memuat layanan')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }, [debouncedSearch, typeFilter, statusFilter])

  useEffect(() => {
    setRowSelection({})
  }, [debouncedSearch, typeFilter, statusFilter, pagination.pageIndex, pagination.pageSize])

  const filteredRows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return packages.filter((p) => {
      if (typeFilter !== 'all' && normalizePackageType(p.type) !== typeFilter) return false
      if (statusFilter === 'active' && p.is_active === false) return false
      if (statusFilter === 'inactive' && p.is_active !== false) return false
      if (q) {
        const hay = [p.name, p.category, p.group_title, p.group_slug, p.variant_label]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [packages, typeFilter, statusFilter, debouncedSearch])

  const stats = useMemo(() => {
    const active = packages.filter((p) => p.is_active !== false).length
    return { total: packages.length, active, inactive: packages.length - active }
  }, [packages])

  const openEdit = useCallback((pkg: Package) => {
    setEditPkg(pkg)
    setEditForm(pkgToForm(pkg))
    setEditOpen(true)
  }, [])

  const closeEdit = useCallback(() => {
    setEditOpen(false)
    setEditPkg(null)
    setEditForm(emptyForm())
  }, [])

  const saveEdit = async () => {
    if (!editPkg) return
    const price = parseFloat(editForm.price_per_unit)
    if (!editForm.name.trim()) {
      toast.error('Nama layanan wajib diisi')
      return
    }
    if (isNaN(price) || price < 0) {
      toast.error('Harga tidak valid')
      return
    }
    setSaving(true)
    try {
      await servicePackagesApi.update(editPkg.id, formToApiPayload(editForm))
      toast.success('Layanan berhasil diperbarui')
      closeEdit()
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal menyimpan perubahan'))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = useCallback(
    async (pkg: Package) => {
      try {
        await servicePackagesApi.update(pkg.id, { is_active: !pkg.is_active })
        toast.success(pkg.is_active ? 'Layanan dinonaktifkan' : 'Layanan diaktifkan')
        load()
      } catch (err) {
        toast.error(apiErrorMessage(err, 'Gagal mengubah status'))
      }
    },
    [load]
  )

  const closeAdd = () => {
    setAddOpen(false)
    setAddForm(emptyForm())
  }

  const handleAdd = async () => {
    const price = parseFloat(addForm.price_per_unit)
    if (!addForm.name.trim()) {
      toast.error('Nama layanan wajib diisi')
      return
    }
    if (isNaN(price) || price < 0) {
      toast.error('Harga tidak valid')
      return
    }
    setSaving(true)
    try {
      await servicePackagesApi.create({
        ...formToApiPayload(addForm),
        is_active: true,
      })
      toast.success('Layanan berhasil ditambahkan')
      closeAdd()
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal menambahkan layanan'))
    } finally {
      setSaving(false)
    }
  }

  const confirmDeleteOne = async () => {
    if (!deleteTarget) return
    await servicePackagesApi.delete(deleteTarget.id)
    toast.success('Layanan dihapus')
    load()
  }

  const selectedIds = useMemo(() => {
    return Object.keys(rowSelection)
      .filter((k) => rowSelection[k])
      .map((k) => parseInt(k, 10))
      .filter((id) => !Number.isNaN(id))
  }, [rowSelection])

  const confirmBulkDelete = async () => {
    const targets = packages.filter((p) => selectedIds.includes(p.id) && p.deletable !== false)
    const skipped = selectedIds.length - targets.length
    let ok = 0
    let fail = 0
    for (const p of targets) {
      try {
        await servicePackagesApi.delete(p.id)
        ok++
      } catch {
        fail++
      }
    }
    if (ok) toast.success(`${ok} layanan dihapus`)
    if (fail) toast.error(`${fail} gagal dihapus`)
    if (skipped) toast.info(`${skipped} layanan dilewati (sudah dipakai di order)`)
    setRowSelection({})
    setBulkDeleteOpen(false)
    load()
  }

  const setServiceType = (
    setForm: Dispatch<SetStateAction<PackageForm>>,
    type: PackageForm['type']
  ) => {
    setForm((f) => ({ ...f, type }))
  }

  const renderFormFields = (
    form: PackageForm,
    setForm: Dispatch<SetStateAction<PackageForm>>,
    idPrefix: string
  ) => (
    <div className="space-y-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-name`} className={FIELD_LABEL_CLASS}>
          Nama Layanan <span className="text-destructive">*</span>
        </Label>
        <Input
          id={`${idPrefix}-name`}
          placeholder="Contoh: Cuci Kiloan"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className={INPUT_FIELD_CLASS}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className={FIELD_LABEL_CLASS}>Tipe layanan</span>
        <div className={TYPE_BUTTON_GRID_CLASS} role="group" aria-label="Tipe layanan">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setServiceType(setForm, opt.value)}
              className={cn(
                'min-h-11 w-full rounded-xl border px-3 py-2.5 text-center text-sm font-semibold transition-colors',
                'border-border bg-card',
                form.type === opt.value
                  ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/25'
                  : 'text-foreground hover:bg-muted/60'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Kiloan memakai unit kg. Satuan: pilih pcs, lembar, pasang, atau buah.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-category`} className={FIELD_LABEL_CLASS}>
            Kategori (opsional)
          </Label>
          <Input
            id={`${idPrefix}-category`}
            placeholder="mis. Kiloan, Bed cover"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            className={INPUT_FIELD_CLASS}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-sort`} className={FIELD_LABEL_CLASS}>
            Urutan tampil
          </Label>
          <Input
            id={`${idPrefix}-sort`}
            type="number"
            min={0}
            step={1}
            value={form.sort_order}
            onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
            className={INPUT_FIELD_CLASS}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-group-slug`} className={FIELD_LABEL_CLASS}>
            Grup (slug, opsional)
          </Label>
          <Input
            id={`${idPrefix}-group-slug`}
            placeholder="mis. cuci-setrika-kiloan"
            value={form.group_slug}
            onChange={(e) => setForm((f) => ({ ...f, group_slug: e.target.value }))}
            className={INPUT_FIELD_CLASS}
          />
          <p className="text-[11px] text-muted-foreground">
            Isi sama pada varian Reguler/Express agar digabung di form order.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-group-title`} className={FIELD_LABEL_CLASS}>
            Judul grup (opsional)
          </Label>
          <Input
            id={`${idPrefix}-group-title`}
            placeholder="mis. Cuci Setrika Kiloan"
            value={form.group_title}
            onChange={(e) => setForm((f) => ({ ...f, group_title: e.target.value }))}
            className={INPUT_FIELD_CLASS}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-variant`} className={FIELD_LABEL_CLASS}>
            Label varian (opsional)
          </Label>
          <Input
            id={`${idPrefix}-variant`}
            placeholder="mis. Reguler, Express 3 jam"
            value={form.variant_label}
            onChange={(e) => setForm((f) => ({ ...f, variant_label: e.target.value }))}
            className={INPUT_FIELD_CLASS}
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className={FIELD_LABEL_CLASS} id={`${idPrefix}-speed-label`}>
            Kecepatan (opsional)
          </span>
          <div
            className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-2"
            role="group"
            aria-labelledby={`${idPrefix}-speed-label`}
          >
            {(
              [
                { value: 'reguler' as const, label: 'Reguler' },
                { value: 'express' as const, label: 'Express' },
                { value: '' as const, label: 'Netral' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    speed: opt.value === '' ? '' : opt.value,
                  }))
                }
                className={cn(
                  'min-h-11 w-full rounded-xl border px-2 py-2.5 text-center text-sm font-semibold transition-colors',
                  'border-border bg-card',
                  (opt.value === '' ? form.speed === '' : form.speed === opt.value)
                    ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/25'
                    : 'text-foreground hover:bg-muted/60'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Netral = muncul di tab Reguler dan Express saat buat order.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-price`} className={FIELD_LABEL_CLASS}>
            Harga per Unit (Rp) <span className="text-destructive">*</span>
          </Label>
          <Input
            id={`${idPrefix}-price`}
            type="number"
            min={0}
            step={500}
            placeholder="7000"
            value={form.price_per_unit}
            onChange={(e) => setForm((f) => ({ ...f, price_per_unit: e.target.value }))}
            className={INPUT_FIELD_CLASS}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className={FIELD_LABEL_CLASS} id={`${idPrefix}-unit-label`}>
            Unit
          </span>
          {form.type === 'kiloan' ? (
            <div
              className={READONLY_UNIT_CLASS}
              role="status"
              aria-labelledby={`${idPrefix}-unit-label`}
              aria-live="polite"
            >
              kg
            </div>
          ) : (
            <Select
              value={form.satuan_unit}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  satuan_unit: v as PackageForm['satuan_unit'],
                }))
              }
            >
              <SelectTrigger className={cn(INPUT_FIELD_CLASS, 'h-11')} aria-labelledby={`${idPrefix}-unit-label`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SATUAN_UNIT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-est`} className={FIELD_LABEL_CLASS}>
          Estimasi selesai (menit, opsional)
        </Label>
        <Input
          id={`${idPrefix}-est`}
          type="number"
          min={0}
          step={15}
          placeholder="Kosongkan jika tidak dipakai"
          value={form.estimate_minutes}
          onChange={(e) => setForm((f) => ({ ...f, estimate_minutes: e.target.value }))}
          className={INPUT_FIELD_CLASS}
        />
      </div>
    </div>
  )

  const columns = useMemo<ColumnDef<Package>[]>(() => {
    const cols: ColumnDef<Package>[] = []
    if (canDelete) {
      cols.push(createSelectColumn<Package>())
    }
    cols.push(
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-3 h-8 gap-1 px-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Layanan
            <ArrowUpDownIcon className="size-3.5 opacity-60" />
          </Button>
        ),
        cell: ({ row }) => {
          const pkg = row.original
          const inactive = pkg.is_active === false
          return (
            <div className="flex items-center gap-3 min-w-0 max-w-[min(100%,280px)]">
              <div
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-lg',
                  inactive ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
                )}
              >
                <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {getPackageIcon(pkg.name, pkg.unit)}
                </span>
              </div>
              <div className="min-w-0">
                <p className={cn('font-headline font-semibold text-foreground truncate', inactive && 'opacity-70')}>
                  {pkg.name}
                </p>
                {pkg.estimate_minutes != null && pkg.estimate_minutes > 0 && (
                  <p className="text-xs text-muted-foreground">~{pkg.estimate_minutes} menit</p>
                )}
              </div>
            </div>
          )
        },
        sortingFn: 'alphanumeric',
      },
      {
        id: 'type',
        accessorFn: (row) => normalizePackageType(row.type),
        header: 'Tipe',
        cell: ({ row }) => (
          <Badge variant="secondary" className="font-medium">
            {formatTypeLabel(row.original.type)}
          </Badge>
        ),
      },
      {
        accessorKey: 'unit',
        header: 'Unit',
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.unit}</span>,
      },
      {
        accessorKey: 'price_per_unit',
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-3 h-8 gap-1 px-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Harga
            <ArrowUpDownIcon className="size-3.5 opacity-60" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="font-headline font-bold text-primary tabular-nums">
            {fmt(Number(row.original.price_per_unit))}
          </span>
        ),
        sortingFn: 'basic',
      },
      {
        id: 'meta',
        header: 'Grup / kategori',
        cell: ({ row }) => {
          const p = row.original
          const parts = [p.category, p.group_title || p.group_slug, p.variant_label].filter(Boolean)
          if (parts.length === 0) return <span className="text-sm text-muted-foreground">—</span>
          return (
            <p className="text-sm text-muted-foreground line-clamp-2 max-w-[200px]" title={parts.join(' · ')}>
              {parts.join(' · ')}
            </p>
          )
        },
        enableSorting: false,
      },
      {
        id: 'speed',
        accessorFn: (row) => row.speed ?? '',
        header: 'Kecepatan',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{speedLabel(row.original.speed)}</span>
        ),
      },
      {
        accessorKey: 'sort_order',
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-3 h-8 gap-1 px-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Urut
            <ArrowUpDownIcon className="size-3.5 opacity-60" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="tabular-nums text-sm text-muted-foreground">{row.original.sort_order ?? 0}</span>
        ),
        sortingFn: 'basic',
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const active = row.original.is_active !== false
          return (
            <Badge
              variant="outline"
              className={cn(
                'font-medium border',
                active
                  ? 'border-primary/35 bg-primary/10 text-primary'
                  : 'border-muted-foreground/25 bg-muted/50 text-muted-foreground'
              )}
            >
              {active ? 'Aktif' : 'Nonaktif'}
            </Badge>
          )
        },
        enableSorting: false,
      },
      {
        id: 'actions',
        header: () => (
          <span className="flex w-full justify-end text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Aksi
          </span>
        ),
        cell: ({ row }) => {
          const pkg = row.original
          const showActions = canEdit || (canDelete && pkg.deletable !== false)
          if (!showActions) {
            return (
              <div className="text-right text-xs text-muted-foreground max-w-[10rem] ml-auto">
                {canDelete && pkg.deletable === false
                  ? 'Sudah dipakai di order — nonaktifkan bila perlu.'
                  : '—'}
              </div>
            )
          }
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger
                  type="button"
                  className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-9 w-9 rounded-lg')}
                  aria-label="Menu aksi"
                >
                  <span className="material-symbols-outlined text-xl">more_vert</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[11rem]">
                  {canEdit && (
                    <DropdownMenuItem onClick={() => openEdit(pkg)}>
                      <span className="material-symbols-outlined mr-2 text-lg">edit</span>
                      Ubah
                    </DropdownMenuItem>
                  )}
                  {canEdit && (
                    <DropdownMenuItem onClick={() => toggleActive(pkg)}>
                      <span className="material-symbols-outlined mr-2 text-lg">
                        {pkg.is_active !== false ? 'visibility_off' : 'visibility'}
                      </span>
                      {pkg.is_active !== false ? 'Nonaktifkan' : 'Aktifkan'}
                    </DropdownMenuItem>
                  )}
                  {canDelete && pkg.deletable !== false && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteTarget(pkg)}
                      >
                        <span className="material-symbols-outlined mr-2 text-lg">delete</span>
                        Hapus
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
        enableSorting: false,
      }
    )
    return cols
  }, [canEdit, canDelete, openEdit, toggleActive])

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting, pagination, rowSelection },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => String(row.id),
    enableRowSelection: canDelete ? (row) => row.original.deletable !== false : false,
    sortDescFirst: false,
  })

  const pageCount = table.getPageCount()
  const currentPage = table.getState().pagination.pageIndex + 1
  const lastPage = Math.max(1, pageCount)
  const totalFiltered = filteredRows.length
  const { pageIndex, pageSize } = table.getState().pagination
  const from = totalFiltered === 0 ? null : pageIndex * pageSize + 1
  const to = Math.min((pageIndex + 1) * pageSize, totalFiltered)

  const emptyMsg =
    packages.length === 0
      ? 'Belum ada layanan. Tambahkan layanan pertama Anda.'
      : 'Tidak ada layanan yang cocok dengan filter atau pencarian.'

  const emptyColSpan = columns.length

  const formDialogShell = (title: string, description: string, children: ReactNode, footer: ReactNode) => (
    <DialogContent className="max-h-[min(90dvh,calc(100dvh-2rem))] max-w-lg overflow-hidden flex flex-col gap-0 rounded-2xl border border-border p-0 sm:max-w-xl">
      <div className="flex shrink-0 items-start gap-3 border-b border-border px-6 py-4">
        <span className="material-symbols-outlined text-primary text-2xl mt-0.5">dry_cleaning</span>
        <div className="min-w-0">
          <DialogTitle className="font-headline text-lg font-bold text-foreground">{title}</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">{description}</DialogDescription>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      <div className="shrink-0 flex flex-wrap justify-end gap-2 border-t border-border px-6 py-4">{footer}</div>
    </DialogContent>
  )

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6 p-4 font-body text-foreground sm:space-y-8 sm:p-6 lg:p-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-extrabold text-foreground sm:text-3xl">Layanan & Harga</h1>
          <p className="text-muted-foreground mt-1">
            Kelola layanan, harga per unit, dan varian Reguler/Express untuk form order.
          </p>
          {stats.total > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              {stats.total} layanan · {stats.active} aktif · {stats.inactive} nonaktif
            </p>
          )}
        </div>
        {canCreate && (
          <Button
            onClick={() => setAddOpen(true)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary/80 px-6 py-3 font-semibold text-primary-foreground shadow-lg shadow-primary/15 hover:brightness-110"
          >
            <span className="material-symbols-outlined text-xl">add</span>
            Tambah Layanan
          </Button>
        )}
      </div>

      <Card className="rounded-2xl border border-border/60 bg-card shadow-sm">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-full sm:min-w-[200px] sm:flex-1">
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Cari layanan
              </label>
              <div className="relative">
                <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">
                  search
                </span>
                <Input
                  type="search"
                  placeholder="Nama, kategori, grup, varian…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 rounded-xl border-border bg-background pl-10 focus-visible:ring-2 focus-visible:ring-primary/25"
                />
              </div>
            </div>
            <div className="w-full sm:w-[160px]">
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Tipe
              </label>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
                <SelectTrigger className="h-10 rounded-xl border-border bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="kiloan">Kiloan</SelectItem>
                  <SelectItem value="satuan">Satuan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-[160px]">
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Status
              </label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="h-10 rounded-xl border-border bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="active">Aktif saja</SelectItem>
                  <SelectItem value="inactive">Nonaktif saja</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-4">
            <strong className="text-foreground">Banyak layanan?</strong> Gunakan pencarian dan filter di atas. Tabel
            memakai <strong className="text-foreground">paginasi</strong> (atur jumlah baris per halaman di bawah). Urutan
            default mengikuti kolom &quot;Urut&quot; lalu nama; klik judul kolom untuk mengurutkan. Untuk ratusan item
            tetap nyaman di browser; jika nanti butuh ribuan entri, paginasi bisa dipindah ke API.
          </p>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={(o) => !o && closeAdd()}>
        {formDialogShell(
          'Layanan baru',
          'Isi detail harga dan unit. Grup/slug memetakan varian Reguler & Express di form order.',
          <form
            id="add-service-form"
            onSubmit={(e) => {
              e.preventDefault()
              handleAdd()
            }}
            className="space-y-0"
          >
            {renderFormFields(addForm, setAddForm, 'add')}
          </form>,
          <>
            <Button type="button" variant="ghost" onClick={closeAdd} disabled={saving}>
              Batal
            </Button>
            <Button type="submit" form="add-service-form" disabled={saving}>
              Simpan
            </Button>
          </>
        )}
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(o) => !o && closeEdit()}>
        {formDialogShell(
          'Ubah layanan',
          'Perbarui nama, harga, grup/varian, atau estimasi.',
          <div>{renderFormFields(editForm, setEditForm, 'edit')}</div>,
          <>
            <Button type="button" variant="ghost" onClick={closeEdit} disabled={saving}>
              Batal
            </Button>
            <Button type="button" onClick={saveEdit} disabled={saving}>
              Simpan
            </Button>
          </>
        )}
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Hapus layanan?"
        description={
          deleteTarget ? `Layanan "${deleteTarget.name}" akan dihapus permanen dari daftar.` : undefined
        }
        confirmLabel="Hapus"
        variant="destructive"
        onConfirm={async () => {
          try {
            await confirmDeleteOne()
          } catch (err) {
            toast.error(apiErrorMessage(err, 'Gagal menghapus layanan'))
            setDeleteTarget(null)
            throw err
          }
        }}
      />

      <AlertDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Hapus layanan terpilih?"
        description="Hanya layanan yang belum pernah dipakai di order yang akan dihapus. Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Hapus"
        variant="destructive"
        onConfirm={confirmBulkDelete}
      />

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

        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm">
          <DataTable
            table={table}
            loading={loading}
            emptyMessage={emptyMsg}
            emptyColSpan={emptyColSpan}
          />
          {totalFiltered > 0 && (
            <div className="flex flex-col gap-3 border-t border-border/60 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:bg-muted/10">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Baris per halaman</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => {
                    if (v == null) return
                    const n = parseInt(v, 10)
                    if (!Number.isFinite(n)) return
                    table.setPageSize(n)
                    table.setPageIndex(0)
                  }}
                >
                  <SelectTrigger className="h-8 w-[4.5rem] rounded-lg border-border text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PER_PAGE_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DataTablePagination
                currentPage={currentPage}
                lastPage={lastPage}
                from={from}
                to={to}
                total={totalFiltered}
                onPageChange={(p) => table.setPageIndex(p - 1)}
                itemLabel="layanan"
                className="border-0 bg-transparent px-0 py-0 sm:justify-end"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
