import { useEffect, useState } from 'react'
import { format, startOfWeek, startOfMonth, startOfYear, endOfWeek, endOfMonth, endOfYear } from 'date-fns'
import { id } from 'date-fns/locale'
import { toast } from 'sonner'
import { reportsApi } from '../services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'

const PRESETS = [
  { id: 'today', label: 'Hari ini' },
  { id: 'week', label: 'Minggu ini' },
  { id: 'month', label: 'Bulan ini' },
  { id: 'year', label: 'Tahun ini' },
  { id: 'custom', label: 'Rentang tanggal' },
] as const

const TYPES = [
  { id: 'transactions', label: 'Transaksi' },
  { id: 'expenses', label: 'Pengeluaran' },
  { id: 'both', label: 'Gabungan' },
] as const

const FORMATS = [
  { id: 'pdf', label: 'PDF' },
  { id: 'excel', label: 'Excel' },
] as const

function getDateRange(preset: string): [string, string] {
  const today = new Date()
  switch (preset) {
    case 'today':
      return [format(today, 'yyyy-MM-dd'), format(today, 'yyyy-MM-dd')]
    case 'week':
      return [
        format(startOfWeek(today, { locale: id }), 'yyyy-MM-dd'),
        format(endOfWeek(today, { locale: id }), 'yyyy-MM-dd'),
      ]
    case 'month':
      return [
        format(startOfMonth(today), 'yyyy-MM-dd'),
        format(endOfMonth(today), 'yyyy-MM-dd'),
      ]
    case 'year':
      return [
        format(startOfYear(today), 'yyyy-MM-dd'),
        format(endOfYear(today), 'yyyy-MM-dd'),
      ]
    default:
      return [format(today, 'yyyy-MM-dd'), format(today, 'yyyy-MM-dd')]
  }
}

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n)
}

export default function Reports() {
  const { user } = useAuth()
  const canDownload = user?.permissions?.['reports.download'] !== false
  const [preset, setPreset] = useState<string>('month')
  const [from, setFrom] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [type, setType] = useState<string>('both')
  const [formatType, setFormatType] = useState<'pdf' | 'excel'>('pdf')
  const [signature, setSignature] = useState('Owner')
  const [data, setData] = useState<{
    income: number
    income_accrual?: number
    total_expenses: number
    profit: number
    profit_accrual?: number
    orders_count: number
    expenses_count: number
  } | null>(null)
  const [loading, setLoading] = useState(false)

  const effectiveFrom = preset === 'custom' ? from : getDateRange(preset)[0]
  const effectiveTo = preset === 'custom' ? to : getDateRange(preset)[1]

  const fetchData = () => {
    setLoading(true)
    reportsApi
      .getData({ from: effectiveFrom, to: effectiveTo, type })
      .then((r) => setData(r.data as typeof data))
      .catch(() => {
        toast.error('Gagal memuat data rekapan')
        setData(null)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (preset !== 'custom') {
      const [f, t] = getDateRange(preset)
      setFrom(f)
      setTo(t)
    }
  }, [preset])

  useEffect(() => {
    fetchData()
  }, [effectiveFrom, effectiveTo, type])

  const handleDownload = async () => {
    setLoading(true)
    try {
      const r = await reportsApi.download({
        from: effectiveFrom,
        to: effectiveTo,
        type,
        format: formatType,
        signature: signature || undefined,
      })
      const blob = new Blob([r.data as Blob])
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rekapan-${effectiveFrom}_${effectiveTo}.${formatType === 'pdf' ? 'pdf' : 'xlsx'}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Laporan berhasil diunduh')
    } catch {
      toast.error('Gagal mengunduh laporan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-[900px] p-4 sm:p-6 lg:p-10">
      <header className="mb-10">
        <h2 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl lg:text-4xl">
          Rekapan Laporan
        </h2>
        <p className="text-on-surface-variant text-base mt-2">
          Buat laporan transaksi dan pengeluaran, unduh PDF atau Excel.
        </p>
      </header>

      <Card className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl overflow-hidden mb-8">
        <CardContent className="p-4 sm:p-6">
          <h3 className="font-headline font-bold text-lg text-on-surface mb-6">Filter & Opsi</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-on-surface-variant">Preset Periode</label>
              <Select value={preset} onValueChange={(v) => setPreset(v ?? 'month')}>
                <SelectTrigger className="w-full bg-surface-container-low border-0 rounded-lg py-3 h-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {preset === 'custom' && (
              <div className="grid grid-cols-2 gap-4 md:col-span-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-on-surface-variant">Dari</label>
                  <Input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="bg-surface-container-low border-0 rounded-lg py-3 h-auto"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-on-surface-variant">Sampai</label>
                  <Input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="bg-surface-container-low border-0 rounded-lg py-3 h-auto"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-on-surface-variant">Jenis Laporan</label>
              <Select value={type} onValueChange={(v) => setType(v ?? 'both')}>
                <SelectTrigger className="w-full bg-surface-container-low border-0 rounded-lg py-3 h-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-on-surface-variant">Format</label>
              <Select value={formatType} onValueChange={(v) => setFormatType(v as 'pdf' | 'excel')}>
                <SelectTrigger className="w-full bg-surface-container-low border-0 rounded-lg py-3 h-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMATS.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-on-surface-variant">
                Tanda Tangan (nama di laporan)
              </label>
              <Input
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Nama Owner / Manager"
                className="bg-surface-container-low border-0 rounded-lg py-3 h-auto font-[family-name:var(--font-signature)]"
                style={{ fontFamily: "'Dancing Script', cursive" }}
              />
              <p className="text-xs text-on-surface-variant">
                Nama akan ditampilkan dengan font tanda tangan di bagian bawah laporan PDF
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 mt-8 pt-6 border-t border-outline-variant/20">
            {canDownload && (
              <Button
                onClick={handleDownload}
                disabled={loading}
                className="bg-gradient-to-br from-primary to-primary-container text-on-primary px-6 py-3 rounded-xl font-bold shadow-sm hover:opacity-90 h-auto"
              >
                <span className="material-symbols-outlined text-xl mr-2">download</span>
                Unduh Laporan
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {loading && !data ? (
        <div className="text-center py-12 text-on-surface-variant">Memuat data...</div>
      ) : data ? (
        <Card className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl overflow-hidden">
          <CardContent className="p-4 sm:p-6">
            <h3 className="font-headline font-bold text-lg text-on-surface mb-6">Ringkasan</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {type !== 'expenses' && (
                <>
                  <div className="bg-surface-container-low rounded-xl p-4">
                    <p className="text-xs text-on-surface-variant font-medium">Transaksi</p>
                    <p className="text-xl font-bold text-on-surface mt-1">{data.orders_count}</p>
                  </div>
                  <div className="bg-surface-container-low rounded-xl p-4">
                    <p className="text-xs text-on-surface-variant font-medium">Pendapatan (kas masuk)</p>
                    <p className="text-xl font-bold text-primary mt-1">
                      {formatRupiah(data.income)}
                    </p>
                    {data.income_accrual != null &&
                      Math.abs(data.income_accrual - data.income) > 0.01 && (
                        <p className="text-[11px] text-on-surface-variant mt-1">
                          Omzet akrual: {formatRupiah(data.income_accrual)}
                        </p>
                      )}
                  </div>
                </>
              )}
              {type !== 'transactions' && (
                <div className="bg-surface-container-low rounded-xl p-4">
                  <p className="text-xs text-on-surface-variant font-medium">Pengeluaran</p>
                  <p className="text-xl font-bold text-destructive mt-1">
                    {formatRupiah(data.total_expenses)}
                  </p>
                </div>
              )}
              {type === 'both' && (
                <div className="bg-surface-container-low rounded-xl p-4">
                  <p className="text-xs text-on-surface-variant font-medium">Laba (kas)</p>
                  <p className="text-xl font-bold text-emerald-600 mt-1">
                    {formatRupiah(data.profit)}
                  </p>
                  {data.profit_accrual != null &&
                    Math.abs(data.profit_accrual - data.profit) > 0.01 && (
                      <p className="text-[11px] text-on-surface-variant mt-1">
                        Akrual: {formatRupiah(data.profit_accrual)}
                      </p>
                    )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
