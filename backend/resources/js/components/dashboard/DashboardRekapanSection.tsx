import { useEffect, useMemo, useState } from 'react'
import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns'
import { id } from 'date-fns/locale'
import { toast } from 'sonner'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { dashPanel, dashPanelHeader } from '@/components/dashboard/dashboard-card-styles'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { reportsApi } from '@/services/api'

const PRESETS = [
  { id: 'week', label: 'Minggu ini' },
  { id: 'month', label: 'Bulan ini' },
  { id: 'year', label: 'Tahun ini' },
  { id: 'custom', label: 'Rentang tanggal' },
] as const

const TYPES = [
  { id: 'both', label: 'Kas & pengeluaran' },
  { id: 'transactions', label: 'Transaksi saja' },
  { id: 'expenses', label: 'Pengeluaran saja' },
] as const

function getDateRange(preset: string): [string, string] {
  const today = new Date()
  switch (preset) {
    case 'week':
      return [
        format(startOfWeek(today, { locale: id }), 'yyyy-MM-dd'),
        format(endOfWeek(today, { locale: id }), 'yyyy-MM-dd'),
      ]
    case 'month':
      return [format(startOfMonth(today), 'yyyy-MM-dd'), format(endOfMonth(today), 'yyyy-MM-dd')]
    case 'year':
      return [format(startOfYear(today), 'yyyy-MM-dd'), format(endOfYear(today), 'yyyy-MM-dd')]
    default:
      return [format(today, 'yyyy-MM-dd'), format(today, 'yyyy-MM-dd')]
  }
}

export default function DashboardRekapanSection() {
  const { user } = useAuth()
  const canDownload = user?.permissions?.['reports.download'] !== false

  const [preset, setPreset] = useState<string>('month')
  const [from, setFrom] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [type, setType] = useState<string>('both')
  const [signature, setSignature] = useState('Owner')
  const [downloading, setDownloading] = useState(false)

  const effectiveFrom = preset === 'custom' ? from : getDateRange(preset)[0]
  const effectiveTo = preset === 'custom' ? to : getDateRange(preset)[1]

  const periodLabel = useMemo(() => {
    try {
      const a = format(new Date(effectiveFrom + 'T12:00:00'), 'd MMM yyyy', { locale: id })
      const b = format(new Date(effectiveTo + 'T12:00:00'), 'd MMM yyyy', { locale: id })
      return `${a} – ${b}`
    } catch {
      return `${effectiveFrom} – ${effectiveTo}`
    }
  }, [effectiveFrom, effectiveTo])

  useEffect(() => {
    if (preset !== 'custom') {
      const [f, t] = getDateRange(preset)
      setFrom(f)
      setTo(t)
    }
  }, [preset])

  const handleDownload = async (formatType: 'pdf' | 'excel') => {
    setDownloading(true)
    try {
      const r = await reportsApi.download({
        from: effectiveFrom,
        to: effectiveTo,
        type,
        format: formatType,
        signature: signature.trim() || undefined,
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
      setDownloading(false)
    }
  }

  return (
    <Card className={cn('mb-10', dashPanel)}>
      <CardHeader className={cn(dashPanelHeader, 'space-y-0')}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-lg font-semibold tracking-tight sm:text-xl">Rekapan keuangan</CardTitle>
            <CardDescription className="text-xs leading-relaxed sm:text-sm">
              Pilih periode dan cakupan data, lalu unduh laporan PDF atau Excel. Ringkasan angka cepat ada di
              bagian atas halaman.
            </CardDescription>
            <p className="pt-1 text-xs font-medium text-primary">{periodLabel}</p>
          </div>
          {canDownload ? (
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
              <DropdownMenu>
                <DropdownMenuTrigger
                  type="button"
                  disabled={downloading}
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'sm' }),
                    'gap-1 border-border/80 bg-background/80'
                  )}
                >
                  {downloading ? 'Mengunduh…' : 'Unduh laporan'}
                  <span className="material-symbols-outlined text-base">expand_more</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[10rem]">
                  <DropdownMenuItem onClick={() => handleDownload('pdf')} disabled={downloading}>
                    PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDownload('excel')} disabled={downloading}>
                    Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-6 px-5 pb-6 pt-2 sm:px-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground">Periode</span>
            <Select value={preset} onValueChange={(v) => setPreset(v ?? 'month')}>
              <SelectTrigger className="h-10 w-full rounded-xl border-border/80 bg-muted/30">
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
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground">Cakupan data</span>
            <Select value={type} onValueChange={(v) => setType(v ?? 'both')}>
              <SelectTrigger className="h-10 w-full rounded-xl border-border/80 bg-muted/30">
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
          {preset === 'custom' ? (
            <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-1">
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground">Dari</span>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="rounded-xl border-border/80 bg-muted/30"
                />
              </div>
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground">Sampai</span>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="rounded-xl border-border/80 bg-muted/30"
                />
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>
      {canDownload ? (
        <CardFooter className="flex flex-col gap-2 border-t border-border/60 bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs text-muted-foreground">
            Tanda tangan laporan (PDF/Excel): default &quot;Owner&quot; — ubah jika perlu.
          </p>
          <Input
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="Nama penanggung jawab"
            className="max-w-xs border-border/80 bg-background"
          />
        </CardFooter>
      ) : null}
    </Card>
  )
}
