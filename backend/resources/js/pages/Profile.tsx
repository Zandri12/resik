import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'
import { authApi } from '../services/authApi'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials } from '@/lib/avatar-initials'

export default function Profile() {
  const { user, refreshUser } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')

  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [removingAvatar, setRemovingAvatar] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name)
      setEmail(user.email)
    }
  }, [user])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSavingProfile(true)
    try {
      const payload: Parameters<typeof authApi.updateProfile>[0] = {}
      if (name.trim() !== user.name) payload.name = name.trim()
      if (email.trim() !== user.email) payload.email = email.trim()
      if (password) {
        payload.password = password
        payload.password_confirmation = passwordConfirmation
        payload.current_password = currentPassword
      }
      if (Object.keys(payload).length === 0) {
        toast.message('Tidak ada perubahan')
        return
      }
      await authApi.updateProfile(payload)
      toast.success('Profil berhasil diperbarui')
      setCurrentPassword('')
      setPassword('')
      setPasswordConfirmation('')
      await refreshUser()
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response?.data
          : undefined
      const first =
        msg?.message ??
        (msg?.errors && Object.values(msg.errors).flat()[0]) ??
        'Gagal menyimpan profil'
      toast.error(typeof first === 'string' ? first : 'Gagal menyimpan profil')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingAvatar(true)
    try {
      await authApi.uploadAvatar(file)
      toast.success('Foto profil diperbarui')
      await refreshUser()
    } catch (err: unknown) {
      const data =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response
              ?.data
          : undefined
      const first =
        data?.message ??
        (data?.errors?.avatar?.[0] ?? (data?.errors && Object.values(data.errors).flat()[0])) ??
        'Gagal mengunggah foto'
      toast.error(typeof first === 'string' ? first : 'Gagal mengunggah foto')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleRemoveAvatar = async () => {
    setRemovingAvatar(true)
    try {
      await authApi.deleteAvatar()
      toast.success('Foto profil dihapus')
      await refreshUser()
    } catch {
      toast.error('Gagal menghapus foto')
    } finally {
      setRemovingAvatar(false)
    }
  }

  if (!user) return null

  const roleLabel =
    user.role === 'owner' ? 'Owner' : user.role === 'admin' ? 'Admin' : 'Karyawan'

  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sm sm:p-6">
        <h2 className="font-headline font-bold text-lg mb-6">Foto profil</h2>
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <Avatar size="lg" className="ring-2 ring-outline-variant/20">
            {user.avatar_url ? (
              <AvatarImage src={user.avatar_url} alt="" />
            ) : null}
            <AvatarFallback delay={0}>{getInitials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={uploadingAvatar}
                onClick={() => fileRef.current?.click()}
                className="primary-gradient px-4 py-2 rounded-xl font-bold text-sm text-on-primary disabled:opacity-50"
              >
                {uploadingAvatar ? 'Mengunggah...' : 'Unggah foto'}
              </button>
              {user.avatar_url ? (
                <button
                  type="button"
                  disabled={removingAvatar}
                  onClick={handleRemoveAvatar}
                  className="px-4 py-2 rounded-xl font-bold text-sm border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50"
                >
                  {removingAvatar ? 'Menghapus...' : 'Hapus foto'}
                </button>
              ) : null}
            </div>
            <p className="text-xs text-on-surface-variant">JPEG, PNG, atau WebP, maks. 2 MB.</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sm sm:p-6">
        <h2 className="font-headline font-bold text-lg mb-6">Data akun</h2>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1">Nama</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
              autoComplete="name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1">Peran</label>
            <input
              type="text"
              value={roleLabel}
              readOnly
              className="w-full bg-surface-container-high/50 border border-outline-variant/20 rounded-xl px-4 py-3 text-on-surface-variant cursor-not-allowed"
            />
          </div>

          <div className="pt-2 border-t border-outline-variant/15">
            <p className="text-sm font-medium text-on-surface mb-3">Ganti kata sandi</p>
            <p className="text-xs text-on-surface-variant mb-3">Kosongkan jika tidak ingin mengubah kata sandi.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1">
                  Kata sandi saat ini
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1">Kata sandi baru</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1">
                  Konfirmasi kata sandi baru
                </label>
                <input
                  type="password"
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="primary-gradient px-5 py-2.5 rounded-xl font-bold text-sm text-on-primary disabled:opacity-50"
          >
            {savingProfile ? 'Menyimpan...' : 'Simpan perubahan'}
          </button>
        </form>
      </div>
    </div>
  )
}
