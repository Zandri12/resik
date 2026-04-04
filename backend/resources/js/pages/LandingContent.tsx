import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
  type RowSelectionState,
} from '@tanstack/react-table'
import {
  landingContentsApi,
  type LandingContentItem,
  type LandingContentKind,
} from '@/services/api'
import { useDebounce } from '@/hooks/useDebounce'
import { LandingContentEditor } from '@/components/LandingContentEditor'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DataTable,
  DataTableBulkBar,
  DataTablePagination,
  createSelectColumn,
} from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { AlertDialog } from '@/components/ui/alert-dialog'
import { cn, firstImageUrlFromHtml, looksLikeHtml } from '@/lib/utils'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'

const KIND_LABEL: Record<LandingContentKind, string> = {
  promo: 'Promo',
  pengumuman: 'Pengumuman',
  info: 'Info',
}

function suggestSlugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Gambar kartu landing: gambar pertama di HTML, atau tetap pakai URL lama saat isi masih Markdown / HTML tanpa gambar. */
function resolveLandingCardImage(body: string | null, initialCardImage: string | null): string | null {
  const b = body?.trim() ?? ''
  if (!b) return null
  if (looksLikeHtml(b)) {
    const fromImg = firstImageUrlFromHtml(b)
    if (fromImg) return fromImg
    return initialCardImage
  }
  return initialCardImage
}

const emptyForm = () => ({
  title: '',
  slug: '',
  excerpt: '',
  body: '',
  kind: 'promo' as LandingContentKind,
  link_url: '',
  cta_label: '',
  sort_order: '0',
  is_active: true,
})

export default function LandingContent() {
  const { user } = useAuth()
  const canCreate = user?.permissions?.['landing_content.create'] !== false
  const canEdit = user?.permissions?.['landing_content.edit'] !== false
  const canDelete = user?.permissions?.['landing_content.delete'] !== false

  const [items, setItems] = useState<LandingContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<LandingContentItem | null>(null)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  /** URL gambar kartu dari server; dipakai jika isi Markdown atau HTML tanpa gambar. */
  const [initialCardImageUrl, setInitialCardImageUrl] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)
  const [kindFilter, setKindFilter] = useState<'all' | LandingContentKind>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [meta, setMeta] = useState({
    total: 0,
    last_page: 1,
    current_page: 1,
    per_page: 10,
    from: null as number | null,
    to: null as number | null,
  })
  const [refreshKey, setRefreshKey] = useState(0)

  const bumpRefresh = () => setRefreshKey((k) => k + 1)

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, kindFilter, statusFilter, perPage])

  useEffect(() => {
    setRowSelection({})
  }, [page, debouncedSearch, kindFilter, statusFilter, perPage, refreshKey])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    landingContentsApi
      .list({
        page,
        per_page: perPage,
        search: debouncedSearch.trim() || undefined,
        kind: kindFilter === 'all' ? undefined : kindFilter,
        status: statusFilter,
      })
      .then((r) => {
        if (cancelled) return
        const d = r.data
        if (d.total > 0 && d.data.length === 0 && d.current_page > d.last_page) {
          setPage(d.last_page)
          return
        }
        setItems(d.data)
        setMeta({
          total: d.total,
          last_page: d.last_page,
          current_page: d.current_page,
          per_page: d.per_page,
          from: d.from ?? null,
          to: d.to ?? null,
        })
      })
      .catch(() => {
        if (!cancelled) {
          setItems([])
          toast.error('Gagal memuat konten landing')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [page, perPage, debouncedSearch, kindFilter, statusFilter, refreshKey])

  const resetForm = () => {
    setEditingId(null)
    setForm(emptyForm())
    setInitialCardImageUrl(null)
    setShowForm(false)
  }

  const startEdit = useCallback((row: LandingContentItem) => {
    setEditingId(row.id)
    setInitialCardImageUrl(row.image_url ?? null)
    setForm({
      title: row.title,
      slug: row.slug ?? '',
      excerpt: row.excerpt ?? '',
      body: row.body ?? '',
      kind: row.kind,
      link_url: row.link_url ?? '',
      cta_label: row.cta_label ?? '',
      sort_order: String(row.sort_order ?? 0),
      is_active: row.is_active !== false,
    })
    setShowForm(true)
  }, [])

  const submit = async () => {
    if (!form.title.trim()) {
      toast.error('Judul wajib diisi')
      return
    }
    const sort = parseInt(form.sort_order, 10)
    if (Number.isNaN(sort) || sort < 0) {
      toast.error('Urutan tidak valid')
      return
    }
    const basePayload = {
      title: form.title.trim(),
      body: form.body.trim() || null,
      excerpt: form.excerpt.trim() || null,
      kind: form.kind,
      image_url: resolveLandingCardImage(form.body, initialCardImageUrl),
      link_url: form.link_url.trim() || null,
      cta_label: form.cta_label.trim() || null,
      sort_order: sort,
      is_active: form.is_active,
    }
    setSaving(true)
    try {
      if (editingId != null) {
        await landingContentsApi.update(editingId, {
          ...basePayload,
          slug: form.slug.trim(),
        })
        toast.success('Konten diperbarui')
      } else {
        await landingContentsApi.create({
          ...basePayload,
          ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
        })
        toast.success('Konten ditambahkan')
      }
      resetForm()
      bumpRefresh()
    } catch {
      toast.error(editingId != null ? 'Gagal memperbarui' : 'Gagal menambah')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = useCallback(
    async (row: LandingContentItem) => {
      if (!canEdit) return
      try {
        await landingContentsApi.update(row.id, { is_active: !row.is_active })
        toast.success(row.is_active ? 'Disembunyikan dari landing' : 'Ditampilkan di landing')
        bumpRefresh()
      } catch {
        toast.error('Gagal mengubah status')
      }
    },
    [canEdit]
  )

  const handleDelete = async () => {
    if (!deleteTarget) return
    await landingContentsApi.delete(deleteTarget.id)
    toast.success('Konten dihapus')
    setDeleteTarget(null)
    bumpRefresh()
  }

  const selectedIds = useMemo(() => {
    return Object.keys(rowSelection)
      .filter((k) => rowSelection[k])
      .map((k) => parseInt(k, 10))
      .filter((id) => !Number.isNaN(id))
  }, [rowSelection])

  const columns = useMemo<ColumnDef<LandingContentItem>[]>(() => {
    return [
      createSelectColumn<LandingContentItem>(),
      {
        accessorKey: 'title',
        header: 'Judul',
        cell: ({ row }) => (
          <span className="font-medium max-w-[220px] line-clamp-2">{row.original.title}</span>
        ),
      },
      {
        accessorKey: 'slug',
        header: () => <span className="hidden lg:table-cell">Slug</span>,
        cell: ({ row }) => (
          <span className="hidden lg:table-cell max-w-[120px] align-top">
            {row.original.slug ? (
              <a
                href={`/konten/${row.original.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-primary hover:underline line-clamp-2 break-all"
              >
                {row.original.slug}
              </a>
            ) : (
              <span className="text-xs text-on-surface-variant">—</span>
            )}
          </span>
        ),
      },
      {
        id: 'kind',
        header: 'Jenis',
        cell: ({ row }) => {
          const rowKind = row.original.kind
          return (
            <Badge
              variant="secondary"
              className={cn(
                rowKind === 'promo' && 'bg-primary/15 text-primary',
                rowKind === 'pengumuman' && 'bg-palette-sky/20 text-on-surface',
                rowKind === 'info' && 'bg-muted text-muted-foreground'
              )}
            >
              {KIND_LABEL[rowKind]}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'sort_order',
        header: () => <span className="w-[100px]">Urut</span>,
        cell: ({ row }) => row.original.sort_order,
      },
      {
        id: 'active',
        header: () => <span className="w-[120px]">Aktif</span>,
        cell: ({ row }) => {
          const item = row.original
          return canEdit ? (
            <div className="flex items-center gap-2">
              <Switch
                checked={item.is_active !== false}
                onCheckedChange={() => toggleActive(item)}
                aria-label="Aktif di landing"
              />
            </div>
          ) : item.is_active !== false ? (
            <span className="text-xs text-on-surface-variant">Ya</span>
          ) : (
            <span className="text-xs text-on-surface-variant">Tidak</span>
          )
        },
      },
      {
        id: 'actions',
        header: () => <span className="text-right w-[200px] block">Aksi</span>,
        cell: ({ row }) => {
          const r = row.original
          return (
            <div className="flex justify-end gap-2 flex-wrap">
              {canEdit && (
                <Button type="button" variant="outline" size="sm" onClick={() => startEdit(r)}>
                  Ubah
                </Button>
              )}
              {canDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteTarget(r)}
                >
                  Hapus
                </Button>
              )}
            </div>
          )
        },
      },
    ]
  }, [canEdit, canDelete, startEdit, toggleActive])

  const table = useReactTable({
    data: items,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: meta.last_page,
    getRowId: (row) => String(row.id),
    enableRowSelection: true,
  })

  const confirmBulkDelete = async () => {
    let ok = 0
    for (const id of selectedIds) {
      try {
        await landingContentsApi.delete(id)
        ok++
      } catch {
        toast.error(`Gagal menghapus #${id}`)
      }
    }
    if (ok) toast.success(`${ok} konten dihapus`)
    setRowSelection({})
    setBulkDeleteOpen(false)
    bumpRefresh()
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 p-4 font-body text-on-surface sm:space-y-8 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-extrabold text-primary tracking-tight">
            Konten landing
          </h1>
          <p className="text-on-surface-variant text-sm mt-1 max-w-2xl">
            Isi panjang disusun dengan <strong className="text-on-surface">editor CKEditor</strong> (teks, gambar,
            tabel). Gambar kartu di landing diambil dari gambar pertama di isi bila ada. Pengunjung membuka halaman
            detail lewat &quot;Baca selengkapnya&quot;. Daftar di bawah memakai halaman &amp; pencarian agar tetap
            ringan bila konten banyak.
          </p>
        </div>
        {canCreate && (
          <Button
            type="button"
            onClick={() => {
              if (showForm && editingId == null) {
                resetForm()
              } else {
                setEditingId(null)
                setInitialCardImageUrl(null)
                setForm(emptyForm())
                setShowForm(true)
              }
            }}
            className="shrink-0"
          >
            {showForm && editingId == null ? 'Batal' : 'Tambah konten'}
          </Button>
        )}
      </div>

      {showForm && (canCreate || (editingId != null && canEdit)) && (
        <Card className="border-outline-variant/20 shadow-sm">
          <CardHeader>
            <CardTitle className="font-headline text-lg">
              {editingId != null ? 'Ubah konten' : 'Konten baru'}
            </CardTitle>
            <CardDescription>
              Yang aktif muncul di carousel landing. Ringkasan di kartu memakai cuplikan di bawah; halaman{' '}
              <code className="text-xs bg-muted px-1 rounded">/konten/slug</code> menampilkan isi lengkap (HTML atau
              konten lama Markdown).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="lc-title">Judul</Label>
                <Input
                  id="lc-title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Contoh: Diskon 20% order pertama"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <Label htmlFor="lc-slug">Slug URL (opsional)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit shrink-0"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        slug: suggestSlugFromTitle(f.title) || f.slug,
                      }))
                    }
                  >
                    Isi dari judul
                  </Button>
                </div>
                <Input
                  id="lc-slug"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="kosongkan agar server buat otomatis dari judul"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-on-surface-variant">
                  URL publik: /konten/<span className="font-mono text-on-surface">slug-anda</span>. Kosongkan saat
                  buat baru agar dibuat otomatis. Edit: kosongkan lalu simpan untuk generate ulang dari judul.
                </p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="lc-excerpt">Cuplikan (kartu landing)</Label>
                <Textarea
                  id="lc-excerpt"
                  rows={2}
                  value={form.excerpt}
                  onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
                  placeholder="Ringkas untuk tampilan carousel. Kosong = otomatis dari awal isi."
                  className="resize-y min-h-[60px]"
                />
              </div>
              <div className="space-y-2">
                <Label>Jenis</Label>
                <Select
                  value={form.kind}
                  onValueChange={(v) => setForm((f) => ({ ...f, kind: v as LandingContentKind }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(KIND_LABEL) as LandingContentKind[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {KIND_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lc-sort">Urutan tampil</Label>
                <Input
                  id="lc-sort"
                  type="number"
                  min={0}
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="lc-body">Isi</Label>
                <LandingContentEditor
                  id="lc-body"
                  value={form.body}
                  onChange={(html) => setForm((f) => ({ ...f, body: html }))}
                  disabled={saving}
                />
                <p className="text-xs text-on-surface-variant">
                  Unggah gambar dari toolbar (ikon gambar). Konten lama berbasis Markdown tetap diproses di halaman
                  publik.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lc-cta">Teks tombol (opsional)</Label>
                <Input
                  id="lc-cta"
                  value={form.cta_label}
                  onChange={(e) => setForm((f) => ({ ...f, cta_label: e.target.value }))}
                  placeholder="Pesan sekarang"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lc-link">URL tombol (opsional)</Label>
                <Input
                  id="lc-link"
                  value={form.link_url}
                  onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))}
                  placeholder="https://wa.me/..."
                />
              </div>
              <div className="flex items-center gap-3 sm:col-span-2 pt-2">
                <Switch
                  id="lc-active"
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                />
                <Label htmlFor="lc-active" className="cursor-pointer">
                  Tampilkan di landing page
                </Label>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button type="button" onClick={submit} disabled={saving}>
                {saving ? 'Menyimpan...' : editingId != null ? 'Simpan perubahan' : 'Simpan'}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                Batal
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-outline-variant/20 shadow-sm">
        <CardHeader className="space-y-4">
          <div>
            <CardTitle className="font-headline text-lg">Daftar konten</CardTitle>
            <CardDescription>
              Nonaktifkan tanpa menghapus agar mudah diaktifkan lagi nanti. Gunakan filter dan pencarian
              untuk menemukan entri cepat.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="min-w-0 flex-1 space-y-2 sm:min-w-[200px]">
              <Label htmlFor="lc-search" className="text-xs text-on-surface-variant">
                Cari judul atau isi
              </Label>
              <Input
                id="lc-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ketik untuk mencari..."
                className="w-full max-w-md"
              />
            </div>
            <div className="space-y-2 w-full sm:w-44">
              <Label className="text-xs text-on-surface-variant">Jenis</Label>
              <Select
                value={kindFilter}
                onValueChange={(v) => setKindFilter(v as typeof kindFilter)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua jenis</SelectItem>
                  {(Object.keys(KIND_LABEL) as LandingContentKind[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {KIND_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 w-full sm:w-44">
              <Label className="text-xs text-on-surface-variant">Status di landing</Label>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="inactive">Nonaktif</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 w-full sm:w-36">
              <Label className="text-xs text-on-surface-variant">Per halaman</Label>
              <Select
                value={String(perPage)}
                onValueChange={(v) => setPerPage(Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
            <div className="rounded-xl overflow-hidden border border-outline-variant/15">
              <DataTable
                table={table}
                loading={loading}
                emptyMessage={
                  meta.total === 0
                    ? 'Belum ada konten. Tambahkan promo atau pengumuman untuk ditampilkan di landing.'
                    : 'Tidak ada hasil untuk filter ini. Ubah pencarian atau filter.'
                }
                emptyColSpan={7}
              />
              {!loading && meta.last_page > 0 && (
                <DataTablePagination
                  currentPage={meta.current_page}
                  lastPage={meta.last_page}
                  from={meta.from}
                  to={meta.to}
                  total={meta.total}
                  onPageChange={(p) => setPage(p)}
                  itemLabel="konten"
                  className="border-t border-outline-variant/15"
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Hapus konten?"
        description={
          deleteTarget
            ? `"${deleteTarget.title}" akan dihapus permanen dari daftar.`
            : undefined
        }
        confirmLabel="Hapus"
        variant="destructive"
        onConfirm={handleDelete}
      />

      <AlertDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Hapus konten terpilih?"
        description={`${selectedIds.length} item akan dihapus permanen.`}
        confirmLabel="Hapus"
        variant="destructive"
        onConfirm={confirmBulkDelete}
      />
    </div>
  )
}
