import { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { customersApi, servicePackagesApi, ordersApi } from '../services/api'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { PAYMENT_METHODS } from '@/lib/paymentMethods'
import { isMemberBenefitsActiveNow } from '@/lib/memberValidity'

type Customer = {
  id: number
  name: string
  phone?: string
  is_member?: boolean
  member_discount?: number | null
  member_valid_from?: string | null
  member_valid_until?: string | null
}
type Package = {
  id: number
  name: string
  price_per_unit: number
  unit: string
  type?: string
  category?: string | null
  sort_order?: number
  group_slug?: string | null
  group_title?: string | null
  variant_label?: string | null
  speed?: string | null
  estimate_minutes?: number | null
  is_active?: boolean
}

type OrderServiceSpeed = 'reguler' | 'express'

/** Speed kosong = layanan netral (muncul di tab Reguler dan Express). */
function packageMatchesOrderSpeed(pkg: Package, tier: OrderServiceSpeed): boolean {
  const s = String(pkg.speed ?? '')
    .trim()
    .toLowerCase()
  if (s === '') return true
  return tier === 'reguler' ? s === 'reguler' : s === 'express'
}

/** true → input berat (kg); false → jumlah bulat (pcs, lembar, pasang, …). */
function packageUsesWeightKg(pkg: Package): boolean {
  const t = (pkg.type || '').toLowerCase()
  if (t === 'kiloan') return true
  return (pkg.unit || '').toLowerCase() === 'kg'
}

function normalizeGroupSlug(raw: string | null | undefined): string | null {
  const s = (raw || '').trim()
  return s.length > 0 ? s : null
}

function packageRowIcon(pkg: Package): string {
  const u = (pkg.unit || '').toLowerCase()
  if (u === 'lembar') return 'view_week'
  if (u === 'pcs' || u === 'pasang' || u === 'buah') return 'checkroom'
  if (pkg.name.toLowerCase().includes('setrika') && !pkg.name.toLowerCase().includes('cuci')) return 'iron'
  return 'laundry'
}

function unitQtySuffix(pkg: Package): string {
  const u = (pkg.unit || '').toLowerCase()
  if (u === 'kg') return 'kg'
  if (u === 'lembar') return 'lembar'
  if (u === 'pasang') return 'pasang'
  if (u === 'buah') return 'buah'
  return 'pcs'
}

function unitQtyLabel(pkg: Package): string {
  const u = unitQtySuffix(pkg)
  return u.charAt(0).toUpperCase() + u.slice(1)
}

function packageMatchesSearchText(pkg: Package, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase()
  if (!q) return true
  const hay = [pkg.name, pkg.category, pkg.group_title, pkg.variant_label, pkg.group_slug]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(n)

const formatEstimateId = (iso: string) => {
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

function formatForDatetimeLocal(iso: string | undefined | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Selaras OrderDetail: backdate paling jauh satu hari kalender (awal kemarin). */
function minDatetimeLocalOneCalendarDayBack(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  d.setHours(0, 0, 0, 0)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function OrderForm() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(false)
  const [customerId, setCustomerId] = useState<string>('all')
  const [customerOpen, setCustomerOpen] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const customerInputRef = useRef<HTMLInputElement>(null)
  const estimateReadyUserEditedRef = useRef(false)

  useEffect(() => {
    if (customerOpen) {
      setCustomerSearch('')
      requestAnimationFrame(() => customerInputRef.current?.focus())
    }
  }, [customerOpen])
  const [selectedPackageIds, setSelectedPackageIds] = useState<number[]>([])
  /** Qty per paket: kg (desimal) untuk kiloan, bilangan bulat untuk satuan. */
  const [quantityByPackageId, setQuantityByPackageId] = useState<Record<number, number>>({})
  /** Varian aktif per grup (group_slug) untuk layanan bertingkat Reguler/Express. */
  const [variantIdByGroupSlug, setVariantIdByGroupSlug] = useState<Record<string, number>>({})
  /** Tab order: hanya layanan yang cocok (speed + netral) yang ditampilkan. */
  const [orderServiceSpeed, setOrderServiceSpeed] = useState<OrderServiceSpeed>('reguler')
  const [serviceSearch, setServiceSearch] = useState('')
  const orderSpeedInitRef = useRef(true)
  const [discount, setDiscount] = useState(0)
  const [paid, setPaid] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [receiptNumber, setReceiptNumber] = useState('')
  const [transactionCategoryPreset, setTransactionCategoryPreset] = useState<string>('__none__')
  const [transactionCategoryOther, setTransactionCategoryOther] = useState('')
  const [estimateReadyLocal, setEstimateReadyLocal] = useState('')
  /** Bumps every minute + on tab focus so membership window re-evaluates without full reload. */
  const [membershipClock, setMembershipClock] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setMembershipClock((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return
      customersApi
        .list({ exclude_blacklisted: '1', per_page: '500' })
        .then((r) => {
          const res = r.data as { data?: Customer[] } | Customer[]
          setCustomers(Array.isArray(res) ? res : res.data ?? [])
        })
      setMembershipClock((n) => n + 1)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => {
    customersApi
      .list({ exclude_blacklisted: '1', per_page: '500' })
      .then((r) => {
        const res = r.data as { data?: Customer[] } | Customer[]
        setCustomers(Array.isArray(res) ? res : res.data ?? [])
      })
    servicePackagesApi
      .list()
      .then((r) => {
        const data = r.data as { data?: Package[] } | Package[]
        const list = Array.isArray(data) ? data : data.data ?? r.data ?? []
        setPackages(list)
        setSelectedPackageIds((prev) => {
          const filtered = list.filter(
            (p: Package) => p.is_active !== false && packageMatchesOrderSpeed(p, 'reguler')
          )
          const kept = prev.filter((id) => filtered.some((p: Package) => p.id === id))
          if (kept.length > 0) return kept
          return filtered.length ? [filtered[0].id] : []
        })
      })
  }, [])

  useEffect(() => {
    if (customerId === 'all') return
    if (!customers.some((c) => String(c.id) === customerId)) {
      setCustomerId('all')
    }
  }, [customers, customerId])

  const filteredPackages = useMemo(() => {
    return packages.filter((p) => {
      if (p.is_active === false) return false
      return packageMatchesOrderSpeed(p, orderServiceSpeed)
    })
  }, [packages, orderServiceSpeed])

  /** Jika satu varian grup cocok pencarian, tampilkan seluruh varian grup itu. */
  const searchFilteredPackages = useMemo(() => {
    const q = serviceSearch.trim()
    if (!q) return filteredPackages

    const groupSlugsWithMatch = new Set<string>()
    for (const p of filteredPackages) {
      if (packageMatchesSearchText(p, q)) {
        const g = normalizeGroupSlug(p.group_slug)
        if (g) groupSlugsWithMatch.add(g)
      }
    }

    return filteredPackages.filter((p) => {
      if (packageMatchesSearchText(p, q)) return true
      const g = normalizeGroupSlug(p.group_slug)
      return g != null && groupSlugsWithMatch.has(g)
    })
  }, [filteredPackages, serviceSearch])

  const { ungroupedPackages, packageGroups } = useMemo(() => {
    const ungrouped: Package[] = []
    const bySlug = new Map<string, Package[]>()
    for (const p of searchFilteredPackages) {
      const g = normalizeGroupSlug(p.group_slug)
      if (!g) {
        ungrouped.push(p)
      } else {
        const list = bySlug.get(g) ?? []
        list.push(p)
        bySlug.set(g, list)
      }
    }
    const sortPkg = (a: Package, b: Package) => {
      const ao = a.sort_order ?? 0
      const bo = b.sort_order ?? 0
      if (ao !== bo) return ao - bo
      return (a.variant_label || a.name).localeCompare(b.variant_label || b.name, 'id')
    }
    ungrouped.sort(sortPkg)
    for (const [, list] of bySlug) {
      list.sort(sortPkg)
    }
    const groups = Array.from(bySlug.entries())
      .sort((a, b) => {
        const aa = a[1][0]
        const bb = b[1][0]
        const ao = aa?.sort_order ?? 0
        const bo = bb?.sort_order ?? 0
        if (ao !== bo) return ao - bo
        return (aa?.group_title || aa?.name || '').localeCompare(bb?.group_title || bb?.name || '', 'id')
      })
      .map(([slug, variants]) => ({ slug, variants }))
    return { ungroupedPackages: ungrouped, packageGroups: groups }
  }, [searchFilteredPackages])

  useEffect(() => {
    if (orderSpeedInitRef.current) {
      orderSpeedInitRef.current = false
      return
    }
    setSelectedPackageIds([])
    setQuantityByPackageId({})
    setVariantIdByGroupSlug({})
    toast.info('Tipe order diubah. Pilih layanan ulang.')
  }, [orderServiceSpeed])

  useEffect(() => {
    setVariantIdByGroupSlug((prev) => {
      const next = { ...prev }
      for (const { slug, variants } of packageGroups) {
        if (variants.length === 0) continue
        const selectedInGroup = selectedPackageIds.find((id) => variants.some((v) => v.id === id))
        if (selectedInGroup != null) {
          next[slug] = selectedInGroup
          continue
        }
        const cur = next[slug]
        const valid = cur != null && variants.some((v) => v.id === cur)
        if (!valid) next[slug] = variants[0].id
      }
      for (const k of Object.keys(next)) {
        if (!packageGroups.some((g) => g.slug === k)) delete next[k]
      }
      return next
    })
  }, [packageGroups, selectedPackageIds])

  const items: { service_package_id: number; quantity: number }[] = []
  for (const pkgId of selectedPackageIds) {
    const pkg = packages.find((p) => p.id === pkgId)
    if (!pkg) continue
    const q = quantityByPackageId[pkgId] ?? 0
    if (q > 0) items.push({ service_package_id: pkgId, quantity: q })
  }

  const subtotal = items.reduce((sum, it) => {
    const pkg = packages.find((p) => p.id === it.service_package_id)
    return sum + (pkg ? Number(pkg.price_per_unit) * it.quantity : 0)
  }, 0)
  const total = Math.max(0, subtotal - discount)
  const sisa = Math.max(0, total - paid)
  const canSubmit = customerId && customerId !== 'all' && items.length > 0

  const selectedCustomer = customers.find((c) => String(c.id) === customerId)

  /** Sama seperti OrderService::create: max estimate_minutes dari semua baris order. */
  const estimateReadyPreviewIso = useMemo(() => {
    if (items.length === 0) return null
    let maxM = 0
    for (const it of items) {
      const pkg = packages.find((p) => p.id === it.service_package_id)
      const m = pkg?.estimate_minutes != null ? Math.max(0, Number(pkg.estimate_minutes)) : 0
      maxM = Math.max(maxM, m)
    }
    if (maxM <= 0) return null
    const d = new Date()
    d.setMinutes(d.getMinutes() + maxM)
    return d.toISOString()
  }, [items, packages])

  useEffect(() => {
    if (estimateReadyUserEditedRef.current) return
    if (estimateReadyPreviewIso) {
      setEstimateReadyLocal(formatForDatetimeLocal(estimateReadyPreviewIso))
    } else {
      setEstimateReadyLocal('')
    }
  }, [estimateReadyPreviewIso])

  const estimateDisplayIso = useMemo(() => {
    const v = estimateReadyLocal.trim()
    if (v) {
      const d = new Date(v)
      if (!Number.isNaN(d.getTime())) return d.toISOString()
    }
    return estimateReadyPreviewIso
  }, [estimateReadyLocal, estimateReadyPreviewIso])

  // Auto-apply member discount when customer is member (within validity) and subtotal changes
  useEffect(() => {
    const c = selectedCustomer
    const pct =
      isMemberBenefitsActiveNow(c) && c?.member_discount != null ? Number(c.member_discount) : 0
    if (pct > 0 && subtotal > 0) {
      setDiscount(Math.round((subtotal * pct) / 100))
    } else if (pct === 0) {
      setDiscount(0)
    }
  }, [
    subtotal,
    selectedCustomer?.id,
    selectedCustomer?.is_member,
    selectedCustomer?.member_discount,
    selectedCustomer?.member_valid_from,
    selectedCustomer?.member_valid_until,
    membershipClock,
  ])

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase()
    if (!q) return customers
    const qDigits = q.replace(/\D/g, '')
    return customers.filter((c) => {
      const nameMatch = (c.name || '').toLowerCase().includes(q)
      const phoneMatch = (c.phone || '').toLowerCase().includes(q)
      const phoneDigitsMatch =
        qDigits.length > 0 && (c.phone || '').replace(/\D/g, '').includes(qDigits)
      return nameMatch || phoneMatch || phoneDigitsMatch
    })
  }, [customers, customerSearch])

  /** Metode bayar hanya relevan saat ada DP; pelunasan & metode dicatat di detail order. */
  const showPaymentMethodForDp = paid > 0

  useEffect(() => {
    if (paid <= 0) setPaymentMethod('')
  }, [paid])

  const transactionCategory =
    transactionCategoryPreset === '__other__'
      ? transactionCategoryOther.trim() || undefined
      : transactionCategoryPreset === '__none__'
        ? undefined
        : transactionCategoryPreset.trim() || undefined

  const togglePackage = (id: number) => {
    const pkg = packages.find((p) => p.id === id)
    const slug = pkg ? normalizeGroupSlug(pkg.group_slug) : null
    const groupIds = slug
      ? filteredPackages
          .filter((p) => normalizeGroupSlug(p.group_slug) === slug)
          .map((p) => p.id)
      : []

    setSelectedPackageIds((prev) => {
      if (prev.includes(id)) {
        setQuantityByPackageId((q) => {
          const next = { ...q }
          delete next[id]
          return next
        })
        return prev.filter((x) => x !== id)
      }
      setQuantityByPackageId((q) => {
        const n = { ...q, [id]: q[id] ?? 0 }
        if (slug) {
          for (const gid of groupIds) {
            if (gid !== id) delete n[gid]
          }
        }
        return n
      })
      if (slug) {
        const without = prev.filter((x) => !groupIds.includes(x))
        return [...without, id]
      }
      return [...prev, id]
    })
  }

  const setGroupVariant = (slug: string, newPackageId: number) => {
    const group = packageGroups.find((g) => g.slug === slug)
    if (!group) return
    const oldIds = group.variants.map((v) => v.id)

    setVariantIdByGroupSlug((prev) => ({ ...prev, [slug]: newPackageId }))

    setSelectedPackageIds((prev) => {
      const had = prev.some((pid) => oldIds.includes(pid))
      const without = prev.filter((pid) => !oldIds.includes(pid))
      if (had) return [...without, newPackageId]
      return without
    })

    setQuantityByPackageId((prev) => {
      const next = { ...prev }
      let qty = 0
      for (const oid of oldIds) {
        if ((next[oid] ?? 0) > 0) qty = next[oid]!
        delete next[oid]
      }
      if (qty > 0) next[newPackageId] = qty
      return next
    })
  }

  const setQtyForPackage = (pkg: Package, raw: string) => {
    const trimmed = raw.trim()
    if (trimmed === '') {
      setQuantityByPackageId((prev) => ({ ...prev, [pkg.id]: 0 }))
      return
    }
    if (packageUsesWeightKg(pkg)) {
      const n = parseFloat(trimmed.replace(',', '.'))
      setQuantityByPackageId((prev) => ({
        ...prev,
        [pkg.id]: Number.isFinite(n) && n >= 0 ? n : 0,
      }))
    } else {
      const n = parseInt(trimmed, 10)
      setQuantityByPackageId((prev) => ({
        ...prev,
        [pkg.id]: Number.isFinite(n) && n >= 0 ? n : 0,
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent, printAfter = false) => {
    e.preventDefault()
    const cId = customerId === 'all' ? '' : customerId
    if (!cId) {
      toast.error('Pilih pelanggan terlebih dahulu.')
      return
    }
    if (selectedPackageIds.length === 0) {
      toast.error('Pilih minimal satu layanan.')
      return
    }
    if (items.length === 0) {
      toast.error(
        'Isi jumlah atau berat per layanan yang dipilih (kg untuk kiloan; bilangan bulat untuk satuan: pcs, lembar, dll.).'
      )
      return
    }
    if (paid > 0 && !paymentMethod.trim()) {
      toast.error('Pilih metode pembayaran untuk DP (uang muka).')
      return
    }
    setLoading(true)
    const printWin = printAfter ? window.open('about:blank', '_blank') : null
    try {
      const res = await ordersApi.create({
        customer_id: Number(cId),
        service_speed: orderServiceSpeed,
        items: items.map((i) => ({ service_package_id: i.service_package_id, quantity: i.quantity })),
        discount,
        paid,
        payment_method: showPaymentMethodForDp && paymentMethod.trim() ? paymentMethod : undefined,
        notes: notes.trim() || undefined,
        receipt_number: receiptNumber.trim() || undefined,
        transaction_category: transactionCategory,
        estimate_ready_at:
          estimateReadyLocal.trim() && !Number.isNaN(new Date(estimateReadyLocal).getTime())
            ? new Date(estimateReadyLocal).toISOString()
            : undefined,
      })
      const orderData = res?.data as { id?: number } | undefined
      const orderId = orderData?.id

      if (printAfter && orderId) {
        const printUrl = `${window.location.origin}/dashboard/orders/${orderId}/print`
        if (printWin && !printWin.closed) {
          printWin.location.href = printUrl
        } else {
          const w = window.open(printUrl, '_blank')
          if (!w && printAfter) toast.info('Izinkan popup browser untuk cetak struk otomatis')
        }
      }
      if (orderId) {
        navigate(`/dashboard/orders/${orderId}`)
        toast.success(
          'Order berhasil dibuat. Ringkasan ke WhatsApp outlet (Fonnte) dikirim otomatis jika notifikasi aktif di Pengaturan. Silakan unggah foto bukti jika ada.'
        )
      } else {
        navigate('/dashboard/orders')
      }
    } catch (err) {
      if (printWin && !printWin.closed) printWin.close()
      toast.error('Gagal menyimpan order')
      throw err
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 min-w-0 w-full overflow-y-auto overflow-x-clip bg-background p-4 font-body text-on-background sm:p-6 lg:p-10">
      <div className="mx-auto w-full min-w-0 max-w-6xl">
        {/* Breadcrumb - design shows in header; we place above title for same visual */}
        <div className="flex items-center gap-2 text-sm mb-6">
          <Link to="/dashboard/orders" className="text-on-surface-variant font-medium hover:text-primary">
            Order
          </Link>
          <span className="material-symbols-outlined text-outline text-sm">chevron_right</span>
          <span className="text-on-surface font-bold">Buat Order Baru</span>
        </div>
        <div className="mb-10">
          <h2 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl lg:text-4xl">
            Buat Order Baru
          </h2>
          <p className="mt-2 text-base text-on-surface-variant sm:text-lg">
            Input detail cucian pelanggan dengan presisi.
          </p>
        </div>

        <form onSubmit={(e) => handleSubmit(e, false)} className="grid grid-cols-12 items-start gap-6 sm:gap-8">
          {/* Left: Form - exact section structure from design */}
          <div className="col-span-12 lg:col-span-7 space-y-8">
            {/* Data Pelanggan - design: section bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-outline-variant/20 */}
            <section className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4 shadow-sm sm:p-8">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="w-10 h-10 shrink-0 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
                    <span className="material-symbols-outlined">person_add</span>
                  </div>
                  <h3 className="text-lg font-bold font-headline sm:text-xl">Data Pelanggan</h3>
                </div>
                <Link
                  to="/dashboard/customers/new"
                  className="shrink-0 text-sm font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  Tambah Baru
                </Link>
              </div>
              <div className="space-y-4">
                <label className="block text-sm font-semibold text-on-surface-variant">
                  Cari Pelanggan Terdaftar <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setCustomerOpen((o) => !o)}
                    className={cn(
                      'flex items-center gap-3 w-full rounded-xl border-2 bg-surface-container-low transition-all text-left',
                      customerOpen
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-outline-variant/40 hover:border-outline-variant'
                    )}
                  >
                    <span className="material-symbols-outlined pl-4 text-outline shrink-0">
                      search
                    </span>
                    <span className={cn(
                      'flex-1 min-w-0 py-4 pr-4 text-sm font-medium',
                      selectedCustomer ? 'text-on-surface' : 'text-outline'
                    )}>
                      {selectedCustomer
                        ? `${selectedCustomer.name}${selectedCustomer.phone ? ` - ${selectedCustomer.phone}` : ''}`
                        : 'Pilih pelanggan...'}
                    </span>
                    <span className="material-symbols-outlined pr-4 text-outline shrink-0">
                      {customerOpen ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>
                  {customerOpen && (
                    <div className="absolute z-50 mt-1 w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-xl overflow-hidden">
                      <div className="flex items-center gap-2 p-2 border-b border-outline-variant/20 bg-surface-container-low">
                        <span className="material-symbols-outlined text-outline text-lg pl-1">search</span>
                        <input
                          ref={customerInputRef}
                          type="text"
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          onBlur={() => setTimeout(() => setCustomerOpen(false), 200)}
                          onKeyDown={(e) => {
                            e.stopPropagation()
                            if (e.key === 'Escape') setCustomerOpen(false)
                          }}
                          placeholder="Cari nama atau nomor telepon..."
                          className="flex-1 min-w-0 py-2 pr-2 bg-transparent text-on-surface placeholder:text-outline outline-none text-sm"
                        />
                      </div>
                      <div className="max-h-52 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerId('all')
                          setCustomerSearch('')
                          setCustomerOpen(false)
                        }}
                        className={cn(
                          'w-full px-4 py-3 text-left text-sm font-medium flex items-center justify-between gap-2 transition-colors',
                          customerId === 'all'
                            ? 'bg-palette-sky/40 text-on-surface'
                            : 'text-on-surface-variant hover:bg-palette-sky/30'
                        )}
                      >
                        Pilih pelanggan...
                        {customerId === 'all' && (
                          <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                            check
                          </span>
                        )}
                      </button>
                      {filteredCustomers.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-on-surface-variant">
                          Tidak ada pelanggan ditemukan
                        </div>
                      ) : (
                        filteredCustomers.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setCustomerId(String(c.id))
                              setCustomerSearch('')
                              setCustomerOpen(false)
                            }}
                            className={cn(
                              'w-full px-4 py-3 text-left text-sm font-medium flex items-center justify-between gap-2 transition-colors',
                              customerId === String(c.id)
                                ? 'bg-palette-sky/40 text-on-surface'
                                : 'text-on-surface-variant hover:bg-palette-sky/30'
                            )}
                          >
                            <span className="min-w-0 truncate">
                              {c.name} {c.phone ? `- ${c.phone}` : ''}
                            </span>
                            {customerId === String(c.id) && (
                              <span className="material-symbols-outlined text-primary text-lg shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                                check
                              </span>
                            )}
                          </button>
                        ))
                      )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Layanan & Berat - design: same section, then grid grid-cols-2 gap-6 mb-8 */}
            <section className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4 shadow-sm sm:p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center">
                    <span className="material-symbols-outlined">dry_cleaning</span>
                  </div>
                  <h3 className="text-xl font-bold font-headline">Layanan & Berat</h3>
                </div>
                <Link
                  to="/dashboard/layanan"
                  className="text-sm font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">edit_square</span>
                  Kelola Harga
                </Link>
              </div>

              <div className="col-span-2 space-y-3 mb-8">
                <div>
                  <span className="block text-sm font-semibold text-on-surface-variant mb-2">
                    Tipe order
                  </span>
                  <div
                    className="flex rounded-xl border border-outline-variant/30 bg-surface-container-low p-1 gap-1 mb-4"
                    role="group"
                    aria-label="Tipe order Reguler atau Express"
                  >
                    {(
                      [
                        { id: 'reguler' as const, label: 'Reguler' },
                        { id: 'express' as const, label: 'Express' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setOrderServiceSpeed(opt.id)}
                        className={cn(
                          'flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors',
                          orderServiceSpeed === opt.id
                            ? 'bg-primary text-on-primary shadow-sm'
                            : 'text-on-surface-variant hover:bg-surface-container-highest/80'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <label className="block text-sm font-semibold text-on-surface-variant">
                    Pilih Layanan
                  </label>
                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                    Hanya layanan yang sesuai tipe order di atas yang ditampilkan. Layanan tanpa kecepatan di{' '}
                    <Link to="/dashboard/layanan" className="font-medium text-primary hover:underline">
                      Kelola Harga
                    </Link>{' '}
                    muncul di <strong>kedua</strong> tipe. Bisa pilih lebih dari satu layanan; ketuk lagi untuk membatalkan.
                  </p>
                  <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                    Beberapa varian harga dalam <strong>satu kartu</strong> (dropdown): set{' '}
                    <strong>slug grup</strong> sama di Kelola Harga untuk baris yang berbeda.
                  </p>
                  {filteredPackages.length === 0 && packages.length > 0 && (
                    <p className="text-[11px] text-amber-800 dark:text-amber-200/90 mt-2 rounded-lg bg-amber-500/10 px-3 py-2 border border-amber-500/20">
                      Tidak ada layanan aktif untuk tipe ini. Ubah kecepatan layanan di Kelola Harga atau pilih tipe lain.
                    </p>
                  )}
                </div>
                <div className="space-y-2 mb-3">
                  <label htmlFor="order-service-search" className="text-sm font-semibold text-on-surface-variant">
                    Cari layanan
                  </label>
                  <div className="relative">
                    <span
                      className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg pointer-events-none"
                      aria-hidden
                    >
                      search
                    </span>
                    <Input
                      id="order-service-search"
                      type="search"
                      placeholder="Nama, kategori, atau varian…"
                      value={serviceSearch}
                      onChange={(e) => setServiceSearch(e.target.value)}
                      className="h-10 pl-10 rounded-xl border border-outline-variant/30 bg-surface-container-low text-sm"
                      autoComplete="off"
                    />
                  </div>
                </div>
                <div className="max-h-[min(60vh,28rem)] md:max-h-[min(72vh,36rem)] overflow-y-auto rounded-xl border border-outline-variant/20 bg-surface-container-low/30">
                  {searchFilteredPackages.length === 0 && filteredPackages.length > 0 && (
                    <p className="p-4 text-sm text-on-surface-variant text-center">
                      Tidak ada layanan yang cocok. Kosongkan pencarian atau ubah kata kunci.
                    </p>
                  )}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm border-collapse">
                      <thead className="sticky top-0 z-10 bg-surface-container-lowest/95 backdrop-blur border-b border-outline-variant/25">
                        <tr className="text-left text-on-surface-variant">
                          <th className="w-11 py-2.5 pl-3 font-semibold">Pilih</th>
                          <th className="py-2.5 pr-2 font-semibold">Layanan</th>
                          <th className="py-2.5 pr-2 font-semibold text-right whitespace-nowrap">Harga</th>
                          <th className="py-2.5 pr-2 font-semibold min-w-[10rem]">Varian</th>
                          <th className="py-2.5 pr-3 font-semibold w-36">Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/15">
                        {packageGroups.map(({ slug, variants }) => {
                          const activeId = variantIdByGroupSlug[slug] ?? variants[0]?.id
                          const pkg = variants.find((v) => v.id === activeId) ?? variants[0]
                          if (!pkg) return null
                          const selected = selectedPackageIds.includes(pkg.id)
                          const usesWeight = packageUsesWeightKg(pkg)
                          const qty = quantityByPackageId[pkg.id] ?? 0
                          const groupHeading =
                            variants[0]?.group_title?.trim() ||
                            variants[0]?.category?.trim() ||
                            variants[0]?.name ||
                            slug
                          return (
                            <tr
                              key={slug}
                              className={cn(selected ? 'bg-primary/[0.06]' : 'hover:bg-surface-container-low/80')}
                            >
                              <td className="py-2 pl-3 align-middle">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => togglePackage(pkg.id)}
                                  className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
                                  aria-label={`Pilih ${groupHeading}`}
                                />
                              </td>
                              <td className="py-2 pr-2 align-middle">
                                <span className="font-medium text-on-surface">{groupHeading}</span>
                                {variants[0]?.category?.trim() && (
                                  <span className="block text-[11px] text-on-surface-variant">
                                    {variants[0].category}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 pr-2 align-middle text-right font-semibold text-primary whitespace-nowrap">
                                {fmt(Number(pkg.price_per_unit))}/{pkg.unit}
                              </td>
                              <td className="py-2 pr-2 align-middle">
                                {variants.length > 1 ? (
                                  <Select
                                    value={String(activeId)}
                                    onValueChange={(v) => setGroupVariant(slug, Number(v))}
                                  >
                                    <SelectTrigger className="h-9 w-full min-w-[8rem] rounded-lg border border-outline-variant/30 bg-surface-container-lowest text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {variants.map((v) => (
                                        <SelectItem key={v.id} value={String(v.id)}>
                                          {(v.variant_label || v.name).trim()} — {fmt(Number(v.price_per_unit))}/
                                          {v.unit}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <span className="text-on-surface-variant">—</span>
                                )}
                              </td>
                              <td className="py-2 pr-3 align-middle">
                                {selected ? (
                                  <div className="flex items-center gap-1.5 max-w-[9rem]">
                                    <Input
                                      id={`order-qty-desk-${pkg.id}`}
                                      type="number"
                                      min={0}
                                      step={usesWeight ? 0.1 : 1}
                                      inputMode={usesWeight ? 'decimal' : 'numeric'}
                                      value={qty === 0 ? '' : qty}
                                      onChange={(e) => setQtyForPackage(pkg, e.target.value)}
                                      className="h-9 flex-1 min-w-0 text-sm rounded-lg border border-outline-variant/35 bg-surface-container-lowest px-2"
                                    />
                                    <span className="text-[11px] font-semibold text-outline shrink-0 w-8">
                                      {unitQtyLabel(pkg)}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-on-surface-variant">—</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                        {ungroupedPackages.map((pkg) => {
                          const selected = selectedPackageIds.includes(pkg.id)
                          const usesWeight = packageUsesWeightKg(pkg)
                          const qty = quantityByPackageId[pkg.id] ?? 0
                          return (
                            <tr
                              key={pkg.id}
                              className={cn(selected ? 'bg-primary/[0.06]' : 'hover:bg-surface-container-low/80')}
                            >
                              <td className="py-2 pl-3 align-middle">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => togglePackage(pkg.id)}
                                  className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
                                  aria-label={`Pilih ${pkg.name}`}
                                />
                              </td>
                              <td className="py-2 pr-2 align-middle font-medium text-on-surface">{pkg.name}</td>
                              <td className="py-2 pr-2 align-middle text-right font-semibold text-primary whitespace-nowrap">
                                {fmt(Number(pkg.price_per_unit))}/{pkg.unit}
                              </td>
                              <td className="py-2 pr-2 align-middle text-on-surface-variant">—</td>
                              <td className="py-2 pr-3 align-middle">
                                {selected ? (
                                  <div className="flex items-center gap-1.5 max-w-[9rem]">
                                    <Input
                                      id={`order-qty-desk-ug-${pkg.id}`}
                                      type="number"
                                      min={0}
                                      step={usesWeight ? 0.1 : 1}
                                      inputMode={usesWeight ? 'decimal' : 'numeric'}
                                      value={qty === 0 ? '' : qty}
                                      onChange={(e) => setQtyForPackage(pkg, e.target.value)}
                                      className="h-9 flex-1 min-w-0 text-sm rounded-lg border border-outline-variant/35 bg-surface-container-lowest px-2"
                                    />
                                    <span className="text-[11px] font-semibold text-outline shrink-0 w-8">
                                      {unitQtyLabel(pkg)}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-on-surface-variant">—</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="md:hidden p-2 space-y-2">
                  {packageGroups.map(({ slug, variants }) => {
                    const activeId = variantIdByGroupSlug[slug] ?? variants[0]?.id
                    const pkg = variants.find((v) => v.id === activeId) ?? variants[0]
                    if (!pkg) return null
                    const selected = selectedPackageIds.includes(pkg.id)
                    const usesWeight = packageUsesWeightKg(pkg)
                    const qty = quantityByPackageId[pkg.id] ?? 0
                    const groupHeading =
                      variants[0]?.group_title?.trim() ||
                      variants[0]?.category?.trim() ||
                      variants[0]?.name ||
                      slug
                    return (
                      <div
                        key={slug}
                        className={cn(
                          'rounded-xl border bg-surface-container-low transition-all overflow-hidden',
                          selected
                            ? 'border-primary ring-1 ring-primary/20'
                            : 'border-outline-variant/25 hover:border-outline-variant/50'
                        )}
                      >
                        <button
                          type="button"
                          aria-pressed={selected}
                          onClick={() => togglePackage(pkg.id)}
                          className="flex w-full cursor-pointer items-center justify-between gap-2 p-3 text-left min-h-[3.25rem]"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className={cn(
                                'material-symbols-outlined text-lg shrink-0',
                                selected ? 'text-primary' : 'text-on-surface-variant'
                              )}
                            >
                              {packageRowIcon(pkg)}
                            </span>
                            <div className="min-w-0 text-left">
                              <span className="block truncate text-sm font-semibold leading-tight">
                                {groupHeading}
                              </span>
                              {variants[0]?.category?.trim() && (
                                <span className="block text-[10px] text-on-surface-variant truncate leading-tight">
                                  {variants[0].category}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="shrink-0 text-sm font-bold text-primary whitespace-nowrap tabular-nums">
                            {fmt(Number(pkg.price_per_unit))}/{pkg.unit}
                          </span>
                        </button>
                        {variants.length > 1 && (
                          <div
                            className="px-3 pb-2 border-t border-outline-variant/10"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <label htmlFor={`order-variant-${slug}`} className="sr-only">
                              Varian layanan
                            </label>
                            <Select
                              value={String(activeId)}
                              onValueChange={(v) => setGroupVariant(slug, Number(v))}
                            >
                              <SelectTrigger
                                id={`order-variant-${slug}`}
                                className="h-9 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest text-left text-xs"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest">
                                {variants.map((v) => (
                                  <SelectItem key={v.id} value={String(v.id)} className="rounded-lg">
                                    {(v.variant_label || v.name).trim()} — {fmt(Number(v.price_per_unit))}/{v.unit}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {selected && (
                          <div
                            className="px-3 pb-3 border-t border-outline-variant/20"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <label
                              htmlFor={`order-qty-${pkg.id}`}
                              className="block text-[11px] font-semibold text-on-surface-variant mb-1 mt-2"
                            >
                              {usesWeight ? 'Berat' : 'Jumlah'}{' '}
                              <span className="text-destructive">*</span>
                              <span className="font-normal text-on-surface-variant/90">
                                {' '}
                                ({unitQtySuffix(pkg)})
                              </span>
                            </label>
                            <div className="flex items-center bg-surface-container-lowest/90 rounded-lg px-3 py-2 border border-outline-variant/30 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all">
                              <Input
                                id={`order-qty-${pkg.id}`}
                                type="number"
                                min={0}
                                step={usesWeight ? 0.1 : 1}
                                inputMode={usesWeight ? 'decimal' : 'numeric'}
                                value={qty === 0 ? '' : qty}
                                onChange={(e) => setQtyForPackage(pkg, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full bg-transparent border-none text-lg font-semibold p-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-auto"
                              />
                              <span className="text-outline font-bold shrink-0 ml-1 text-sm">
                                {unitQtyLabel(pkg)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {ungroupedPackages.map((pkg) => {
                    const selected = selectedPackageIds.includes(pkg.id)
                    const usesWeight = packageUsesWeightKg(pkg)
                    const qty = quantityByPackageId[pkg.id] ?? 0
                    return (
                      <div
                        key={pkg.id}
                        className={cn(
                          'rounded-xl border bg-surface-container-low transition-all overflow-hidden',
                          selected
                            ? 'border-primary ring-1 ring-primary/20'
                            : 'border-outline-variant/25 hover:border-outline-variant/50'
                        )}
                      >
                        <button
                          type="button"
                          aria-pressed={selected}
                          onClick={() => togglePackage(pkg.id)}
                          className="flex w-full cursor-pointer items-center justify-between gap-2 p-3 text-left min-h-[3.25rem]"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className={cn(
                                'material-symbols-outlined text-lg shrink-0',
                                selected ? 'text-primary' : 'text-on-surface-variant'
                              )}
                            >
                              {packageRowIcon(pkg)}
                            </span>
                            <span className="truncate text-sm font-semibold leading-tight">{pkg.name}</span>
                          </div>
                          <span className="shrink-0 text-sm font-bold text-primary whitespace-nowrap tabular-nums">
                            {fmt(Number(pkg.price_per_unit))}/{pkg.unit}
                          </span>
                        </button>
                        {selected && (
                          <div
                            className="px-3 pb-3 border-t border-outline-variant/20"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <label
                              htmlFor={`order-qty-${pkg.id}`}
                              className="block text-[11px] font-semibold text-on-surface-variant mb-1 mt-2"
                            >
                              {usesWeight ? 'Berat' : 'Jumlah'}{' '}
                              <span className="text-destructive">*</span>
                              <span className="font-normal text-on-surface-variant/90">
                                {' '}
                                ({unitQtySuffix(pkg)})
                              </span>
                            </label>
                            <div className="flex items-center bg-surface-container-lowest/90 rounded-lg px-3 py-2 border border-outline-variant/30 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all">
                              <Input
                                id={`order-qty-${pkg.id}`}
                                type="number"
                                min={0}
                                step={usesWeight ? 0.1 : 1}
                                inputMode={usesWeight ? 'decimal' : 'numeric'}
                                value={qty === 0 ? '' : qty}
                                onChange={(e) => setQtyForPackage(pkg, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full bg-transparent border-none text-lg font-semibold p-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-auto"
                              />
                              <span className="text-outline font-bold shrink-0 ml-1 text-sm">
                                {unitQtyLabel(pkg)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-outline-variant/25 bg-surface-container-low/45 p-4 sm:p-5 mb-8">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-4">
                  Tanggal
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-on-surface-variant">Tgl masuk</span>
                    <p className="text-sm font-semibold text-on-surface">Dari waktu order dibuat (otomatis).</p>
                    <p className="text-[11px] text-on-surface-variant leading-snug">
                      Akan tercatat saat Anda menyimpan order.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="order-estimate-ready"
                      className="text-xs font-medium text-on-surface-variant"
                    >
                      Tanggal selesai
                    </label>
                    <Input
                      id="order-estimate-ready"
                      type="datetime-local"
                      min={minDatetimeLocalOneCalendarDayBack()}
                      value={estimateReadyLocal}
                      onChange={(e) => {
                        estimateReadyUserEditedRef.current = true
                        setEstimateReadyLocal(e.target.value)
                      }}
                      disabled={items.length === 0}
                      className="h-11 bg-surface-container-lowest rounded-xl border border-outline-variant/35 shadow-sm disabled:opacity-60"
                    />
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">
                      Estimasi selesai (disimpan di sistem). Terisi otomatis dari durasi paket; bisa diubah. Untuk
                      pembukuan, tanggal faktual juga bisa disesuaikan di detail order setelah status Selesai.
                    </p>
                  </div>
                </div>
              </div>

              {/* Nota manual, kategori, uraian (selaras kolom Excel klien) */}
              <div className="space-y-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-on-surface-variant">
                      No. nota masuk (opsional)
                    </label>
                    <Input
                      value={receiptNumber}
                      onChange={(e) => setReceiptNumber(e.target.value)}
                      placeholder="mis. 1003"
                      className="bg-surface-container-low rounded-xl border border-outline-variant/30 h-11 px-4"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-on-surface-variant">
                      Kategori transaksi
                    </label>
                    <Select
                      value={transactionCategoryPreset}
                      onValueChange={(v) => setTransactionCategoryPreset(v ?? '__none__')}
                    >
                      <SelectTrigger className="w-full min-w-0 bg-surface-container-low rounded-xl border border-outline-variant/30 h-11 px-4">
                        <SelectValue placeholder="Pilih atau kosongkan" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl bg-surface-container-lowest border border-outline-variant/20 shadow-lg">
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
                        className="bg-surface-container-low rounded-xl border border-outline-variant/30 h-11 px-4"
                      />
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-on-surface-variant">Uraian / catatan</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Keterangan tambahan untuk order"
                    className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3 text-sm text-on-surface placeholder:text-outline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 resize-y min-h-[88px]"
                  />
                </div>
              </div>

              {/* Metode pembayaran hanya jika ada DP — pelunasan & metode final di detail order */}
              {showPaymentMethodForDp && (
                <div className="space-y-3 mb-6">
                  <label className="block text-sm font-semibold text-on-surface-variant">
                    Metode pembayaran (DP)
                  </label>
                  <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v ?? '')}>
                    <SelectTrigger className="w-full min-w-0 bg-surface-container-low rounded-xl border border-outline-variant/30 h-11 px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/70 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/50">
                      <SelectValue placeholder="Pilih metode untuk uang muka" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl bg-surface-container-lowest border border-outline-variant/20 shadow-lg">
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value} className="rounded-lg py-2.5">
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    Metode pelunasan dicatat di <strong>detail pesanan</strong> saat pembayaran lunas.
                  </p>
                </div>
              )}

              {/* Diskon + DP */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-on-surface-variant">
                    Diskon (Rp)
                    {isMemberBenefitsActiveNow(selectedCustomer) &&
                      selectedCustomer?.member_discount != null && (
                      <span className="ml-2 text-xs font-normal text-primary">
                        (Member {selectedCustomer.member_discount}% otomatis)
                      </span>
                    )}
                  </label>
                  <div className="flex items-center bg-surface-container-low rounded-xl px-4 py-3 border border-outline-variant/30 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all">
                    <span className="text-outline font-medium mr-2">Rp</span>
                    <Input
                      type="number"
                      min={0}
                      step={1000}
                      value={discount || ''}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                      className="flex-1 bg-transparent border-none text-lg font-medium p-0 focus:ring-0 focus-visible:ring-0 h-auto"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-on-surface-variant">
                    Uang Muka / DP (Rp)
                  </label>
                  <div className="flex items-center bg-surface-container-low rounded-xl px-4 py-3 border border-outline-variant/30 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all">
                    <span className="text-outline font-medium mr-2">Rp</span>
                    <Input
                      type="number"
                      min={0}
                      step={1000}
                      value={paid || ''}
                      onChange={(e) => setPaid(parseFloat(e.target.value) || 0)}
                      className="flex-1 bg-transparent border-none text-lg font-medium p-0 focus:ring-0 focus-visible:ring-0 h-auto"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Right: Summary — sticky hanya di desktop (dua kolom) */}
          <div className="col-span-12 lg:sticky lg:top-10 lg:col-span-5">
            <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-xl border border-outline-variant/30 flex flex-col">
              <div className="bg-primary p-4 text-on-primary sm:p-8">
                <h3 className="text-lg font-bold font-headline uppercase tracking-widest opacity-80 mb-1">
                  Total Pembayaran
                </h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-medium">Rp</span>
                  <span className="text-3xl font-extrabold font-headline sm:text-4xl lg:text-5xl">
                    {total.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
              <div className="flex-1 space-y-6 p-4 sm:p-8">
                <div className="space-y-4">
                  {items.map((it, i) => {
                    const pkg = packages.find((p) => p.id === it.service_package_id)
                    if (!pkg) return null
                    const sub = Number(pkg.price_per_unit) * it.quantity
                    return (
                      <div
                        key={`${it.service_package_id}-${i}`}
                        className="flex justify-between items-center text-on-surface-variant"
                      >
                        <span className="text-sm">
                          {pkg.name} ({it.quantity} {pkg.unit} x{' '}
                          {Number(pkg.price_per_unit).toLocaleString('id-ID')})
                        </span>
                        <span className="font-semibold text-on-surface">{fmt(sub)}</span>
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
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-on-surface">DP Terbayar</span>
                    <span className="font-bold text-secondary">{fmt(paid)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-on-surface">Sisa Tagihan</span>
                    <span className="font-bold text-error">{fmt(sisa)}</span>
                  </div>
                </div>
                <div className="pt-6 space-y-4">
                  <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-start gap-3">
                    <span
                      className="material-symbols-outlined text-primary shrink-0"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      info
                    </span>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      {estimateDisplayIso ? (
                        <>
                          Estimasi selesai pada{' '}
                          <span className="font-bold text-on-surface">
                            {formatEstimateId(estimateDisplayIso)}
                          </span>
                          . Ringkasan order baru dapat dikirim ke WhatsApp outlet lewat{' '}
                          <span className="font-semibold">Fonnte</span> (sesuai Pengaturan).
                        </>
                      ) : (
                        <>
                          Pilih layanan dan isi jumlah/berat per layanan untuk melihat estimasi. Ringkasan order baru dapat
                          dikirim ke WhatsApp outlet lewat <span className="font-semibold">Fonnte</span> (sesuai
                          Pengaturan).
                        </>
                      )}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      type="button"
                      disabled={loading || !canSubmit}
                      onClick={(e) => handleSubmit(e, true)}
                      className="w-full bg-gradient-to-br from-primary to-primary-container text-on-primary font-headline font-bold py-5 rounded-xl flex items-center justify-center gap-3 hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined">print</span>
                      Simpan dan Cetak Struk
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !canSubmit}
                      className="w-full bg-surface-container-highest text-on-surface-variant font-headline font-bold py-4 rounded-xl hover:bg-surface-variant transition-all disabled:opacity-50"
                    >
                      Hanya Simpan Order
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-surface-container-low border-t border-outline-variant/20 flex justify-center">
                <span className="text-[10px] uppercase font-bold text-outline tracking-tighter">
                  Resik Laundry POS v2.4.0
                </span>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
