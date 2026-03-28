/**
 * Normalisasi nomor Indonesia untuk wa.me: hanya digit, awalan 62, tanpa duplikasi.
 * Contoh: 0812… → 62812… ; 62812… → 62812… (tetap).
 */
export function normalizeIndonesianWaDigits(raw: string): string {
  const d = raw.replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('62')) return d
  if (d.startsWith('0')) return `62${d.slice(1)}`
  return `62${d}`
}

/** `https://wa.me/628…` atau null jika kosong */
export function waMeHrefFromPhone(raw: string | undefined | null): string | null {
  if (raw == null || String(raw).trim() === '') return null
  const digits = normalizeIndonesianWaDigits(String(raw))
  return digits ? `https://wa.me/${digits}` : null
}
