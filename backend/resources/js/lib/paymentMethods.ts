export const PAYMENT_METHODS = [
  { value: 'tunai', label: 'Tunai' },
  { value: 'cash', label: 'Cash' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'qris', label: 'QRIS' },
  { value: 'e_wallet', label: 'E-Wallet' },
  { value: 'lainnya', label: 'Lainnya' },
] as const

export function paymentMethodLabel(value: string | null | undefined): string {
  if (!value) return '—'
  if (value === 'midtrans') return 'Bayar Online (Midtrans)' // hidden from dropdown, kept for existing orders
  const found = PAYMENT_METHODS.find((m) => m.value === value)
  return found?.label ?? value
}
