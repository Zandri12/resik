import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { usersApi } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner', desc: 'Akses penuh dan dapat mengatur owner lain' },
  { value: 'admin', label: 'Admin', desc: 'Akses penuh ke semua fitur' },
  { value: 'karyawan', label: 'Karyawan', desc: 'Akses sesuai hak yang diatur' },
]

export default function UserForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const isEdit = !!id
  const isOwner = currentUser?.role === 'owner'
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    passwordConfirm: '',
    role: 'karyawan',
  })

  const roles = useMemo(() => {
    if (!isEdit) return ROLE_OPTIONS.filter((r) => r.value !== 'owner')
    if (form.role === 'owner' && !isOwner) return [] // Admin editing owner: read-only
    return isOwner ? ROLE_OPTIONS : ROLE_OPTIONS.filter((r) => r.value !== 'owner')
  }, [isEdit, form.role, isOwner])

  const roleReadOnly = isEdit && form.role === 'owner' && !isOwner

  useEffect(() => {
    if (isEdit && id) {
      usersApi
        .get(Number(id))
        .then((r) => {
          const u = r.data as { name: string; email: string; role: string }
          setForm((f) => ({ ...f, name: u.name, email: u.email, role: u.role }))
        })
        .catch(() => toast.error('Gagal memuat user'))
    }
  }, [isEdit, id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isEdit && form.password !== form.passwordConfirm) {
      toast.error('Konfirmasi password tidak cocok')
      return
    }
    setLoading(true)
    try {
      if (isEdit && id) {
        await usersApi.update(Number(id), {
          name: form.name,
          email: form.email,
          password: form.password || undefined,
          role: form.role,
        })
        toast.success('User diperbarui')
      } else {
        await usersApi.create({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
        })
        toast.success('User ditambahkan')
      }
      navigate('/dashboard/users')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
      const msg = err.response?.data?.errors
        ? Object.values(err.response.data.errors).flat().join(', ')
        : err.response?.data?.message ?? 'Gagal menyimpan'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const selectedRole = ROLE_OPTIONS.find((r) => r.value === form.role)

  return (
    <div className="flex-1 min-w-0 w-full overflow-y-auto overflow-x-clip bg-background p-4 font-body text-on-background sm:p-6 lg:p-10">
      <div className="mx-auto w-full min-w-0 max-w-6xl">
        <div className="flex items-center gap-2 text-sm mb-6">
          <Link to="/dashboard/users" className="text-on-surface-variant font-medium hover:text-primary">
            Users
          </Link>
          <span className="material-symbols-outlined text-outline text-sm">chevron_right</span>
          <span className="text-on-surface font-bold">{isEdit ? 'Edit User' : 'Tambah User'}</span>
        </div>

        <header className="mb-10">
          <h2 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl lg:text-4xl">
            {isEdit ? 'Edit User' : 'Tambah User Baru'}
          </h2>
          <p className="text-on-surface-variant mt-2 max-w-2xl">
            {isEdit
              ? 'Perbarui data user dan role.'
              : 'Tambahkan user baru untuk mengakses sistem. Pilih role Admin atau Karyawan.'}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="grid grid-cols-12 items-start gap-6 sm:gap-8">
          <div className="col-span-12 lg:col-span-8 space-y-8">
            {/* Informasi Akun */}
            <section className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4 custom-shadow sm:p-8">
              <div className="flex items-center gap-3 pb-6 border-b border-outline-variant/10 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
                  <span className="material-symbols-outlined">person</span>
                </div>
                <h3 className="text-lg font-headline font-bold text-on-surface">Informasi Akun</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-on-surface-variant">
                    Nama Lengkap <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Contoh: Budi Santoso"
                    required
                    className="h-12 px-4 py-3 bg-surface-container-low border-0 rounded-lg focus-visible:ring-2 focus-visible:ring-surface-tint/40 text-on-surface placeholder:text-outline transition-all"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-on-surface-variant">
                    Email <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="email@example.com"
                    required
                    disabled={isEdit}
                    className="h-12 px-4 py-3 bg-surface-container-low border-0 rounded-lg focus-visible:ring-2 focus-visible:ring-surface-tint/40 text-on-surface placeholder:text-outline transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                  />
                  {isEdit && (
                    <p className="text-xs text-on-surface-variant">Email tidak dapat diubah</p>
                  )}
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-on-surface-variant">
                    Password {isEdit && <span className="font-normal text-outline">(kosongkan jika tidak diubah)</span>}
                  </label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder={isEdit ? '••••••••' : 'Min. 8 karakter'}
                    minLength={isEdit ? 0 : 8}
                    required={!isEdit}
                    className="h-12 px-4 py-3 bg-surface-container-low border-0 rounded-lg focus-visible:ring-2 focus-visible:ring-surface-tint/40 text-on-surface placeholder:text-outline transition-all max-w-md"
                  />
                </div>
                {!isEdit && (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-on-surface-variant">
                      Konfirmasi Password <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="password"
                      value={form.passwordConfirm}
                      onChange={(e) => setForm((f) => ({ ...f, passwordConfirm: e.target.value }))}
                      placeholder="Ulangi password"
                      minLength={8}
                      required
                      className="h-12 px-4 py-3 bg-surface-container-low border-0 rounded-lg focus-visible:ring-2 focus-visible:ring-surface-tint/40 text-on-surface placeholder:text-outline transition-all max-w-md"
                    />
                  </div>
                )}
              </div>
            </section>

            {/* Role & Akses */}
            <section className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4 custom-shadow sm:p-8">
              <div className="flex items-center gap-3 pb-6 border-b border-outline-variant/10 mb-6">
                <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center">
                  <span className="material-symbols-outlined">badge</span>
                </div>
                <h3 className="text-lg font-headline font-bold text-on-surface">Role & Akses</h3>
              </div>
              <div className="space-y-4">
                <label className="text-sm font-bold text-on-surface-variant">Role</label>
                {roleReadOnly ? (
                  <div className="inline-flex px-4 py-2 rounded-xl bg-primary/10 border-2 border-primary/30 text-on-surface font-semibold">
                    Owner
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {roles.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, role: r.value }))}
                        className={cn(
                          'flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all',
                          form.role === r.value
                            ? 'border-primary bg-primary/5'
                            : 'border-outline-variant/20 bg-surface-container-low hover:border-outline-variant/40'
                        )}
                      >
                        <span className="font-semibold text-on-surface">{r.label}</span>
                        <span className="text-xs text-on-surface-variant mt-1">{r.desc}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Sticky Summary */}
          <div className="col-span-12 lg:col-span-4">
            <div className="lg:sticky lg:top-10 space-y-6">
              <div className="bg-surface-container-lowest rounded-xl overflow-hidden custom-shadow border border-outline-variant/10">
                <div className="bg-primary p-6 text-on-primary">
                  <h3 className="text-sm font-bold uppercase tracking-widest opacity-90">
                    Ringkasan
                  </h3>
                  <p className="text-2xl font-headline font-bold mt-1 truncate">
                    {form.name || 'Nama user'}
                  </p>
                  <p className="text-sm opacity-90 truncate mt-0.5">
                    {form.email || 'email@example.com'}
                  </p>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                      Role
                    </p>
                    <div
                      className={cn(
                        'inline-flex px-3 py-1.5 rounded-lg text-sm font-semibold capitalize',
                        form.role === 'owner'
                          ? 'bg-primary/20 text-primary'
                          : form.role === 'admin'
                            ? 'bg-secondary-container text-on-secondary-container'
                            : 'bg-surface-container-high text-on-surface-variant'
                      )}
                    >
                      {selectedRole?.label ?? form.role}
                    </div>
                  </div>
                  <div className="pt-4 flex flex-col gap-3">
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gradient-to-br from-primary to-primary-container text-on-primary hover:opacity-90 py-3 rounded-xl font-bold custom-shadow border-0"
                    >
                      {loading ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Tambah User'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate('/dashboard/users')}
                      className="w-full py-3 rounded-xl"
                    >
                      Batal
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
