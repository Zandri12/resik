import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { outletSettingsApi } from '../services/api'

const FONNTE_DOCS = 'https://docs.fonnte.com/token-api-key/'

export default function Settings() {
  const [form, setForm] = useState({
    outlet_name: '',
    address: '',
    phone: '',
    expense_budget_target: '',
    whatsapp_enabled: '0',
    whatsapp_owner_phone: '',
    whatsapp_fonnte_token: '',
    report_schedule: 'off',
    report_schedule_type: 'both',
    report_schedule_format: 'pdf',
    report_signature: 'Owner',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    outletSettingsApi
      .list()
      .then((r) => {
        const data = r.data as Record<string, string>
        setForm((f) => ({
          ...f,
          outlet_name: data?.outlet_name ?? '',
          address: data?.address ?? '',
          phone: data?.phone ?? '',
          expense_budget_target: data?.expense_budget_target ?? '6000000',
          whatsapp_enabled: data?.whatsapp_enabled ?? '0',
          whatsapp_owner_phone: data?.whatsapp_owner_phone ?? '',
          whatsapp_fonnte_token: data?.whatsapp_fonnte_token ?? '',
          report_schedule: data?.report_schedule ?? 'off',
          report_schedule_type: data?.report_schedule_type ?? 'both',
          report_schedule_format: data?.report_schedule_format ?? 'pdf',
          report_signature: data?.report_signature ?? 'Owner',
        }))
      })
      .catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await outletSettingsApi.update([
        { key: 'outlet_name', value: form.outlet_name },
        { key: 'address', value: form.address },
        { key: 'phone', value: form.phone },
        { key: 'expense_budget_target', value: form.expense_budget_target },
        { key: 'whatsapp_enabled', value: form.whatsapp_enabled },
        { key: 'whatsapp_owner_phone', value: form.whatsapp_owner_phone },
        { key: 'whatsapp_fonnte_token', value: form.whatsapp_fonnte_token },
        { key: 'report_schedule', value: form.report_schedule },
        { key: 'report_schedule_type', value: form.report_schedule_type },
        { key: 'report_schedule_format', value: form.report_schedule_format },
        { key: 'report_signature', value: form.report_signature },
      ])
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sm sm:p-6">
        <h2 className="font-headline font-bold text-lg mb-6">Pengaturan Outlet</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1">Nama Outlet</label>
            <input
              type="text"
              value={form.outlet_name}
              onChange={(e) => setForm((f) => ({ ...f, outlet_name: e.target.value }))}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
              placeholder="Laundry Resik"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1">
              Target Anggaran Bulanan (Rp)
            </label>
            <input
              type="number"
              min={0}
              value={form.expense_budget_target}
              onChange={(e) => setForm((f) => ({ ...f, expense_budget_target: e.target.value }))}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
              placeholder="6000000"
            />
            <p className="text-xs text-on-surface-variant mt-1">
              Digunakan untuk menghitung Sisa Anggaran di halaman Pengeluaran
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1">Alamat (landing page)</label>
            <textarea
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              rows={3}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
              placeholder="Alamat lengkap outlet"
            />
            <p className="text-xs text-on-surface-variant mt-1">
              Ditampilkan di footer dan peta Google Maps publik
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1">Telepon / WhatsApp (landing)</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
              placeholder="0812xxxxxxxx"
            />
            <p className="text-xs text-on-surface-variant mt-1">
              Nomor untuk tombol WA dan kontak di halaman beranda publik
            </p>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="primary-gradient px-5 py-2.5 rounded-xl font-bold text-sm text-on-primary disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </form>
      </div>

      <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sm sm:p-6">
        <h2 className="font-headline font-bold text-lg mb-2">Notifikasi WhatsApp</h2>
        <p className="text-sm text-on-surface-variant mb-4">
          Setiap order baru dapat dikirim otomatis ke WhatsApp outlet Anda lewat Fonnte (saat order
          dibuat). Tombol <strong className="text-on-surface">Chat pelanggan</strong> di halaman
          detail order membuka WhatsApp ke <strong className="text-on-surface">nomor pelanggan</strong>{' '}
          pada order tersebut (bukan nomor outlet).
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={form.whatsapp_enabled === '1'}
              onClick={() =>
                setForm((f) => ({ ...f, whatsapp_enabled: f.whatsapp_enabled === '1' ? '0' : '1' }))
              }
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                form.whatsapp_enabled === '1' ? 'bg-primary' : 'bg-outline-variant/30'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                  form.whatsapp_enabled === '1' ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
            <label className="text-sm font-medium text-on-surface">
              Aktifkan notifikasi transaksi ke WhatsApp
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1">
              Nomor WhatsApp Owner
            </label>
            <input
              type="tel"
              value={form.whatsapp_owner_phone}
              onChange={(e) => setForm((f) => ({ ...f, whatsapp_owner_phone: e.target.value }))}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
              placeholder="08123456789 atau 628123456789"
            />
            <p className="text-xs text-on-surface-variant mt-1">
              Digunakan untuk notifikasi order (Fonnte). Kosongkan untuk memakai nomor Telepon /
              WhatsApp (landing) di blok Pengaturan Outlet di atas.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1">
              Token API Fonnte (device)
            </label>
            <input
              type="password"
              value={form.whatsapp_fonnte_token}
              onChange={(e) => setForm((f) => ({ ...f, whatsapp_fonnte_token: e.target.value }))}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
              placeholder="Token dari dashboard Fonnte"
              autoComplete="off"
            />
            <p className="text-xs text-on-surface-variant mt-1">
              Hubungkan perangkat WhatsApp di Fonnte, lalu salin token. Kosongkan jika token hanya di{' '}
              <code className="text-xs">.env</code>.{' '}
              <a href={FONNTE_DOCS} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                Cara mendapatkan token
              </a>
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              type="submit"
              disabled={saving}
              className="primary-gradient px-5 py-2.5 rounded-xl font-bold text-sm text-on-primary disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true)
                try {
                  const r = await outletSettingsApi.testWhatsApp()
                  const data = r.data as { success?: boolean; message?: string; reason?: string | null }
                  if (data.success) {
                    toast.success(data.message ?? 'Pesan uji coba terkirim.')
                  } else {
                    toast.error(data.reason?.trim() || data.message || 'Gagal mengirim uji coba WhatsApp.')
                  }
                } catch {
                  toast.error('Gagal mengirim uji coba WhatsApp.')
                } finally {
                  setSaving(false)
                }
              }}
              className="px-5 py-2.5 rounded-xl font-bold text-sm bg-outline-variant/20 text-on-surface-variant hover:bg-outline-variant/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Uji coba Fonnte
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sm sm:p-6">
        <h2 className="font-headline font-bold text-lg mb-2">Laporan Rekapan Otomatis</h2>
        <p className="text-sm text-on-surface-variant mb-4">
          Jadwalkan pembuatan ringkasan laporan secara otomatis (harian, mingguan, bulanan, atau
          tahunan). File dihasilkan oleh sistem sesuai jadwal.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-2">
              Jadwal Otomatis
            </label>
            <select
              value={form.report_schedule}
              onChange={(e) => setForm((f) => ({ ...f, report_schedule: e.target.value }))}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/20"
            >
              <option value="off">Nonaktif</option>
              <option value="daily">Setiap hari (pukul 07:00)</option>
              <option value="weekly">Setiap minggu</option>
              <option value="monthly">Setiap bulan</option>
              <option value="yearly">Setiap tahun</option>
            </select>
          </div>
          {form.report_schedule !== 'off' && (
            <>
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-2">
                  Jenis Laporan
                </label>
                <select
                  value={form.report_schedule_type}
                  onChange={(e) => setForm((f) => ({ ...f, report_schedule_type: e.target.value }))}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/20"
                >
                  <option value="transactions">Transaksi saja</option>
                  <option value="expenses">Pengeluaran saja</option>
                  <option value="both">Gabungan</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-2">
                  Format
                </label>
                <select
                  value={form.report_schedule_format}
                  onChange={(e) => setForm((f) => ({ ...f, report_schedule_format: e.target.value }))}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/20"
                >
                  <option value="pdf">PDF</option>
                  <option value="excel">Excel</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-2">
                  Tanda Tangan (nama di laporan)
                </label>
                <input
                  type="text"
                  value={form.report_signature}
                  onChange={(e) => setForm((f) => ({ ...f, report_signature: e.target.value }))}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/20"
                  placeholder="Owner"
                />
              </div>
            </>
          )}
          <button
            type="submit"
            disabled={saving}
            className="primary-gradient px-5 py-2.5 rounded-xl font-bold text-sm text-on-primary disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </form>
      </div>
    </div>
  )
}
