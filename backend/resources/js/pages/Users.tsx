import { useEffect, useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
  type RowSelectionState,
} from '@tanstack/react-table'
import { usersApi, rolePermissionsApi, type UsersListMeta } from '../services/api'
import { Badge } from '@/components/ui/badge'
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
import { useAuth } from '../contexts/AuthContext'
import { useDebounce } from '../hooks/useDebounce'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  DataTable,
  DataTableBulkBar,
  DataTablePagination,
  createSelectColumn,
} from '@/components/data-table'

interface UserRow {
  id: number
  name: string
  email: string
  role: string
  created_at: string
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  karyawan: 'Karyawan',
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function Users() {
  const { user: currentUser } = useAuth()
  const canCreate = currentUser?.permissions?.['users.create'] !== false
  const canEdit = currentUser?.permissions?.['users.edit'] !== false
  const canDelete = currentUser?.permissions?.['users.delete'] !== false
  const canManagePermissions = currentUser?.role === 'owner' || currentUser?.role === 'admin'

  const [list, setList] = useState<UserRow[]>([])
  const [meta, setMeta] = useState<UsersListMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [roleFilter, setRoleFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<'name' | 'email' | 'role' | 'created_at'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [activeTab, setActiveTab] = useState<'users' | 'permissions'>('users')
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const [resetPasswordUser, setResetPasswordUser] = useState<{ user: UserRow; password: string } | null>(null)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const [rolePermsData, setRolePermsData] = useState<{
    permissions: Record<string, Record<string, boolean>>
    groups: Record<string, string[]>
    labels: Record<string, string>
  } | null>(null)
  const [savingPerms, setSavingPerms] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, roleFilter])

  useEffect(() => {
    setLoading(true)
    usersApi
      .list({
        search: debouncedSearch || undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
        page,
        per_page: 15,
        sort_by: sortBy,
        sort_order: sortOrder,
      })
      .then((r) => {
        const data = r.data as { data?: UserRow[]; meta?: UsersListMeta }
        setList(data.data ?? [])
        setMeta(data.meta ?? null)
      })
      .catch(() => toast.error('Gagal memuat daftar user'))
      .finally(() => setLoading(false))
  }, [debouncedSearch, roleFilter, page, sortBy, sortOrder])

  useEffect(() => {
    setRowSelection({})
  }, [page, debouncedSearch, roleFilter, sortBy, sortOrder])

  useEffect(() => {
    if (canManagePermissions) {
      rolePermissionsApi
        .list()
        .then((r) => setRolePermsData(r.data ?? null))
        .catch(() => {})
    }
  }, [canManagePermissions])

  const stats = useMemo(() => {
    if (meta?.counts) {
      return {
        owner: meta.counts.owner,
        admin: meta.counts.admin,
        karyawan: meta.counts.karyawan,
        total: meta.total,
      }
    }
    const owner = list.filter((u) => u.role === 'owner').length
    const admin = list.filter((u) => u.role === 'admin').length
    const karyawan = list.filter((u) => u.role === 'karyawan').length
    return { owner, admin, karyawan, total: list.length }
  }, [list, meta])

  const handleSort = useCallback((col: 'name' | 'email' | 'role' | 'created_at') => {
    setSortBy(col)
    setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    setPage(1)
  }, [])

  const handleDelete = useCallback((u: UserRow) => {
    if (u.id === currentUser?.id) {
      toast.error('Tidak dapat menghapus akun sendiri')
      return
    }
    if (u.role === 'owner') {
      toast.error('Tidak dapat menghapus owner')
      return
    }
    setDeleteTarget(u)
  }, [currentUser?.id])

  const refetchList = useCallback(() => {
    setLoading(true)
    usersApi
      .list({
        search: debouncedSearch || undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
        page,
        per_page: 15,
        sort_by: sortBy,
        sort_order: sortOrder,
      })
      .then((r) => {
        const data = r.data as { data?: UserRow[]; meta?: UsersListMeta }
        setList(data.data ?? [])
        setMeta(data.meta ?? null)
      })
      .catch(() => toast.error('Gagal memuat daftar user'))
      .finally(() => setLoading(false))
  }, [debouncedSearch, roleFilter, page, sortBy, sortOrder])

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await usersApi.delete(deleteTarget.id)
      if (list.length === 1 && meta && meta.current_page > 1) {
        setPage(meta.current_page - 1)
      } else {
        refetchList()
      }
      toast.success('User dihapus')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err.response?.data?.message ?? 'Gagal menghapus')
    } finally {
      setDeleteTarget(null)
    }
  }

  const handleResetPassword = useCallback(async (u: UserRow) => {
    try {
      const r = await usersApi.resetPassword(u.id)
      setResetPasswordUser({ user: u, password: r.data.temporary_password })
      toast.success('Password berhasil direset')
    } catch {
      toast.error('Gagal reset password')
    }
  }, [])

  const selectedIds = useMemo(() => {
    return Object.keys(rowSelection)
      .filter((k) => rowSelection[k])
      .map((k) => parseInt(k, 10))
      .filter((id) => !Number.isNaN(id))
  }, [rowSelection])

  const columns = useMemo<ColumnDef<UserRow>[]>(() => {
    return [
      createSelectColumn<UserRow>(),
      {
        id: 'name',
        header: () => (
          <button
            type="button"
            onClick={() => handleSort('name')}
            className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface flex items-center gap-1"
          >
            Nama
            {sortBy === 'name' && (
              <span className="material-symbols-outlined text-sm">
                {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
              </span>
            )}
          </button>
        ),
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        id: 'email',
        header: () => (
          <button
            type="button"
            onClick={() => handleSort('email')}
            className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface flex items-center gap-1"
          >
            Email
            {sortBy === 'email' && (
              <span className="material-symbols-outlined text-sm">
                {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
              </span>
            )}
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-on-surface-variant">{row.original.email}</span>
        ),
      },
      {
        id: 'role',
        header: () => (
          <button
            type="button"
            onClick={() => handleSort('role')}
            className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface flex items-center gap-1"
          >
            Role
            {sortBy === 'role' && (
              <span className="material-symbols-outlined text-sm">
                {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
              </span>
            )}
          </button>
        ),
        cell: ({ row }) => {
          const u = row.original
          return (
            <Badge
              variant={
                u.role === 'owner' ? 'default' : u.role === 'admin' ? 'secondary' : 'outline'
              }
              className="capitalize"
            >
              {ROLE_LABELS[u.role] ?? u.role}
            </Badge>
          )
        },
      },
      {
        id: 'created_at',
        header: () => (
          <button
            type="button"
            onClick={() => handleSort('created_at')}
            className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface flex items-center gap-1"
          >
            Bergabung
            {sortBy === 'created_at' && (
              <span className="material-symbols-outlined text-sm">
                {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
              </span>
            )}
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-sm text-on-surface-variant">{formatDate(row.original.created_at)}</span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="block text-right w-full text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Aksi</span>,
        cell: ({ row }) => {
          const u = row.original
          return (
            <div className="text-right">
              {u.role !== 'owner' && (canEdit || canDelete) && (
                <div className="flex justify-end gap-1">
                  {canEdit && (
                    <>
                      <Link to={`/dashboard/users/${u.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit">
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </Button>
                      </Link>
                      {u.id !== currentUser?.id &&
                        !(u.role === 'owner' && currentUser?.role !== 'owner') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Reset Password"
                            onClick={() => handleResetPassword(u)}
                          >
                            <span className="material-symbols-outlined text-lg">key</span>
                          </Button>
                        )}
                    </>
                  )}
                  {canDelete && u.id !== currentUser?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      title="Hapus"
                      onClick={() => handleDelete(u)}
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </Button>
                  )}
                </div>
              )}
            </div>
          )
        },
      },
    ]
  }, [
    sortBy,
    sortOrder,
    handleSort,
    canEdit,
    canDelete,
    currentUser?.id,
    currentUser?.role,
    handleDelete,
    handleResetPassword,
  ])

  const table = useReactTable({
    data: list,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: meta?.last_page ?? 0,
    getRowId: (row) => String(row.id),
    enableRowSelection: true,
  })

  const confirmBulkDelete = async () => {
    const allowed = list.filter(
      (u) =>
        selectedIds.includes(u.id) &&
        u.id !== currentUser?.id &&
        u.role !== 'owner'
    )
    if (allowed.length === 0) {
      toast.error('Tidak ada user terpilih yang dapat dihapus')
      setBulkDeleteOpen(false)
      return
    }
    let ok = 0
    let fail = 0
    for (const u of allowed) {
      try {
        await usersApi.delete(u.id)
        ok++
      } catch {
        fail++
      }
    }
    if (ok) toast.success(`${ok} user dihapus`)
    if (fail) toast.error(`${fail} gagal dihapus`)
    setRowSelection({})
    setBulkDeleteOpen(false)
    if (list.length === ok && meta && meta.current_page > 1) {
      setPage(meta.current_page - 1)
    } else {
      refetchList()
    }
  }

  const togglePerm = async (key: string, next: boolean) => {
    const perm = rolePermsData?.permissions.karyawan ?? {}
    const updated = { ...perm, [key]: next }
    setSavingPerms(true)
    try {
      await rolePermissionsApi.update('karyawan', updated)
      setRolePermsData((p) =>
        p ? { ...p, permissions: { ...p.permissions, karyawan: updated } } : null
      )
      toast.success('Hak akses diperbarui')
    } catch {
      toast.error('Gagal menyimpan')
    } finally {
      setSavingPerms(false)
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6 p-4 font-body text-on-surface sm:space-y-8 sm:p-6 lg:p-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-extrabold text-on-surface sm:text-3xl">
            Manajemen User
          </h1>
          <p className="text-on-surface-variant mt-1">
            Kelola user, role, dan hak akses per role.
          </p>
        </div>
        {canCreate && (
          <Link to="/dashboard/users/new">
            <Button className="bg-gradient-to-br from-primary to-primary-container text-on-primary hover:opacity-90">
              <span className="material-symbols-outlined mr-2">person_add</span>
              Tambah User
            </Button>
          </Link>
        )}
      </div>

      {/* Tabs */}
      {canManagePermissions && (
        <div className="flex flex-wrap gap-2 border-b border-outline-variant/20 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
              activeTab === 'users'
                ? 'bg-primary text-on-primary'
                : 'text-on-surface-variant hover:bg-surface-container-high'
            )}
          >
            Daftar User
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('permissions')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
              activeTab === 'permissions'
                ? 'bg-primary text-on-primary'
                : 'text-on-surface-variant hover:bg-surface-container-high'
            )}
          >
            Hak Akses
          </button>
        </div>
      )}

      {activeTab === 'users' && (
        <>
          {/* Stats label when filter active */}
          {(debouncedSearch || roleFilter !== 'all') && meta && (
            <p className="text-sm text-on-surface-variant">
              Menampilkan {meta.total > 0 ? `${(meta.current_page - 1) * meta.per_page + 1}-${Math.min(meta.current_page * meta.per_page, meta.total)}` : '0'} dari {meta.total} user
            </p>
          )}

          {/* Stats */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 sm:gap-4">
            <Card className="bg-surface-container-low border-0">
              <CardContent className="p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Total
                </p>
                <p className="text-2xl font-headline font-bold text-on-surface mt-1">
                  {stats.total}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-surface-container-low border-0">
              <CardContent className="p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Owner
                </p>
                <p className="text-2xl font-headline font-bold text-primary mt-1">{stats.owner}</p>
              </CardContent>
            </Card>
            <Card className="bg-surface-container-low border-0">
              <CardContent className="p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Admin
                </p>
                <p className="text-2xl font-headline font-bold text-secondary mt-1">{stats.admin}</p>
              </CardContent>
            </Card>
            <Card className="bg-surface-container-low border-0">
              <CardContent className="p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Karyawan
                </p>
                <p className="text-2xl font-headline font-bold text-on-surface mt-1">
                  {stats.karyawan}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Search & Filter */}
          <Card className="bg-surface-container-low rounded-2xl border-0">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="w-full sm:min-w-[200px] sm:flex-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                    Cari
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
                      search
                    </span>
                    <Input
                      type="text"
                      placeholder="Nama atau email..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10 bg-surface-container-lowest rounded-xl border-outline-variant/30 h-10"
                    />
                  </div>
                </div>
                <div className="w-full sm:min-w-[160px]">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                    Role
                  </label>
                  <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v ?? 'all')}>
                    <SelectTrigger className="h-10 bg-surface-container-lowest rounded-xl border-outline-variant/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Role</SelectItem>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="karyawan">Karyawan</SelectItem>
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
                emptyMessage={
                  search || roleFilter !== 'all'
                    ? 'Tidak ada user yang cocok.'
                    : 'Belum ada user.'
                }
                emptyColSpan={6}
              />
              {meta && meta.last_page > 0 && (
                <DataTablePagination
                  currentPage={meta.current_page}
                  lastPage={meta.last_page}
                  from={
                    meta.total > 0 ? (meta.current_page - 1) * meta.per_page + 1 : null
                  }
                  to={
                    meta.total > 0
                      ? Math.min(meta.current_page * meta.per_page, meta.total)
                      : null
                  }
                  total={meta.total}
                  onPageChange={(p) => setPage(p)}
                  itemLabel="user"
                />
              )}
            </div>
          </div>
        </>
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Hapus User"
        description={deleteTarget ? `Yakin ingin menghapus user ${deleteTarget.name}? Tindakan ini tidak dapat dibatalkan.` : ''}
        confirmLabel="Hapus"
        variant="destructive"
        onConfirm={confirmDelete}
      />

      <AlertDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Hapus user terpilih?"
        description="User yang dipilih akan dihapus permanen (owner dan akun sendiri dilewati). Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Hapus"
        variant="destructive"
        onConfirm={confirmBulkDelete}
      />

      {/* Reset password result */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setResetPasswordUser(null)}
            aria-hidden
          />
          <div className="relative z-50 w-full max-w-md rounded-xl bg-surface-container-lowest p-6 shadow-lg border border-outline-variant/20">
            <h2 className="font-headline font-bold text-lg text-on-surface">Password Berhasil Direset</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              Password sementara untuk {resetPasswordUser.user.name}:
            </p>
            <p className="mt-2 p-3 rounded-lg bg-surface-container-high font-mono text-sm break-all">
              {resetPasswordUser.password}
            </p>
            <p className="mt-2 text-xs text-on-surface-variant">
              Salin password ini dan berikan ke user. User disarankan mengubah password setelah login.
            </p>
            <Button className="mt-4 w-full" onClick={() => setResetPasswordUser(null)}>
              Tutup
            </Button>
          </div>
        </div>
      )}

      {activeTab === 'permissions' && canManagePermissions && (
        <div className="bg-surface-container-lowest rounded-xl shadow-sm p-6 border border-outline-variant/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="font-headline font-bold text-lg">Hak Akses Role Karyawan</h2>
              <p className="text-sm text-on-surface-variant mt-1">
                Toggle menu = akses halaman. Toggle sub-fitur = aksi (tambah, edit, hapus).
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!rolePermsData) return
                  const allKeys = Object.keys(rolePermsData.labels)
                  const updated = Object.fromEntries(allKeys.map((k) => [k, true]))
                  setSavingPerms(true)
                  rolePermissionsApi
                    .update('karyawan', updated)
                    .then(() => {
                      setRolePermsData((p) =>
                        p ? { ...p, permissions: { ...p.permissions, karyawan: updated } } : null
                      )
                      toast.success('Semua akses diaktifkan')
                    })
                    .catch(() => toast.error('Gagal'))
                    .finally(() => setSavingPerms(false))
                }}
                disabled={savingPerms}
              >
                Aktifkan Semua
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!rolePermsData) return
                  const perm = rolePermsData.permissions.karyawan ?? {}
                  const userKeys = ['users', 'users.create', 'users.edit', 'users.delete']
                  const updated = { ...perm }
                  userKeys.forEach((k) => { updated[k] = false })
                  setSavingPerms(true)
                  rolePermissionsApi
                    .update('karyawan', updated)
                    .then(() => {
                      setRolePermsData((p) =>
                        p ? { ...p, permissions: { ...p.permissions, karyawan: updated } } : null
                      )
                      toast.success('Akses manajemen user dinonaktifkan')
                    })
                    .catch(() => toast.error('Gagal'))
                    .finally(() => setSavingPerms(false))
                }}
                disabled={savingPerms}
              >
                Nonaktifkan Akses User
              </Button>
            </div>
          </div>
          {rolePermsData ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(rolePermsData.groups).map(([moduleKey, subKeys]) => {
                const perm = rolePermsData.permissions.karyawan ?? {}
                const labels = rolePermsData.labels
                const moduleLabel = labels[moduleKey] ?? moduleKey
                const moduleEnabled = perm?.[moduleKey] !== false
                return (
                  <div
                    key={moduleKey}
                    className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/20"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-on-surface text-sm">{moduleLabel}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={moduleEnabled}
                        onClick={() => togglePerm(moduleKey, !moduleEnabled)}
                        disabled={savingPerms}
                        className={cn(
                          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50',
                          moduleEnabled ? 'bg-primary' : 'bg-outline-variant/30'
                        )}
                      >
                        <span
                          className={cn(
                            'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition',
                            moduleEnabled ? 'translate-x-4' : 'translate-x-0.5'
                          )}
                        />
                      </button>
                    </div>
                    {subKeys.length > 0 && (
                      <div className="pl-3 border-l-2 border-outline-variant/20 space-y-2">
                        {subKeys.map((subKey) => {
                          const subLabel = labels[subKey] ?? subKey
                          const subEnabled = perm?.[subKey] !== false
                          return (
                            <div
                              key={subKey}
                              className="flex items-center justify-between text-xs"
                            >
                              <span className="text-on-surface-variant">{subLabel}</span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={subEnabled}
                                onClick={() => togglePerm(subKey, !subEnabled)}
                                disabled={savingPerms || !moduleEnabled}
                                className={cn(
                                  'relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed',
                                  subEnabled ? 'bg-primary/80' : 'bg-outline-variant/20'
                                )}
                              >
                                <span
                                  className={cn(
                                    'pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition',
                                    subEnabled ? 'translate-x-3' : 'translate-x-0.5'
                                  )}
                                />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant">Memuat...</p>
          )}
        </div>
      )}
    </div>
  )
}
