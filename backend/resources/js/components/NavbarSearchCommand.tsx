import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandLoading,
  CommandSeparator,
} from '@/components/ui/command'
import { customersApi, ordersApi } from '@/services/api'
import { useDebounce } from '@/hooks/useDebounce'
import type { OrderRow } from '@/pages/Orders'

type CustomerHit = {
  id: number
  name: string
  phone: string
}

type PaginatedOrders = {
  data: OrderRow[]
  total: number
  current_page: number
  last_page: number
  per_page: number
}

type PaginatedCustomers = {
  data: CustomerHit[]
  total: number
}

type NavbarSearchCommandProps = {
  placeholder: string
}

export function NavbarSearchCommand({ placeholder }: NavbarSearchCommandProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const debounced = useDebounce(query, 300)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [customers, setCustomers] = useState<CustomerHit[]>([])
  const [loading, setLoading] = useState(false)
  const searchSeq = useRef(0)
  const [kbdHint, setKbdHint] = useState('Ctrl+K')

  useEffect(() => {
    if (typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.platform)) {
      setKbdHint('⌘K')
    }
  }, [])

  const runSearch = useCallback((q: string) => {
    const mySeq = ++searchSeq.current
    const term = q.trim()
    if (!term) {
      setOrders([])
      setCustomers([])
      setLoading(false)
      return
    }

    setLoading(true)

    Promise.allSettled([
      ordersApi.list({ search: term, per_page: '10' }),
      customersApi.list({ search: term, per_page: '10' }),
    ])
      .then(([oRes, cRes]) => {
        if (mySeq !== searchSeq.current) return
        if (oRes.status === 'fulfilled') {
          const body = oRes.value.data as PaginatedOrders
          setOrders(body.data ?? [])
        } else {
          setOrders([])
        }
        if (cRes.status === 'fulfilled') {
          const body = cRes.value.data as PaginatedCustomers
          setCustomers(body.data ?? [])
        } else {
          setCustomers([])
        }
      })
      .finally(() => {
        if (mySeq === searchSeq.current) setLoading(false)
      })
  }, [])

  useEffect(() => {
    runSearch(debounced)
  }, [debounced, runSearch])

  useEffect(() => {
    if (!open) {
      searchSeq.current += 1
      setQuery('')
      setOrders([])
      setCustomers([])
      setLoading(false)
    }
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const go = (path: string) => {
    setOpen(false)
    navigate(path)
  }

  const hasQuery = debounced.trim().length > 0
  const noMatches = hasQuery && !loading && orders.length === 0 && customers.length === 0

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative flex h-9 w-full max-w-full cursor-text items-center rounded-lg border-0 bg-surface-container-low pl-10 text-left text-sm text-on-surface-variant sm:max-w-40 lg:max-w-64"
        aria-label="Buka pencarian"
      >
        <span className="material-symbols-outlined pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-on-surface-variant">
          search
        </span>
        <span className="truncate pr-2">{placeholder}</span>
        <kbd className="pointer-events-none ml-auto hidden shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground lg:inline">
          {kbdHint}
        </kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        shouldFilter={false}
        title="Pencarian transaksi"
        description="Cari berdasarkan nomor order, nomor struk, nama pelanggan, atau telepon. Pilih dengan Enter."
      >
        <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
        <CommandList>
          {loading && hasQuery ? (
            <CommandLoading>Mencari…</CommandLoading>
          ) : null}

          {!hasQuery ? (
            <CommandGroup heading="Navigasi cepat">
              <CommandItem
                onSelect={() => go('/dashboard/orders')}
                value="nav-orders"
              >
                <span className="material-symbols-outlined text-base">receipt_long</span>
                Daftar order
              </CommandItem>
              <CommandItem
                onSelect={() => go('/dashboard/customers')}
                value="nav-customers"
              >
                <span className="material-symbols-outlined text-base">group</span>
                Daftar pelanggan
              </CommandItem>
            </CommandGroup>
          ) : null}

          {hasQuery && orders.length > 0 ? (
            <CommandGroup heading="Order">
              {orders.map((o) => (
                <CommandItem
                  key={o.id}
                  value={`order-${o.id}`}
                  onSelect={() => go(`/dashboard/orders/${o.id}`)}
                >
                  <span className="material-symbols-outlined text-base">receipt</span>
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium">{o.order_number}</span>
                    <span className="text-xs text-muted-foreground">{o.customer?.name}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {hasQuery && orders.length > 0 && customers.length > 0 ? <CommandSeparator /> : null}

          {hasQuery && customers.length > 0 ? (
            <CommandGroup heading="Pelanggan">
              {customers.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`customer-${c.id}`}
                  onSelect={() => go(`/dashboard/customers/${c.id}`)}
                >
                  <span className="material-symbols-outlined text-base">person</span>
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.phone}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {hasQuery && noMatches ? (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              Tidak ada order atau pelanggan yang cocok. Anda tetap bisa membuka daftar order dengan kata
              kunci ini di bawah.
            </div>
          ) : null}

          {hasQuery ? (
            <>
              <CommandSeparator />
              <CommandGroup heading="Aksi">
                <CommandItem
                  value="see-all-orders"
                  onSelect={() => {
                    const q = debounced.trim()
                    setOpen(false)
                    navigate(
                      q
                        ? `/dashboard/orders?search=${encodeURIComponent(q)}`
                        : '/dashboard/orders'
                    )
                  }}
                >
                  <span className="material-symbols-outlined text-base">filter_list</span>
                  Lihat semua order dengan filter ini
                </CommandItem>
              </CommandGroup>
            </>
          ) : null}
        </CommandList>
      </CommandDialog>
    </>
  )
}
