import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { servicePackagesApi } from '../services/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { AlertDialog } from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'

/** Selaras dengan CustomerForm / halaman form utama */
const FIELD_LABEL_CLASS = 'text-sm font-bold text-on-surface-variant'
const INPUT_FIELD_CLASS =
  'w-full h-12 px-4 py-3 bg-surface-container-low border-0 rounded-lg focus-visible:ring-2 focus-visible:ring-surface-tint/40 text-on-surface placeholder:text-outline transition-all'
const READONLY_UNIT_CLASS =
  'flex h-12 w-full items-center rounded-lg bg-surface-container-low px-4 text-sm font-medium text-on-surface'
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
  /** false jika layanan sudah pernah dipakai di order (hapus diblokir di server). */
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

/** Samakan variasi nilai dari API/DB; data lama bertipe paket diperlakukan sebagai kiloan. */
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

export default function ServicePackages() {
  const { user } = useAuth()
  const canCreate = user?.permissions?.['layanan.create'] !== false
  const canEdit = user?.permissions?.['layanan.edit'] !== false
  const canDelete = user?.permissions?.['layanan.delete'] !== false
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState<PackageForm>(emptyForm())

  const [editOpen, setEditOpen] = useState(false)
  const [editPkg, setEditPkg] = useState<Package | null>(null)
  const [editForm, setEditForm] = useState<PackageForm>(emptyForm())

  const [deleteTarget, setDeleteTarget] = useState<Package | null>(null)

  const load = () => {
    servicePackagesApi
      .listAll()
      .then((r) => setPackages(Array.isArray(r.data) ? r.data : (r.data as { data?: Package[] })?.data ?? []))
      .catch(() => setPackages([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const openEdit = (pkg: Package) => {
    setEditPkg(pkg)
    setEditForm(pkgToForm(pkg))
    setEditOpen(true)
  }

  const closeEdit = () => {
    setEditOpen(false)
    setEditPkg(null)
    setEditForm(emptyForm())
  }

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

  const toggleActive = async (pkg: Package) => {
    try {
      await servicePackagesApi.update(pkg.id, { is_active: !pkg.is_active })
      toast.success(pkg.is_active ? 'Layanan dinonaktifkan' : 'Layanan diaktifkan')
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal mengubah status'))
    }
  }

  const resetAddForm = () => {
    setAddForm(emptyForm())
    setShowAddForm(false)
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
      resetAddForm()
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal menambahkan layanan'))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    await servicePackagesApi.delete(deleteTarget.id)
    toast.success('Layanan dihapus')
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
    <div className="space-y-6">
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
                'min-h-11 w-full rounded-lg border px-3 py-2.5 text-center text-sm font-semibold transition-colors',
                'border-outline-variant/40 bg-surface-container-lowest',
                form.type === opt.value
                  ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/25'
                  : 'text-on-surface hover:border-outline-variant/60 hover:bg-surface-container-high'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-on-surface-variant">
          Kiloan memakai unit kg. Satuan: pilih pcs, lembar, pasang, atau buah.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-6">
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

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-6">
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
          <p className="text-[11px] text-on-surface-variant">Isi sama pada varian Reguler/Express agar digabung di form order.</p>
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

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-6">
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
                { value: '' as const, label: 'Tidak membedakan' },
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
                  'min-h-11 w-full rounded-lg border px-2 py-2.5 text-center text-sm font-semibold transition-colors',
                  'border-outline-variant/40 bg-surface-container-lowest',
                  (opt.value === '' ? form.speed === '' : form.speed === opt.value)
                    ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/25'
                    : 'text-on-surface hover:border-outline-variant/60 hover:bg-surface-container-high'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-on-surface-variant leading-snug">
            Tidak membedakan = layanan muncul di tab Reguler dan Express saat buat order. Pilih Reguler atau Express
            jika harga/SLA hanya untuk salah satu tipe.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-6">
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
              <SelectTrigger
                className={`${INPUT_FIELD_CLASS} h-12`}
                aria-labelledby={`${idPrefix}-unit-label`}
              >
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

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-6 p-4 font-body text-on-surface sm:space-y-8 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-extrabold text-on-surface sm:text-3xl">
            Layanan & Harga
          </h1>
          <p className="text-on-surface-variant mt-1">
            Kelola layanan dan kustomisasi harga per unit.
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={() => setShowAddForm((v) => !v)}
            className="bg-primary text-on-primary hover:bg-primary/90 shrink-0"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Tambah Layanan
          </Button>
        )}
      </div>

      {showAddForm && canCreate && (
        <Card className="rounded-xl border-2 border-primary/30 bg-primary/5 shadow-none">
          <CardContent className="p-4 sm:p-8">
            <div className="mb-6 flex items-center gap-3 border-b border-outline-variant/10 pb-4">
              <span className="material-symbols-outlined text-primary">dry_cleaning</span>
              <h3 className="font-headline text-lg font-bold text-on-surface">Layanan Baru</h3>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleAdd()
              }}
              className="space-y-6"
            >
              {renderFormFields(addForm, setAddForm, 'add')}
              <div className="flex flex-wrap justify-end gap-2 border-t border-outline-variant/10 pt-6">
                <Button type="button" variant="ghost" onClick={resetAddForm} disabled={saving}>
                  Batal
                </Button>
                <Button type="submit" disabled={saving} className="bg-primary text-on-primary hover:bg-primary/90">
                  Simpan Layanan
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Dialog open={editOpen} onOpenChange={(o) => !o && closeEdit()}>
        <DialogContent className="max-h-[min(90vh,calc(100dvh-2rem))] max-w-lg overflow-y-auto rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-0 text-on-surface shadow-lg sm:max-w-xl">
          <div className="flex items-center gap-3 border-b border-outline-variant/10 px-6 py-4">
            <span className="material-symbols-outlined text-primary">edit</span>
            <div>
              <DialogTitle className="font-headline text-lg font-bold text-on-surface">Ubah Layanan</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-on-surface-variant">
                Perbarui nama, harga, grup/varian (Reguler/Express), unit satuan (termasuk lembar), atau estimasi.
              </DialogDescription>
            </div>
          </div>
          <div className="space-y-6 px-6 py-6">
            {renderFormFields(editForm, setEditForm, 'edit')}
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-outline-variant/10 px-6 py-4">
            <Button type="button" variant="ghost" onClick={closeEdit} disabled={saving}>
              Batal
            </Button>
            <Button
              type="button"
              onClick={saveEdit}
              disabled={saving}
              className="bg-primary text-on-primary hover:bg-primary/90"
            >
              Simpan
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Hapus layanan?"
        description={
          deleteTarget
            ? `Layanan "${deleteTarget.name}" akan dihapus permanen dari daftar.`
            : undefined
        }
        confirmLabel="Hapus"
        variant="destructive"
        onConfirm={async () => {
          try {
            await confirmDelete()
          } catch (err) {
            toast.error(apiErrorMessage(err, 'Gagal menghapus layanan'))
            setDeleteTarget(null)
            throw err
          }
        }}
      />

      {loading ? (
        <div className="py-12 text-center text-on-surface-variant">Memuat...</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {packages.map((pkg) => (
            <Card
              key={pkg.id}
              className={cn(
                'rounded-xl border-2 transition-all',
                pkg.is_active === false
                  ? 'opacity-60 border-outline-variant/30 bg-surface-container-low'
                  : 'border-outline-variant/20 bg-surface-container-lowest'
              )}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
                        pkg.is_active !== false ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface-variant'
                      )}
                    >
                      <span
                        className="material-symbols-outlined text-2xl"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        {getPackageIcon(pkg.name, pkg.unit)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-on-surface truncate">{pkg.name}</h3>
                      <p className="text-sm text-on-surface-variant">
                        <span className="font-medium text-on-surface/90">
                          {formatTypeLabel(pkg.type)}
                        </span>
                        <span className="text-on-surface-variant"> · </span>
                        per {pkg.unit}
                        {pkg.speed === 'reguler' || pkg.speed === 'express'
                          ? ` · ${pkg.speed === 'express' ? 'Express' : 'Reguler'}`
                          : ''}
                      </p>
                      {(pkg.variant_label || pkg.group_slug || pkg.category) && (
                        <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">
                          {pkg.category ? `${pkg.category} · ` : ''}
                          {pkg.group_title || pkg.group_slug || ''}
                          {pkg.variant_label ? ` — ${pkg.variant_label}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <p className="font-headline font-bold text-lg text-primary">
                      {fmt(Number(pkg.price_per_unit))}
                    </p>
                    <div className="flex flex-wrap justify-end gap-1">
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs"
                          onClick={() => openEdit(pkg)}
                        >
                          Ubah
                        </Button>
                      )}
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs"
                          onClick={() => toggleActive(pkg)}
                        >
                          {pkg.is_active !== false ? 'Nonaktifkan' : 'Aktifkan'}
                        </Button>
                      )}
                      {canDelete && pkg.deletable !== false && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget(pkg)}
                        >
                          Hapus
                        </Button>
                      )}
                    </div>
                    {canDelete && pkg.deletable === false && (
                      <p className="max-w-[12rem] text-right text-[11px] leading-snug text-on-surface-variant">
                        Sudah dipakai di order — nonaktifkan bila tidak ingin ditampilkan.
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
