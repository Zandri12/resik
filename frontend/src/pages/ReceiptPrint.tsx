import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { ordersApi, outletSettingsApi } from '../services/api'
import { paymentMethodLabel } from '@/lib/paymentMethods'
import { orderStatusLabel } from '@/lib/orderStatusDisplay'

type OrderItem = {
  service_package: { name: string; unit?: string }
  quantity: number
  unit_price?: number
  subtotal: number
}

type Order = {
  id: number
  order_number: string
  total: number
  paid: number
  discount: number
  payment_method?: string | null
  receipt_number?: string | null
  transaction_category?: string | null
  notes?: string | null
  cancellation_reason?: string | null
  paid_at?: string | null
  taken_at?: string | null
  estimate_ready_at?: string
  created_at: string
  status?: { name: string }
  customer: { name: string; phone?: string; address?: string | null }
  items: OrderItem[]
  created_by?: { name?: string | null; avatar_url?: string | null } | null
}

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

export default function ReceiptPrint() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<Order | null>(null)
  const [outletName, setOutletName] = useState('Resik Laundry')
  const [error, setError] = useState<string | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    ordersApi
      .get(Number(id))
      .then((r) => setOrder(r.data as Order))
      .catch(() => setError('Order tidak ditemukan'))
    outletSettingsApi
      .list()
      .then((r) => setOutletName((r.data as { outlet_name?: string })?.outlet_name ?? 'Resik Laundry'))
      .catch(() => {})
  }, [id])

  useEffect(() => {
    if (!order || error) return
    const t = setTimeout(() => {
      window.print()
    }, 500)
    return () => clearTimeout(t)
  }, [order, error])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-gray-600">Memuat struk...</p>
      </div>
    )
  }

  const total = Number(order.total ?? 0)
  const paid = Number(order.paid ?? 0)
  const discount = Number(order.discount ?? 0)
  const sisa = Math.max(0, total - paid)
  const date = new Date(order.created_at).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const fmtShort = (iso: string | null | undefined) =>
    iso
      ? new Date(iso).toLocaleString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null

  const paidAtStr = fmtShort(order.paid_at ?? undefined)
  /** Selaras detail order: faktual atau estimasi dari form buat order. */
  const completionIso = order.taken_at ?? order.estimate_ready_at
  const takenAtStr = fmtShort(completionIso ?? undefined)

  const estimateStr = order.estimate_ready_at
    ? new Date(order.estimate_ready_at).toLocaleDateString('id-ID', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  const showEstimateDiffFooter =
    Boolean(order.estimate_ready_at && order.taken_at) &&
    new Date(order.estimate_ready_at as string).getTime() !==
      new Date(order.taken_at as string).getTime()
  const statusSlug = order.status?.name ?? ''
  const paymentStatusLabel =
    total <= 0 ? '—' : paid >= total ? 'Laundry sudah bayar' : 'Belum lunas'

  return (
    <div className="pb-safe-receipt min-h-[100dvh] overflow-x-auto bg-[#f5f5f5]">
      <style>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          html, body {
            width: 80mm !important;
            min-width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          body * { visibility: hidden; }
          #receipt-print, #receipt-print * { visibility: visible; }
          #receipt-print {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            min-width: 80mm !important;
            margin: 0 !important;
            padding: 3mm !important;
            background: white !important;
            box-shadow: none !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .no-print { display: none !important; }
        }
        @media screen {
          body { background: #f5f5f5; }
          #receipt-print {
            width: 80mm;
            max-width: 80mm;
            margin: 1rem auto;
            background: white;
            padding: 1rem;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
        }
      `}</style>
      <div className="no-print fixed top-4 right-4 z-50">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium"
        >
          Cetak Ulang
        </button>
      </div>
      <div
        id="receipt-print"
        ref={printRef}
        className="receipt-struk font-mono text-black text-sm"
        style={{ width: '80mm', maxWidth: '80mm' }}
      >
        <div className="text-center border-b border-black pb-2 mb-2">
          <p className="font-bold text-base uppercase tracking-wider">{outletName}</p>
          <p className="text-xs mt-1">--------------------------------</p>
        </div>
        <div className="space-y-1 text-xs">
          <p className="flex justify-between gap-2">
            <span>No. Order</span>
            <span className="font-bold text-right shrink-0">{order.order_number}</span>
          </p>
          {order.receipt_number && (
            <p className="flex justify-between gap-2">
              <span>No. Nota</span>
              <span className="font-bold text-right shrink-0">{order.receipt_number}</span>
            </p>
          )}
          <p className="flex justify-between gap-2">
            <span>Tgl masuk</span>
            <span className="text-right">{date}</span>
          </p>
          {takenAtStr && (
            <p className="flex justify-between gap-2">
              <span>Tgl selesai</span>
              <span className="text-right">{takenAtStr}</span>
            </p>
          )}
          {order.transaction_category && (
            <p className="flex justify-between gap-2">
              <span>Kategori</span>
              <span className="text-right max-w-[55%] break-words">{order.transaction_category}</span>
            </p>
          )}
          {statusSlug && (
            <p className="flex justify-between gap-2">
              <span>Status barang</span>
              <span className="text-right font-medium">{orderStatusLabel(statusSlug)}</span>
            </p>
          )}
          {statusSlug === 'batal' && order.cancellation_reason?.trim() && (
            <div className="pt-0.5 text-[10px] leading-snug">
              <p className="text-black/80">Alasan batal</p>
              <p className="break-words whitespace-pre-wrap">{order.cancellation_reason.trim()}</p>
            </div>
          )}
          <p className="flex justify-between gap-2">
            <span>Status bayar</span>
            <span className="text-right font-medium">{paymentStatusLabel}</span>
          </p>
          <p className="flex justify-between gap-2">
            <span>Pelanggan</span>
            <span className="text-right max-w-[55%] break-words">{order.customer?.name ?? '-'}</span>
          </p>
          {order.created_by?.name && (
            <p className="flex justify-between gap-2 items-start">
              <span className="shrink-0">Input order</span>
              <span className="flex max-w-[55%] items-center justify-end gap-1.5 text-right">
                {order.created_by.avatar_url ? (
                  <img
                    src={order.created_by.avatar_url}
                    alt=""
                    className="h-5 w-5 shrink-0 rounded-full border border-black/10 object-cover"
                  />
                ) : null}
                <span className="break-words font-bold">{order.created_by.name}</span>
              </span>
            </p>
          )}
          {order.customer?.phone && (
            <p className="flex justify-between gap-2">
              <span>Telepon</span>
              <span className="text-right shrink-0">{order.customer.phone}</span>
            </p>
          )}
          {order.customer?.address?.trim() && (
            <div className="pt-0.5">
              <p className="text-[10px] text-black/80">Alamat</p>
              <p className="text-xs break-words whitespace-pre-wrap">{order.customer.address.trim()}</p>
            </div>
          )}
          {order.payment_method && (
            <p className="flex justify-between gap-2">
              <span>Metode</span>
              <span className="text-right">{paymentMethodLabel(order.payment_method)}</span>
            </p>
          )}
          {paidAtStr && (
            <p className="flex justify-between gap-2">
              <span>Tgl bayar</span>
              <span className="text-right">{paidAtStr}</span>
            </p>
          )}
        </div>
        {order.notes?.trim() && (
          <>
            <p className="text-xs mt-2 mb-1">--------------------------------</p>
            <div className="text-xs">
              <p className="text-[10px] font-semibold mb-0.5">Uraian</p>
              <p className="break-words whitespace-pre-wrap">{order.notes.trim()}</p>
            </div>
          </>
        )}
        <p className="text-xs mt-2 mb-1">--------------------------------</p>
        <div className="space-y-1 text-xs">
          {(order.items ?? []).map((it, i) => (
            <p key={i} className="flex justify-between">
              <span>
                {it.service_package?.name ?? 'Layanan'} ({it.quantity} {it.service_package?.unit ?? 'pcs'})
              </span>
              <span>{fmt(Number(it.subtotal))}</span>
            </p>
          ))}
        </div>
        <p className="text-xs mt-2 mb-1">--------------------------------</p>
        {discount > 0 && (
          <p className="flex justify-between text-xs mb-1">
            <span>Diskon</span>
            <span>- {fmt(discount)}</span>
          </p>
        )}
        <p className="flex justify-between text-xs font-bold mt-2">
          <span>TOTAL</span>
          <span>{fmt(total)}</span>
        </p>
        <p className="flex justify-between text-xs">
          <span>DP Terbayar</span>
          <span>{fmt(paid)}</span>
        </p>
        <p className="flex justify-between text-xs font-bold">
          <span>Sisa Tagihan</span>
          <span>{fmt(sisa)}</span>
        </p>
        <p className="text-xs mt-2 mb-1">--------------------------------</p>
        {showEstimateDiffFooter && estimateStr && (
          <p className="text-xs">
            Estimasi selesai (awal): {estimateStr}
          </p>
        )}
        <p className="text-xs mt-2 text-center">
          Scan QR / Cek status di aplikasi
        </p>
        <p className="text-xs mt-2 text-center">
          Terima kasih atas kunjungannya
        </p>
        <p className="text-xs mt-2 text-center">
          ---------------------------------
        </p>
      </div>
    </div>
  )
}
