import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ordersApi, orderStatusesApi } from '../services/api'
import { waMeHrefFromPhone } from '@/lib/phone'
import { cn } from '@/lib/utils'
import { orderStatusLabel } from '@/lib/orderStatusDisplay'
import { paymentMethodLabel, PAYMENT_METHODS } from '@/lib/paymentMethods'
import { storagePublicURL } from '@/lib/backendUrl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import { OrderCreatorDisplay, type OrderCreator } from '@/components/order/OrderCreatorDisplay'
import { AlertDialog } from '@/components/ui/alert-dialog'

const CATEGORY_PRESET_VALUES = ['Pelunasan Laundry', 'Promo Kiloan', 'Layanan kiloan'] as const

function categoryPresetFromValue(cat: string | undefined | null): { preset: string; other: string } {
  if (!cat?.trim()) return { preset: '__none__', other: '' }
  if ((CATEGORY_PRESET_VALUES as readonly string[]).includes(cat)) return { preset: cat, other: '' }
  return { preset: '__other__', other: cat }
}

function formatForDatetimeLocal(iso: string | undefined | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Batas bawah datetime-local: awal hari kalender kemarin (izin backdate maks. 1 hari). */
function minDatetimeLocalOneCalendarDayBack(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  d.setHours(0, 0, 0, 0)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function isDatetimeLocalBeforeMin(value: string, min: string): boolean {
  const t = String(value).trim()
  if (!t) return false
  return t < min
}

/** Parse angka dari input kasir (mis. 32000 atau 32.000). */
function parseIdrInput(s: string): number {
  const t = String(s).trim().replace(/\./g, '').replace(',', '.')
  const n = Number.parseFloat(t)
  return Number.isNaN(n) ? NaN : n
}

type OrderItemShape = {
  service_package: { name: string; unit?: string; price_per_unit?: number }
  quantity: number
  unit_price?: number
  subtotal: number
}

type OrderImageShape = { id: number; path: string; type: string }

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const canEditMeta = user?.permissions?.['orders.edit'] !== false
  const [order, setOrder] = useState<Record<string, unknown> | null>(null)
  const [statuses, setStatuses] = useState<{ id: number; name: string }[]>([])
  const [updating, setUpdating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadType, setUploadType] = useState<string>('bukti')
  const [receiptNumber, setReceiptNumber] = useState('')
  const [transactionCategoryPreset, setTransactionCategoryPreset] = useState('__none__')
  const [transactionCategoryOther, setTransactionCategoryOther] = useState('')
  const [notesEdit, setNotesEdit] = useState('')
  const [paidAtLocal, setPaidAtLocal] = useState('')
  const [takenAtLocal, setTakenAtLocal] = useState('')
  const [savingMeta, setSavingMeta] = useState(false)
  const [paidInput, setPaidInput] = useState('')
  const [paymentMethodEdit, setPaymentMethodEdit] = useState('')
  const [savingPayment, setSavingPayment] = useState(false)
  const [cancelBatalOpen, setCancelBatalOpen] = useState(false)
  const [pendingBatalStatusId, setPendingBatalStatusId] = useState<number | null>(null)
  const [cancelReasonInput, setCancelReasonInput] = useState('')
  const [strukPrintLoading, setStrukPrintLoading] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const refreshOrder = useCallback(() => {
    if (id) ordersApi.get(Number(id)).then((r) => setOrder(r.data))
  }, [id])

  useEffect(() => {
    if (id) {
      refreshOrder()
      orderStatusesApi.list().then((r) => setStatuses(r.data))
    }
  }, [id, refreshOrder])

  useEffect(() => {
    if (!order) return
    const cat = categoryPresetFromValue(order.transaction_category as string | undefined)
    setReceiptNumber(String(order.receipt_number ?? ''))
    setTransactionCategoryPreset(cat.preset)
    setTransactionCategoryOther(cat.other)
    setNotesEdit(String(order.notes ?? ''))
    setPaidAtLocal(formatForDatetimeLocal(order.paid_at as string | undefined))
    setTakenAtLocal(
      formatForDatetimeLocal((order.taken_at ?? order.estimate_ready_at) as string | undefined)
    )
    setPaidInput(String(order.paid != null ? Number(order.paid) : 0))
    setPaymentMethodEdit(String(order.payment_method ?? ''))
  }, [order])

  const saveOrderMeta = async () => {
    if (!id || !canEditMeta) return
    const transactionCategory =
      transactionCategoryPreset === '__other__'
        ? transactionCategoryOther.trim() || null
        : transactionCategoryPreset === '__none__'
          ? null
          : transactionCategoryPreset
    const minDt = minDatetimeLocalOneCalendarDayBack()
    const pembukuanDatetimeFields: { value: string; label: string }[] = [
      { value: takenAtLocal, label: 'Tanggal selesai' },
      { value: paidAtLocal, label: 'Tgl pembayaran (lunas)' },
    ]
    for (const { value, label } of pembukuanDatetimeFields) {
      if (isDatetimeLocalBeforeMin(value, minDt)) {
        toast.error(
          `${label}: paling awal hari kemarin pukul 00.00 (backdate maksimal satu hari kalender).`
        )
        return
      }
    }
    setSavingMeta(true)
    try {
      const res = await ordersApi.update(Number(id), {
        receipt_number: receiptNumber.trim() || null,
        transaction_category: transactionCategory,
        notes: notesEdit.trim() || null,
        paid_at: paidAtLocal ? new Date(paidAtLocal).toISOString() : null,
        taken_at: takenAtLocal ? new Date(takenAtLocal).toISOString() : null,
      })
      setOrder(res.data as Record<string, unknown>)
      toast.success('Data pembukuan disimpan')
    } catch {
      toast.error('Gagal menyimpan')
    } finally {
      setSavingMeta(false)
    }
  }

  const savePayment = async () => {
    if (!id || !canEditMeta) return
    const paidNum = parseIdrInput(paidInput)
    if (Number.isNaN(paidNum) || paidNum < 0) {
      toast.error('Nominal dibayar tidak valid')
      return
    }
    if (paidNum > 0 && !paymentMethodEdit.trim()) {
      toast.error('Pilih metode pembayaran')
      return
    }
    setSavingPayment(true)
    try {
      const res = await ordersApi.update(Number(id), {
        paid: paidNum,
        payment_method: paymentMethodEdit ? paymentMethodEdit : null,
      })
      setOrder(res.data as Record<string, unknown>)
      toast.success('Pembayaran disimpan')
    } catch {
      toast.error('Gagal menyimpan pembayaran')
    } finally {
      setSavingPayment(false)
    }
  }

  const applyStatusChange = async (
    statusId: number,
    opts?: { cancellation_reason?: string | null }
  ) => {
    if (!id || !order) return
    const slug = statuses.find((s) => s.id === statusId)?.name ?? ''
    const totalN = Number(order.total ?? 0)
    const parsedPaid = parseIdrInput(paidInput)
    const paidEffective = Number.isNaN(parsedPaid) ? Number(order.paid ?? 0) : parsedPaid
    if ((slug === 'selesai' || slug === 'diambil') && totalN > 0 && paidEffective + 1e-6 < totalN) {
      toast.error(
        `Belum lunas (sisa ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Math.max(0, totalN - paidEffective))}). Isi total dibayar atau klik Lunas sekarang.`
      )
      return
    }
    setUpdating(true)
    try {
      const payload: Record<string, unknown> = { status_id: statusId }
      if (canEditMeta) {
        payload.paid = paidEffective
        if (paymentMethodEdit) payload.payment_method = paymentMethodEdit
      }
      if (slug === 'batal' && opts && 'cancellation_reason' in opts) {
        payload.cancellation_reason = opts.cancellation_reason ?? null
      }
      const res = await ordersApi.update(Number(id), payload)
      setOrder(res.data as Record<string, unknown>)
      toast.success('Status diperbarui')
    } catch (err: unknown) {
      const ax = err as {
        response?: { data?: { message?: string; errors?: Record<string, string[]> } }
      }
      const msg =
        ax.response?.data?.errors?.status_id?.[0] ??
        ax.response?.data?.message ??
        'Gagal mengubah status'
      toast.error(msg)
      throw err
    } finally {
      setUpdating(false)
    }
  }

  const requestStatusChange = (statusId: number) => {
    const slug = statuses.find((s) => s.id === statusId)?.name ?? ''
    if (slug === 'batal') {
      setPendingBatalStatusId(statusId)
      setCancelReasonInput('')
      setCancelBatalOpen(true)
      return
    }
    void applyStatusChange(statusId).catch(() => {})
  }

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !id) return
    setUploading(true)
    try {
      await ordersApi.uploadImage(Number(id), file, uploadType)
      toast.success('Foto bukti berhasil diunggah')
      refreshOrder()
    } catch {
      toast.error('Gagal mengunggah foto')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const openCamera = () => {
    setCameraError(null)
    setShowCamera(true)
  }

  const closeCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setShowCamera(false)
    setCameraError(null)
  }, [])

  useEffect(() => {
    if (!showCamera || !videoRef.current) return
    let mounted = true
    const tryCamera = (constraints: MediaStreamConstraints) =>
      navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        if (!mounted || !videoRef.current) {
          stream.getTracks().forEach((t) => t.stop())
          throw new Error('Unmounted')
        }
        streamRef.current = stream
        videoRef.current.srcObject = stream
      })
    tryCamera({ video: { facingMode: 'environment' } })
      .catch(() => tryCamera({ video: true }))
      .catch((err) => {
        if (mounted) {
          setCameraError(err?.message || 'Tidak dapat mengakses kamera')
        }
      })
    return () => {
      mounted = false
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [showCamera])

  const capturePhoto = async () => {
    if (!videoRef.current || !id || !streamRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob(
      async (blob) => {
        if (!blob) return
        setUploading(true)
        closeCamera()
        try {
          const file = new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' })
          await ordersApi.uploadImage(Number(id), file, uploadType)
          toast.success('Foto berhasil diambil dan diunggah')
          refreshOrder()
        } catch {
          toast.error('Gagal mengunggah foto')
        } finally {
          setUploading(false)
        }
      },
      'image/jpeg',
      0.9
    )
  }

  const handleCetakStruk = async () => {
    if (!id) return
    const printUrl = `${window.location.origin}/dashboard/orders/${id}/print`
    setStrukPrintLoading(true)
    try {
      const r = await ordersApi.sendToWhatsApp(Number(id))
      const data = r.data as { success?: boolean; reason?: string | null }
      if (data.success) {
        toast.success('Ringkasan order terkirim ke WhatsApp outlet (Fonnte).')
      } else {
        toast.error(data.reason?.trim() || 'WhatsApp tidak terkirim. Periksa Pengaturan (Fonnte aktif, token, nomor).')
      }
    } catch {
      toast.error('Gagal mengirim ke WhatsApp. Struk tetap dibuka — periksa koneksi atau pengaturan.')
    } finally {
      setStrukPrintLoading(false)
      const w = window.open(printUrl, '_blank', 'noopener,noreferrer')
      if (!w) toast.info('Izinkan popup browser untuk membuka halaman cetak struk.')
    }
  }

  const handleDeleteImage = async (imageId: number) => {
    if (!id || !confirm('Hapus foto ini?')) return
    try {
      await ordersApi.deleteImage(Number(id), imageId)
      toast.success('Foto dihapus')
      refreshOrder()
    } catch {
      toast.error('Gagal menghapus foto')
    }
  }

  const orderImages = (order?.images ?? []) as OrderImageShape[]

  const fmt = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(n)

  if (!order) {
    return (
      <div className="flex flex-1 items-center justify-center overflow-y-auto bg-background p-4 font-body text-on-background sm:p-6 lg:p-10">
        <span className="text-on-surface-variant">Loading...</span>
      </div>
    )
  }

  const status = order.status as { id: number; name: string }
  const customer = order.customer as { id?: number; name: string; phone?: string }
  const createdBy = order.created_by as OrderCreator | null | undefined
  const items = (order.items || []) as OrderItemShape[]
  const total = Number(order.total ?? 0)
  const discount = Number(order.discount ?? 0)
  const paid = Number(order.paid ?? 0)
  const paidPreview = canEditMeta
    ? (() => {
        const p = parseIdrInput(paidInput)
        return Number.isNaN(p) ? paid : p
      })()
    : paid
  const sisaPreview = Math.max(0, total - paidPreview)
  const kembalianPreview = paidPreview > total + 1e-6 ? paidPreview - total : 0
  const statusSlug = (status?.name ?? '') as string
  /** Metode pembayaran hanya jika ada pembayaran tercatat atau order sudah selesai/diambil. */
  const showPaymentMethodOnDetail =
    paidPreview > 0 || statusSlug === 'selesai' || statusSlug === 'diambil'
  const estimateReadyAt = order.estimate_ready_at as string | undefined
  const orderNumber = String(order.order_number ?? '')
  const minPembukuanDateTime = minDatetimeLocalOneCalendarDayBack()

  const formatEstimate = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  /** Faktual (pembukuan) atau estimasi dari form buat order jika belum ada taken_at. */
  const takenAtIso =
    (order.taken_at as string | undefined) ?? (order.estimate_ready_at as string | undefined)
  /** Untuk tampilan (kotak info): ikuti input pembukuan jika sedang diedit, baru fallback ke server. */
  const takenAtForDisplay = (() => {
    if (canEditMeta && takenAtLocal.trim()) {
      const parsed = new Date(takenAtLocal)
      if (!Number.isNaN(parsed.getTime())) {
        return takenAtLocal
      }
    }
    return takenAtIso
  })()
  const estimateDiffersFromTaken =
    Boolean(estimateReadyAt && takenAtForDisplay) &&
    new Date(estimateReadyAt as string).getTime() !== new Date(takenAtForDisplay as string).getTime()

  return (
    <>
    <div className="flex-1 overflow-y-auto bg-background p-4 font-body text-on-background sm:p-6 lg:p-10">
      <div className="mx-auto max-w-6xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm mb-6">
          <Link
            to="/dashboard/orders"
            className="text-on-surface-variant font-medium hover:text-primary"
          >
            Order
          </Link>
          <span className="material-symbols-outlined text-outline text-sm">chevron_right</span>
          <span className="text-on-surface font-bold">Detail Order {orderNumber ? `#${orderNumber}` : ''}</span>
        </div>
        <div className="mb-10">
          <h2 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl lg:text-4xl">
            Detail Order
          </h2>
          <p className="mt-2 text-base text-on-surface-variant sm:text-lg">
            Ringkasan order dan status.
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide',
                paid >= total && total > 0
                  ? 'bg-palette-purple/25 text-on-surface border border-palette-purple/35'
                  : 'bg-palette-cream text-on-surface border border-outline-variant/30'
              )}
            >
              {total <= 0 ? 'Nominal' : paid >= total ? 'Sudah lunas' : 'Belum lunas'}
            </span>
            {((order.service_speed as string | undefined) === 'reguler' ||
              (order.service_speed as string | undefined) === 'express') && (
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide bg-secondary-container/50 text-on-secondary-container border border-outline-variant/25">
                Tipe order:{' '}
                {(order.service_speed as string) === 'express' ? 'Express' : 'Reguler'}
              </span>
            )}
            {statusSlug === 'batal' && (
              <div className="w-full mt-3 rounded-xl border border-outline-variant/25 bg-surface-container-low/80 px-4 py-3 text-sm">
                <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant mb-1">
                  Pesanan dibatalkan
                </p>
                <p className="text-on-surface">
                  <span className="text-on-surface-variant">Alasan (opsional): </span>
                  {String((order as { cancellation_reason?: string }).cancellation_reason ?? '').trim() ||
                    '—'}
                </p>
                {paid > 0 && (
                  <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                    Tercatat pembayaran {fmt(paid)}. Sistem tidak mengembalikan uang otomatis — sesuaikan refund/koreksi
                    di kasir atau catatan pembukuan jika perlu.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-12 items-start gap-6 sm:gap-8">
          {/* Left column */}
          <div className="col-span-12 lg:col-span-7 space-y-8">
            {/* Data Pelanggan */}
            <section className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4 shadow-sm sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
                  <span className="material-symbols-outlined">person</span>
                </div>
                <h3 className="text-xl font-bold font-headline">Data Pelanggan</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 bg-surface-container-low rounded-xl px-4 py-3">
                  <span className="material-symbols-outlined text-outline shrink-0">person</span>
                  <div className="min-w-0">
                    <p className="font-medium text-on-surface">{customer?.name ?? '-'}</p>
                    {customer?.phone && (
                      <p className="text-sm text-on-surface-variant">{customer.phone}</p>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low/60 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant mb-2">
                    Input order
                  </p>
                  <OrderCreatorDisplay creator={createdBy} />
                </div>
                {(order.payment_method as string) && (
                  <div className="flex items-center gap-3 bg-surface-container-low rounded-xl px-4 py-3">
                    <span className="material-symbols-outlined text-outline shrink-0">payments</span>
                    <div>
                      <p className="text-xs text-on-surface-variant">Metode Pembayaran</p>
                      <p className="font-medium text-on-surface">
                        {paymentMethodLabel(order.payment_method as string)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Pembukuan / selaras kolom Excel */}
            <section className="bg-surface-container-lowest p-6 sm:p-8 rounded-2xl shadow-sm border border-outline-variant/25">
              <div className="flex items-start gap-3 mb-8">
                <div className="w-11 h-11 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">table_chart</span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-xl font-bold font-headline text-on-surface">Pembukuan &amp; nota</h3>
                  <p className="text-sm text-on-surface-variant mt-1">Selaras kolom Excel / buku kas</p>
                </div>
              </div>

              <div className="rounded-xl border border-outline-variant/25 bg-surface-container-low/45 p-4 sm:p-5 mb-8">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-4">
                  Tanggal
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-on-surface-variant">Tgl masuk</span>
                    <p className="text-base font-semibold text-on-surface tabular-nums">
                      {order.created_at
                        ? new Date(order.created_at as string).toLocaleString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </p>
                    <p className="text-[11px] text-on-surface-variant leading-snug">
                      Dari waktu order dibuat (otomatis).
                    </p>
                  </div>
                  {canEditMeta ? (
                    <div className="space-y-2">
                      <label htmlFor="order-taken-at" className="text-xs font-medium text-on-surface-variant">
                        Tanggal selesai
                      </label>
                      <Input
                        id="order-taken-at"
                        type="datetime-local"
                        min={minPembukuanDateTime}
                        value={takenAtLocal}
                        onChange={(e) => setTakenAtLocal(e.target.value)}
                        className="h-11 bg-surface-container-lowest rounded-xl border border-outline-variant/35 shadow-sm"
                      />
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">
                        Jika order baru, nilai mengikuti <strong>estimasi</strong> yang Anda pilih saat buat order;
                        setelah status <strong>Selesai</strong> bisa disesuaikan ke buku / Excel. Backdate paling
                        jauh <strong>satu hari kalender</strong> (paling awal kemarin 00.00).
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <span className="text-xs font-medium text-on-surface-variant">Tanggal selesai</span>
                      <p className="text-base font-semibold text-on-surface tabular-nums">
                        {order.taken_at || order.estimate_ready_at
                          ? new Date(
                              (order.taken_at ?? order.estimate_ready_at) as string
                            ).toLocaleString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {canEditMeta ? (
                <div className="space-y-8">
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/20 pb-2.5 mb-4">
                      Nota &amp; kategori
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-on-surface-variant">No. nota masuk</label>
                        <Input
                          value={receiptNumber}
                          onChange={(e) => setReceiptNumber(e.target.value)}
                          placeholder="mis. 1003"
                          className="h-11 bg-surface-container-lowest rounded-xl border border-outline-variant/35 shadow-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-on-surface-variant">Kategori transaksi</label>
                        <Select
                          value={transactionCategoryPreset}
                          onValueChange={(v) => setTransactionCategoryPreset(v ?? '__none__')}
                        >
                          <SelectTrigger className="h-11 w-full bg-surface-container-lowest rounded-xl border border-outline-variant/35 shadow-sm">
                            <SelectValue placeholder="Pilih" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Tidak diisi</SelectItem>
                            <SelectItem value="Pelunasan Laundry">Pelunasan Laundry</SelectItem>
                            <SelectItem value="Promo Kiloan">Promo Kiloan</SelectItem>
                            <SelectItem value="Layanan kiloan">Layanan kiloan</SelectItem>
                            <SelectItem value="__other__">Lainnya…</SelectItem>
                          </SelectContent>
                        </Select>
                        {transactionCategoryPreset === '__other__' && (
                          <Input
                            value={transactionCategoryOther}
                            onChange={(e) => setTransactionCategoryOther(e.target.value)}
                            placeholder="Isi kategori"
                            className="h-11 bg-surface-container-lowest rounded-xl border border-outline-variant/35 shadow-sm"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/20 pb-2.5 mb-4">
                      Uraian
                    </h4>
                    <textarea
                      value={notesEdit}
                      onChange={(e) => setNotesEdit(e.target.value)}
                      rows={4}
                      placeholder="Catatan untuk struk / Excel…"
                      className="w-full min-h-[104px] rounded-xl border border-outline-variant/35 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 resize-y"
                    />
                  </div>

                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/20 pb-2.5 mb-4">
                      Pembayaran tercatat
                    </h4>
                    <div className="space-y-5 max-w-xl">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-on-surface-variant">
                          Tgl pembayaran (lunas)
                        </label>
                        <Input
                          type="datetime-local"
                          min={minPembukuanDateTime}
                          value={paidAtLocal}
                          onChange={(e) => setPaidAtLocal(e.target.value)}
                          className="h-11 bg-surface-container-lowest rounded-xl border border-outline-variant/35 shadow-sm"
                        />
                        <p className="text-[11px] text-on-surface-variant leading-relaxed">
                          Otomatis terisi saat pembayaran mencapai total; bisa diubah manual. Paling awal kemarin
                          00.00 (satu hari ke belakang).
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    disabled={savingMeta}
                    onClick={() => void saveOrderMeta()}
                    className="w-full sm:w-auto min-w-[220px] h-12 rounded-xl bg-primary text-on-primary font-semibold shadow-md shadow-primary/15"
                  >
                    {savingMeta ? 'Menyimpan…' : 'Simpan pembukuan'}
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm text-on-surface-variant">
                  <p>
                    <span className="font-semibold text-on-surface">Nota masuk:</span>{' '}
                    {(order.receipt_number as string) || '—'}
                  </p>
                  <p>
                    <span className="font-semibold text-on-surface">Kategori:</span>{' '}
                    {(order.transaction_category as string) || '—'}
                  </p>
                  <p className="sm:col-span-2">
                    <span className="font-semibold text-on-surface">Uraian:</span>{' '}
                    {(order.notes as string) || '—'}
                  </p>
                  <p>
                    <span className="font-semibold text-on-surface">Tgl pembayaran:</span>{' '}
                    {order.paid_at
                      ? new Date(order.paid_at as string).toLocaleString('id-ID')
                      : '—'}
                  </p>
                  <p>
                    <span className="font-semibold text-on-surface">Tgl selesai:</span>{' '}
                    {order.taken_at || order.estimate_ready_at
                      ? new Date((order.taken_at ?? order.estimate_ready_at) as string).toLocaleString(
                          'id-ID'
                        )
                      : '—'}
                  </p>
                </div>
              )}
            </section>

            {/* Foto Bukti */}
            <section className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4 shadow-sm sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-tertiary-container text-on-tertiary-container flex items-center justify-center">
                  <span className="material-symbols-outlined">photo_camera</span>
                </div>
                <h3 className="text-xl font-bold font-headline">Foto Bukti</h3>
              </div>
              <p className="text-sm text-on-surface-variant mb-4">
                Unggah foto bukti barang diambil karyawan atau diterima pelanggan. Foto dapat dikirim ke WhatsApp (Fonnte)
                sesuai pengaturan outlet.
              </p>
              <div className="flex flex-wrap gap-3 mb-4">
                {(['bukti', 'karyawan_ambil', 'pelanggan_terima'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setUploadType(t)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      uploadType === t
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    {t === 'bukti' ? 'Bukti' : t === 'karyawan_ambil' ? 'Diambil Karyawan' : 'Diterima Pelanggan'}
                  </button>
                ))}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUploadImage}
                disabled={uploading}
              />
              <div className="flex flex-wrap gap-3 mb-4">
                <button
                  type="button"
                  onClick={openCamera}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-on-primary font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  <span className="material-symbols-outlined">photo_camera</span>
                  Ambil Foto
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-medium hover:bg-surface-container disabled:opacity-50 transition-colors border border-outline-variant/30"
                >
                  <span className="material-symbols-outlined">folder_open</span>
                  Unggah dari Galeri
                </button>
              </div>
              <div className="flex flex-wrap gap-4">
                {orderImages.map((img) => (
                  <div key={img.id} className="relative group">
                    <img
                      src={storagePublicURL(img.path)}
                      alt="Bukti"
                      className="w-24 h-24 object-cover rounded-xl border border-outline-variant/30"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(img.id)}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-error text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Hapus foto"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-24 h-24 rounded-xl border-2 border-dashed border-outline-variant/50 flex flex-col items-center justify-center gap-1 text-on-surface-variant hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-50"
                  title="Unggah dari galeri"
                >
                  <span className="material-symbols-outlined text-2xl">add_photo_alternate</span>
                  <span className="text-xs font-medium">{uploading ? '...' : '+'}</span>
                </button>
              </div>
            </section>

            {/* Layanan & Berat */}
            <section className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4 shadow-sm sm:p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center">
                  <span className="material-symbols-outlined">dry_cleaning</span>
                </div>
                <h3 className="text-xl font-bold font-headline">Layanan & Berat</h3>
              </div>

              <div className="space-y-4 mb-8">
                {items.map((it, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center py-3 border-b border-outline-variant/20 last:border-0"
                  >
                    <span className="text-on-surface font-medium">
                      {it.service_package?.name ?? 'Layanan'} · {it.quantity}{' '}
                      {it.service_package?.unit ?? 'pcs'}
                    </span>
                    <span className="font-semibold text-on-surface">{fmt(Number(it.subtotal))}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-on-surface-variant">
                    Diskon (Rp)
                  </label>
                  <div className="flex items-center bg-surface-container-low rounded-xl px-4 py-3">
                    <span className="text-outline font-medium mr-2">Rp</span>
                    <span className="text-lg font-medium text-on-surface">
                      {discount > 0 ? discount.toLocaleString('id-ID') : '0'}
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-on-surface-variant">
                    Uang Muka / DP (Rp)
                  </label>
                  <div className="flex items-center bg-surface-container-low rounded-xl px-4 py-3">
                    <span className="text-outline font-medium mr-2">Rp</span>
                    <span className="text-lg font-medium text-on-surface">
                      {paid.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Right column - Summary card */}
          <div className="col-span-12 lg:sticky lg:top-10 lg:col-span-5">
            <div className="bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/30 flex flex-col">
              <div className="rounded-t-xl bg-primary p-4 text-on-primary sm:p-8">
                <h3 className="text-lg font-bold font-headline uppercase tracking-widest opacity-80 mb-1">
                  Total Pembayaran
                </h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-medium">Rp</span>
                  <span className="text-5xl font-extrabold font-headline">
                    {total.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
              <div className="flex-1 space-y-6 p-4 sm:p-8">
                <div className="space-y-4">
                  {items.map((it, i) => {
                    const pkg = it.service_package
                    const unitPrice = Number(it.unit_price ?? pkg?.price_per_unit ?? 0)
                    return (
                      <div
                        key={i}
                        className="flex justify-between items-center text-on-surface-variant"
                      >
                        <span className="text-sm">
                          {pkg?.name ?? 'Layanan'} ({it.quantity} {pkg?.unit ?? 'pcs'} x{' '}
                          {unitPrice.toLocaleString('id-ID')})
                        </span>
                        <span className="font-semibold text-on-surface">{fmt(Number(it.subtotal))}</span>
                      </div>
                    )
                  })}
                  {discount > 0 && (
                    <div className="flex justify-between items-center text-tertiary">
                      <span className="text-sm">Diskon Voucher</span>
                      <span className="font-semibold">- {fmt(discount)}</span>
                    </div>
                  )}
                  <div className="pt-4 border-t border-dashed border-outline-variant/50" />
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-sm font-bold text-on-surface">
                      {canEditMeta ? 'Sudah dibayar' : 'DP / terbayar'}
                    </span>
                    <span className="font-bold text-secondary tabular-nums text-right">{fmt(paidPreview)}</span>
                  </div>
                  {canEditMeta && (
                    <p className="text-[10px] text-on-surface-variant -mt-2">
                      Pratinjau dari kolom di bawah (belum disimpan jika belum klik Simpan).
                    </p>
                  )}
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-sm font-bold text-on-surface">Sisa tagihan</span>
                    <span
                      className={cn(
                        'font-bold tabular-nums text-right',
                        sisaPreview > 0 ? 'text-error' : 'text-on-surface-variant'
                      )}
                    >
                      {fmt(sisaPreview)}
                    </span>
                  </div>
                  {kembalianPreview > 0 && (
                    <div className="flex justify-between items-center gap-3 rounded-lg bg-palette-cream/40 border border-outline-variant/20 px-3 py-2">
                      <span className="text-sm font-bold text-on-surface">Kelebihan / kembalian</span>
                      <span className="font-bold text-on-surface tabular-nums">{fmt(kembalianPreview)}</span>
                    </div>
                  )}
                </div>

                {canEditMeta && (
                  <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low/60 p-5 shadow-sm space-y-5">
                    <div className="border-b border-outline-variant/20 pb-3">
                      <p className="text-sm font-bold text-on-surface">Catat pembayaran</p>
                      <p className="text-[11px] text-on-surface-variant mt-1">
                        Nominal kumulatif (DP + pelunasan). Titik sebagai pemisah ribuan boleh, mis.{' '}
                        <span className="font-mono">32.000</span>.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-on-surface-variant">Total dibayar (Rp)</label>
                      <div className="flex items-center bg-surface-container-lowest rounded-xl px-3 py-2.5 border border-outline-variant/35 shadow-sm focus-within:ring-2 focus-within:ring-primary/20">
                        <span className="text-on-surface-variant text-sm font-medium mr-2 shrink-0">Rp</span>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={paidInput}
                          onChange={(e) => setPaidInput(e.target.value)}
                          className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-9 text-base font-semibold tabular-nums"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    {showPaymentMethodOnDetail && (
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-on-surface-variant">Metode pembayaran</label>
                        <Select
                          value={paymentMethodEdit || '__none__'}
                          onValueChange={(v) =>
                            setPaymentMethodEdit(!v || v === '__none__' ? '' : v)
                          }
                        >
                          <SelectTrigger className="h-11 w-full bg-surface-container-lowest rounded-xl border border-outline-variant/35 shadow-sm">
                            <SelectValue placeholder="Pilih" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Belum dipilih</SelectItem>
                            {(order.payment_method === 'midtrans' || paymentMethodEdit === 'midtrans') && (
                              <SelectItem value="midtrans">Bayar online (Midtrans)</SelectItem>
                            )}
                            {PAYMENT_METHODS.map((m) => (
                              <SelectItem key={m.value} value={m.value}>
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-on-surface-variant leading-relaxed">
                          Untuk pelunasan atau catat cara bayar (tunai, transfer, QRIS, dll.).
                        </p>
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 rounded-xl border-2 border-outline-variant/40 h-11 font-semibold"
                        disabled={savingPayment || updating}
                        onClick={() => setPaidInput(String(Math.round(total)))}
                      >
                        Lunas sekarang
                      </Button>
                      <Button
                        type="button"
                        className="flex-1 rounded-xl h-11 font-semibold bg-primary text-on-primary shadow-md shadow-primary/15"
                        disabled={savingPayment || updating}
                        onClick={() => void savePayment()}
                      >
                        {savingPayment ? 'Menyimpan…' : 'Simpan pembayaran'}
                      </Button>
                    </div>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed border-t border-outline-variant/15 pt-3">
                      Status <strong>Selesai</strong> hanya jika total dibayar ≥ total order. Kelebihan bayar ditampilkan
                      sebagai kembalian di atas.
                    </p>
                  </div>
                )}

                <div className="pt-6 space-y-4">
                  {(estimateReadyAt || takenAtForDisplay) && (
                    <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-start gap-3">
                      <span
                        className="material-symbols-outlined text-primary shrink-0"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        info
                      </span>
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        {takenAtForDisplay ? (
                          <>
                            <span className="font-semibold text-on-surface">Tanggal selesai (faktual):</span>{' '}
                            <span className="font-bold text-on-surface">
                              {formatEstimate(takenAtForDisplay)}
                            </span>
                            {estimateReadyAt && estimateDiffersFromTaken ? (
                              <span className="block mt-1.5 text-[11px] leading-snug">
                                Estimasi saat order dibuat:{' '}
                                <span className="font-medium">{formatEstimate(estimateReadyAt)}</span>
                                {' — boleh berbeda jika selesai lebih awal atau terlambat.'}
                              </span>
                            ) : null}
                          </>
                        ) : estimateReadyAt ? (
                          <>
                            Estimasi selesai pada{' '}
                            <span className="font-bold text-on-surface">{formatEstimate(estimateReadyAt)}</span>.
                            Setelah status Selesai/Diambil, tanggal di pembukuan mengikuti waktu selesai aktual.
                          </>
                        ) : null}
                        {estimateReadyAt && !takenAtForDisplay ? (
                          <span className="block mt-1.5">Pelanggan dapat notifikasi otomatis via WhatsApp sesuai pengaturan.</span>
                        ) : null}
                      </p>
                    </div>
                  )}

                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-on-surface-variant">Ubah Status</p>
                    <div className="flex flex-wrap gap-2">
                      {statuses.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => requestStatusChange(s.id)}
                          disabled={
                            updating ||
                            s.id === status?.id ||
                            (s.name === 'batal' &&
                              ['selesai', 'diambil', 'batal', 'siap_diambil'].includes(statusSlug))
                          }
                          className={cn(
                            'px-4 py-2 rounded-xl text-sm font-medium transition-all border-2 disabled:opacity-50 disabled:cursor-not-allowed',
                            s.id === status?.id
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'bg-surface-container-low text-on-surface border-outline-variant/30 hover:border-primary/50 hover:bg-primary/5'
                          )}
                        >
                          {orderStatusLabel(s.name)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <button
                      type="button"
                      onClick={() => void handleCetakStruk()}
                      disabled={strukPrintLoading || !id}
                      className="w-full bg-gradient-to-br from-primary to-primary-container text-on-primary font-headline font-bold py-4 rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined">print</span>
                      {strukPrintLoading ? 'Mengirim & membuka struk…' : 'Cetak Struk'}
                    </button>
                    <a
                      href={waMeHrefFromPhone(customer?.phone) ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'w-full min-h-[3.75rem] rounded-xl font-headline font-bold px-4 py-3.5 sm:px-4 sm:py-3 transition-all flex items-center justify-center box-border overflow-visible',
                        customer?.phone
                          ? 'bg-[#25D366] text-white hover:opacity-90'
                          : 'bg-surface-container text-on-surface-variant cursor-not-allowed'
                      )}
                    >
                      <span className="inline-flex items-center justify-center gap-2.5 sm:gap-3 px-0.5 w-full min-w-0 max-w-full">
                        <span
                          className="material-symbols-outlined text-2xl shrink-0 leading-none flex items-center justify-center"
                          aria-hidden
                        >
                          chat
                        </span>
                        <span className="text-center text-xs sm:text-sm leading-snug break-words">
                          Chat pelanggan
                        </span>
                      </span>
                    </a>
                    <Link
                      to="/dashboard/orders"
                      className="w-full bg-surface-container-highest text-on-surface-variant font-headline font-bold py-4 rounded-xl hover:bg-surface-variant transition-all flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined">arrow_back</span>
                      Kembali ke Daftar Order
                    </Link>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-surface-container-low border-t border-outline-variant/20 flex justify-center rounded-b-xl">
                <span className="text-[10px] uppercase font-bold text-outline tracking-tighter">
                  Resik Laundry POS v2.4.0
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <AlertDialog
      open={cancelBatalOpen}
      onOpenChange={(open) => {
        setCancelBatalOpen(open)
        if (!open) setPendingBatalStatusId(null)
      }}
      title="Batalkan pesanan?"
      description={
        paid > 0
          ? `Sudah ada pembayaran ${fmt(paid)}. Nominal di sistem tidak dihapus otomatis — pastikan refund atau koreksi di kasir jika perlu.`
          : 'Order akan ditandai batal. Anda dapat menambahkan alasan di bawah (opsional).'
      }
      confirmLabel="Ya, batalkan"
      cancelLabel="Kembali"
      variant="destructive"
      onConfirm={async () => {
        if (pendingBatalStatusId == null) return
        await applyStatusChange(pendingBatalStatusId, {
          cancellation_reason: cancelReasonInput.trim() || null,
        })
        setPendingBatalStatusId(null)
      }}
    >
      <div>
        <label htmlFor="cancel-reason" className="block text-xs font-medium text-on-surface-variant">
          Alasan pembatalan (opsional)
        </label>
        <textarea
          id="cancel-reason"
          value={cancelReasonInput}
          onChange={(e) => setCancelReasonInput(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="—"
          className="mt-1.5 w-full rounded-xl border border-outline-variant/35 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface placeholder:text-outline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 resize-y min-h-[72px]"
        />
      </div>
    </AlertDialog>

    {/* Modal Kamera */}
    {showCamera && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
        <div className="bg-surface-container-lowest rounded-2xl overflow-hidden w-full max-w-lg shadow-2xl">
          <div className="p-4 flex justify-between items-center border-b border-outline-variant/20">
            <h3 className="font-headline font-bold text-lg">Ambil Foto</h3>
            <button
              type="button"
              onClick={closeCamera}
              className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant"
              aria-label="Tutup"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <div className="relative aspect-[4/3] bg-black">
            {cameraError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-on-surface-variant">
                <span className="material-symbols-outlined text-5xl">videocam_off</span>
                <p className="text-center">{cameraError}</p>
                <p className="text-sm text-center">Izinkan akses kamera di pengaturan browser, atau gunakan &quot;Unggah dari Galeri&quot;.</p>
                <button
                  type="button"
                  onClick={closeCamera}
                  className="px-4 py-2 rounded-xl bg-primary text-on-primary font-medium"
                >
                  Tutup
                </button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                  <button
                    type="button"
                    onClick={closeCamera}
                    className="px-6 py-3 rounded-xl bg-surface-container text-on-surface font-medium"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="w-16 h-16 rounded-full bg-white border-4 border-primary flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                    aria-label="Ambil foto"
                  >
                    <span className="w-12 h-12 rounded-full bg-primary" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  )
}
