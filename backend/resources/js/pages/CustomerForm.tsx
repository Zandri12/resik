import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { customersApi } from '../services/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export default function CustomerForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    note: '',
    is_blacklisted: false,
    is_member: false,
    member_discount: '' as number | '',
    member_valid_from: '',
    member_valid_until: '',
  })

  useEffect(() => {
    if (!isNew && id) {
      customersApi.get(Number(id)).then((r) => {
        const d = r.data as {
          name: string
          phone: string
          email?: string | null
          address?: string | null
          note?: string | null
          is_blacklisted?: boolean
          is_member?: boolean
          member_discount?: number | null
          member_valid_from?: string | null
          member_valid_until?: string | null
        }
        setForm({
          name: d.name,
          phone: d.phone,
          email: d.email || '',
          address: d.address || '',
          note: d.note || '',
          is_blacklisted: Boolean(d.is_blacklisted),
          is_member: Boolean(d.is_member),
          member_discount: d.member_discount != null ? Number(d.member_discount) : '',
          member_valid_from: d.member_valid_from ? String(d.member_valid_from).slice(0, 10) : '',
          member_valid_until: d.member_valid_until ? String(d.member_valid_until).slice(0, 10) : '',
        })
      })
    }
  }, [id, isNew])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const payload = {
      ...form,
      member_discount: form.is_member && form.member_discount !== '' ? Number(form.member_discount) : null,
      member_valid_from:
        form.is_member && form.member_valid_from.trim() ? form.member_valid_from.trim() : null,
      member_valid_until:
        form.is_member && form.member_valid_until.trim() ? form.member_valid_until.trim() : null,
    }
    try {
      if (isNew) {
        await customersApi.create(payload)
      } else {
        await customersApi.update(Number(id), payload)
      }
      navigate('/dashboard/customers')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 min-w-0 w-full overflow-y-auto overflow-x-clip bg-background p-4 font-body text-on-background sm:p-6 lg:p-10">
      <div className="mx-auto w-full min-w-0 max-w-6xl">
        <header className="mb-10">
          <h2 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl lg:text-4xl">
            {isNew ? 'Tambah Pelanggan Baru' : 'Edit Pelanggan'}
          </h2>
          <p className="text-on-surface-variant mt-2 max-w-2xl">
            {isNew
              ? 'Lengkapi informasi detail pelanggan di bawah ini untuk memulai layanan laundry premium kami.'
              : 'Perbarui data pelanggan.'}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="grid grid-cols-12 gap-6 sm:gap-10">
          <div className="col-span-12 lg:col-span-8">
            <div className="space-y-8 rounded-xl bg-surface-container-lowest p-4 custom-shadow sm:p-8">
              {/* Section: Informasi Identitas (stitch) */}
              <section className="space-y-6">
                <div className="flex items-center gap-3 pb-2 border-b border-outline-variant/10">
                  <span className="material-symbols-outlined text-primary">person</span>
                  <h3 className="text-lg font-headline font-bold text-on-surface">Informasi Identitas</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-on-surface-variant" htmlFor="nama">
                      Nama Lengkap <span className="text-destructive">*</span>
                    </label>
                    <Input
                      id="nama"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Contoh: Budi Santoso"
                      className="w-full h-12 px-4 py-3 bg-surface-container-low border-0 rounded-lg focus-visible:ring-2 focus-visible:ring-surface-tint/40 text-on-surface placeholder:text-outline transition-all"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-on-surface-variant" htmlFor="phone">
                      Nomor Telepon <span className="text-destructive">*</span>
                    </label>
                    <Input
                      id="phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="0812 XXXX XXXX"
                      className="w-full h-12 px-4 py-3 bg-surface-container-low border-0 rounded-lg focus-visible:ring-2 focus-visible:ring-surface-tint/40 text-on-surface placeholder:text-outline transition-all"
                      required
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-on-surface-variant" htmlFor="alamat">
                    Alamat Lengkap
                  </label>
                  <textarea
                    id="alamat"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Masukkan detail alamat rumah atau kantor..."
                    rows={4}
                    className={cn(
                      'w-full px-4 py-3 bg-surface-container-low border-0 rounded-lg focus:ring-2 focus:ring-surface-tint/40 text-on-surface placeholder:text-outline transition-all resize-none outline-none text-sm'
                    )}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-on-surface-variant" htmlFor="catatan">
                    Catatan
                  </label>
                  <textarea
                    id="catatan"
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    placeholder="Catatan internal untuk tim (mis. preferensi, riwayat masalah)..."
                    rows={3}
                    className={cn(
                      'w-full px-4 py-3 bg-surface-container-low border-0 rounded-lg focus:ring-2 focus:ring-surface-tint/40 text-on-surface placeholder:text-outline transition-all resize-none outline-none text-sm'
                    )}
                  />
                </div>
              </section>

              {/* Blacklist */}
              <section className="space-y-4">
                <div className="flex items-center gap-3 pb-2 border-b border-outline-variant/10">
                  <span className="material-symbols-outlined text-destructive">block</span>
                  <h3 className="text-lg font-headline font-bold text-on-surface">Blacklist</h3>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 bg-surface-container-low rounded-xl border-2 border-transparent hover:border-outline-variant/30 transition-all">
                  <div className="space-y-1">
                    <p className="font-headline font-bold text-on-surface">Tandai sebagai blacklist</p>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      Pelanggan blacklist tetap bisa dipilih di order, namun akan ditampilkan peringatan untuk kasir.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Switch
                      id="blacklist"
                      checked={form.is_blacklisted}
                      onCheckedChange={(v) => setForm({ ...form, is_blacklisted: v })}
                      className="data-checked:bg-destructive"
                    />
                    <Label htmlFor="blacklist" className="cursor-pointer text-sm font-semibold text-on-surface-variant">
                      {form.is_blacklisted ? 'Blacklist' : 'Aktif'}
                    </Label>
                  </div>
                </div>
              </section>

              {/* Section: Status Member (opsional) */}
              <section className="space-y-4">
                <div className="flex items-center gap-3 pb-2 border-b border-outline-variant/10">
                  <span className="material-symbols-outlined text-primary">workspace_premium</span>
                  <h3 className="text-lg font-headline font-bold text-on-surface">Status Member</h3>
                </div>
                <label className="flex items-center gap-4 cursor-pointer group p-5 bg-surface-container-low rounded-xl border-2 border-transparent hover:border-outline-variant/30 transition-all has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input
                    type="checkbox"
                    checked={form.is_member}
                    onChange={(e) => setForm({ ...form, is_member: e.target.checked })}
                    className="size-5 rounded border-outline-variant text-primary focus:ring-2 focus:ring-primary/40 cursor-pointer"
                  />
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary">loyalty</span>
                    <div>
                      <p className="font-headline font-bold text-on-surface">Pelanggan Member</p>
                      <p className="text-xs text-on-surface-variant leading-relaxed mt-0.5">
                        Centang jika pelanggan terdaftar sebagai member untuk mendapatkan benefit khusus.
                      </p>
                    </div>
                  </div>
                </label>
                {form.is_member && (
                  <div className="flex flex-col gap-4 p-5 bg-primary/5 rounded-xl border border-primary/10">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <label
                          className="text-sm font-bold text-on-surface-variant"
                          htmlFor="member_valid_from"
                        >
                          Berlaku mulai
                        </label>
                        <Input
                          id="member_valid_from"
                          type="date"
                          value={form.member_valid_from}
                          onChange={(e) =>
                            setForm({ ...form, member_valid_from: e.target.value })
                          }
                          className="h-12 px-4 bg-surface-container-low border-0 rounded-lg focus-visible:ring-2 focus-visible:ring-primary/40"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label
                          className="text-sm font-bold text-on-surface-variant"
                          htmlFor="member_valid_until"
                        >
                          Berlaku sampai
                        </label>
                        <Input
                          id="member_valid_until"
                          type="date"
                          value={form.member_valid_until}
                          onChange={(e) =>
                            setForm({ ...form, member_valid_until: e.target.value })
                          }
                          className="h-12 px-4 bg-surface-container-low border-0 rounded-lg focus-visible:ring-2 focus-visible:ring-primary/40"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-on-surface-variant -mt-1">
                      Kosongkan kedua tanggal jika membership tidak dibatasi periode. Diskon hanya berlaku di antara tanggal ini (inklusif).
                    </p>
                    <div className="flex flex-col gap-2 pt-1 border-t border-primary/10">
                      <label className="text-sm font-bold text-on-surface-variant" htmlFor="member_discount">
                        Diskon Member (%)
                      </label>
                      <div className="flex items-center gap-3 max-w-[200px]">
                        <Input
                          id="member_discount"
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={form.member_discount}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              member_discount: e.target.value === '' ? '' : parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder="Contoh: 5, 10, 15"
                          className="h-12 px-4 bg-surface-container-low border-0 rounded-lg focus-visible:ring-2 focus-visible:ring-primary/40"
                        />
                        <span className="text-on-surface-variant font-medium">%</span>
                      </div>
                      <p className="text-xs text-on-surface-variant">
                        Owner dapat mengatur persentase diskon untuk member ini. Diskon akan otomatis diterapkan saat buat order.
                      </p>
                    </div>
                  </div>
                )}
              </section>

              {/* Action Buttons (stitch) */}
              <div className="flex items-center justify-end gap-4 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate('/dashboard/customers')}
                  className="px-8 py-3 rounded-lg bg-surface-container text-on-surface-variant font-bold hover:bg-surface-container-high"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 rounded-lg bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold custom-shadow hover:brightness-110 transition-all flex items-center gap-2 border-0"
                >
                  <span className="material-symbols-outlined text-lg">save</span>
                  {loading ? 'Menyimpan...' : 'Simpan Pelanggan'}
                </Button>
              </div>
            </div>
          </div>

          {/* Helper Column / Sidebar (stitch) */}
          <div className="hidden lg:col-span-4 lg:flex flex-col gap-6">
            <div className="bg-primary/5 p-6 rounded-xl border border-primary/10">
              <h4 className="font-headline font-bold text-primary mb-3">Keuntungan Pelanggan</h4>
              <ul className="space-y-4">
                <li className="flex gap-3 text-sm">
                  <span className="material-symbols-outlined text-primary text-lg shrink-0">loyalty</span>
                  <p className="text-on-surface-variant leading-tight">
                    Pelanggan baru otomatis mendapatkan voucher potongan 10rb.
                  </p>
                </li>
                <li className="flex gap-3 text-sm">
                  <span className="material-symbols-outlined text-primary text-lg shrink-0">history</span>
                  <p className="text-on-surface-variant leading-tight">
                    Data transaksi akan tersimpan selamanya untuk histori pencucian.
                  </p>
                </li>
                <li className="flex gap-3 text-sm">
                  <span className="material-symbols-outlined text-primary text-lg shrink-0">notifications_active</span>
                  <p className="text-on-surface-variant leading-tight">
                    Pelanggan akan menerima notifikasi otomatis via WhatsApp saat laundry selesai.
                  </p>
                </li>
              </ul>
            </div>
            <div className="bg-surface-container-lowest p-6 rounded-xl custom-shadow">
              <h4 className="font-headline font-bold text-on-surface mb-3 text-sm uppercase tracking-wider">
                Pratinjau Kartu
              </h4>
              <div className="w-full aspect-[1.6/1] bg-gradient-to-br from-primary to-secondary p-6 rounded-lg relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div className="flex justify-between items-start">
                    <span className="material-symbols-outlined text-on-primary/50 text-3xl">bubble_chart</span>
                    <span className="text-[10px] font-bold text-on-primary/80 uppercase tracking-[0.2em]">
                      Resik Exclusive
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-on-primary text-xl font-headline font-bold truncate">
                      {form.name || 'Nama Pelanggan'}
                    </p>
                    <p className="text-on-primary/60 text-xs font-mono tracking-widest">
                      #### #### #### {form.phone ? form.phone.replace(/\D/g, '').slice(-4) || '####' : '####'}
                    </p>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-[10px] text-center text-on-surface-variant italic">
                Kartu digital akan digenerate setelah data disimpan.
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
