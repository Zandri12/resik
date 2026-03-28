/** Slug status dari API — sesuai permintaan klien: Diterima, Diproses, Selesai, Batal */
const LABELS: Record<string, string> = {
  diterima: 'Diterima',
  diproses: 'Diproses',
  selesai: 'Selesai',
  batal: 'Batal',
  // legacy (data lama / cache)
  cuci: 'Diproses',
  setrika: 'Diproses',
  siap_diambil: 'Selesai',
  diambil: 'Selesai',
}

export function orderStatusLabel(slug: string): string {
  if (!slug) return '—'
  return LABELS[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1).replace(/_/g, ' ')
}

/** Siap diambil / selesai cucian — selaras slug backend + legacy siap_diambil */
export function isReadyForPickupStatus(slug: string | undefined): boolean {
  if (!slug) return false
  return slug === 'selesai' || slug === 'siap_diambil'
}

/** Masih dalam alur operasional (bukan selesai / batal) */
export function isInProgressStatus(slug: string | undefined): boolean {
  if (!slug) return false
  return slug === 'diterima' || slug === 'diproses' || slug === 'cuci' || slug === 'setrika'
}
