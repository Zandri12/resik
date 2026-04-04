import { useEffect, useState } from 'react'
import { normalizeIndonesianWaDigits } from '@/lib/phone'
import { Link } from 'react-router-dom'
import {
  landingContentsApi,
  publicOutletApi,
  type LandingContentKind,
  type LandingContentPublicItem,
  type PublicOutletProfile,
} from '@/services/api'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import ShinyText from '@/components/ShinyText'
import SplitText from '@/components/SplitText'
import ClickSpark from '@/components/ClickSpark'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

const LANDING_NAV_LINKS = [
  { href: '#promo-info', label: 'Promo & info' },
  { href: '#layanan', label: 'Layanan' },
  { href: '#cara-kerja', label: 'Cara Kerja' },
  { href: '#kenapa-kami', label: 'Kenapa Kami' },
  { href: '#harga', label: 'Harga' },
] as const

const KIND_LABEL_PUBLIC: Record<LandingContentKind, string> = {
  promo: 'Promo',
  pengumuman: 'Pengumuman',
  info: 'Info',
}

/** Fallback jika API belum terbaca; diganti begitu `/public/outlet-profile` selesai. */
const DEFAULT_OUTLET_PROFILE: PublicOutletProfile = {
  outlet_name: 'Resik Laundry',
  address: 'Jl. Raya Kalimulya No.33, Kalimulya, Kec. Cilodong, Kota Depok, Jawa Barat 16413',
  phone: '0813-1389-7633',
}

const DEFAULT_LANDING_HERO_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDeiL_W-W2HUxie-UNvg1zC6rU-JL71oDR69R4UG5yhbUa5Xzd3UNxNLgeOsJIsYaorFapeqBJBCxSkDSwM89FL0twR9e45OT90Hy0XSy1bV3pz2uBva0VT88Skz2ituGefL6CXDceXygh3xee5NkWFeY53GEpUIb632J3uL2dqRY1N8J6ZDkVwkG7Hli9YD1zVypr02GMggKsYSWGTUqDeoU2u0VcKVq1gZ1ZBQp-_pOxzArOhDgC9AH_GVTY9-I2tN_dB6x4lzb4'

function telUri(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (!d) return '#'
  if (d.startsWith('62')) return `tel:+${d}`
  if (d.startsWith('0')) return `tel:+62${d.slice(1)}`
  return `tel:+62${d}`
}

function mapsEmbedSrc(address: string): string | null {
  const q = address.trim()
  if (!q) return null
  return `https://www.google.com/maps?q=${encodeURIComponent(q)}&hl=id&output=embed`
}

function Icon({ name, filled, className }: { name: string; filled?: boolean; className?: string }) {
  return (
    <span
      className={`material-symbols-outlined ${className ?? ''}`.trim()}
      data-icon={name}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  )
}

export default function Landing() {
  const [landingBlocks, setLandingBlocks] = useState<LandingContentPublicItem[]>([])
  const [profile, setProfile] = useState<PublicOutletProfile>(DEFAULT_OUTLET_PROFILE)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([landingContentsApi.publicList({ limit: 100 }), publicOutletApi.profile()]).then(
      (results) => {
        if (cancelled) return
        const [blocksR, profR] = results
        if (blocksR.status === 'fulfilled') {
          const raw = blocksR.value.data
          setLandingBlocks(Array.isArray(raw) ? raw : [])
        } else {
          setLandingBlocks([])
        }
        if (profR.status === 'fulfilled') {
          const p = profR.value.data
          setProfile({
            outlet_name: p.outlet_name?.trim() || DEFAULT_OUTLET_PROFILE.outlet_name,
            address: p.address?.trim() || DEFAULT_OUTLET_PROFILE.address,
            phone: p.phone?.trim() ?? '',
            landing_hero_url: p.landing_hero_url?.trim() || undefined,
          })
        }
      }
    )
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    document.title = `${profile.outlet_name} — Laundry`
  }, [profile.outlet_name])

  const waDigits = normalizeIndonesianWaDigits(profile.phone)
  const waHref = waDigits ? `https://wa.me/${waDigits}` : '#'
  const brandShort = profile.outlet_name.trim().split(/\s+/)[0] || 'Kami'
  const mapSrc = mapsEmbedSrc(profile.address)
  const envHero = (import.meta.env.VITE_LANDING_HERO_IMAGE as string | undefined)?.trim()
  const heroImageSrc =
    profile.landing_hero_url?.trim() || envHero || DEFAULT_LANDING_HERO_IMAGE

  return (
    <div className="min-w-0 overflow-x-clip bg-surface font-body text-on-surface">
      {/* Header */}
      <header className="pt-safe-header sticky top-0 z-50 border-b border-outline-variant/20 bg-surface/80 backdrop-blur-lg">
        <div className="mx-auto flex h-20 w-full min-w-0 max-w-7xl items-center px-4 sm:px-6 lg:px-10">
          <ClickSpark
            sparkColor="#005160"
            sparkSize={10}
            sparkRadius={15}
            sparkCount={8}
            duration={400}
            className="flex h-full w-full min-w-0 items-center justify-between gap-3"
          >
            <Link to="/" className="flex min-w-0 max-w-56 items-center gap-2 sm:gap-3 sm:max-w-none">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 4H17.3334V17.3334H30.6666V30.6666H44V44H4V4Z" fill="currentColor" />
                </svg>
              </div>
              <span className="truncate font-headline text-lg font-extrabold tracking-tight text-primary sm:text-xl">
                {profile.outlet_name}
              </span>
            </Link>
            <nav className="hidden items-center gap-10 md:flex">
              {LANDING_NAV_LINKS.map(({ href, label }) => (
                <a
                  key={href}
                  className="text-sm font-semibold text-on-surface-variant transition-colors hover:text-primary"
                  href={href}
                >
                  {label}
                </a>
              ))}
            </nav>
            <div className="flex shrink-0 items-center gap-2 sm:gap-4">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-on-surface hover:bg-surface-container-high md:hidden"
                aria-label="Buka menu"
              >
                <span className="material-symbols-outlined" aria-hidden>
                  menu
                </span>
              </button>
              <Link
                to="/login"
                className="rounded-lg bg-primary px-3 py-2.5 text-[11px] font-bold leading-tight text-on-primary shadow-sm transition-all hover:opacity-90 sm:px-6 sm:text-sm sm:leading-normal"
              >
                <span className="sm:hidden">Pesan</span>
                <span className="hidden sm:inline">Pesan Sekarang</span>
              </Link>
            </div>
          </ClickSpark>
        </div>
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="w-full max-w-xs gap-0 border-outline-variant/20 bg-surface p-0 sm:max-w-sm">
            <SheetHeader className="border-b border-outline-variant/20 p-4 text-left">
              <SheetTitle className="font-headline text-primary">Menu</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col p-2">
              {LANDING_NAV_LINKS.map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="min-h-11 rounded-lg px-4 py-3 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
                >
                  {label}
                </a>
              ))}
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 min-h-11 rounded-lg bg-primary px-4 py-3 text-center text-sm font-bold text-on-primary"
              >
                Masuk / Pesan
              </Link>
              {waDigits ? (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                  className="mt-2 flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-3 text-center text-sm font-bold text-white"
                >
                  <Icon name="chat" className="text-lg" />
                  Chat WhatsApp
                </a>
              ) : null}
            </nav>
          </SheetContent>
        </Sheet>
      </header>

      <main className="pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] md:pb-0">
        <ClickSpark
          sparkColor="#005160"
          sparkSize={10}
          sparkRadius={15}
          sparkCount={8}
          duration={400}
          className="h-auto min-h-full w-full"
        >
        {/* Hero */}
        <section className="relative overflow-hidden bg-surface pt-12 pb-16 sm:pt-16 sm:pb-24 lg:pt-24 lg:pb-32">
          <div className="max-w-7xl mx-auto w-full min-w-0 px-4 sm:px-6 lg:px-10 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16 lg:items-center">
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-palette-cream text-on-surface text-xs font-bold uppercase tracking-wider mb-6">
                <Icon name="verified" className="text-sm" />
                <span>Premium Quality Laundry</span>
              </div>
              <h1 className="mb-8 font-headline">
                <SplitText
                  text="Cucian Bersih,"
                  tag="span"
                  className="block text-4xl sm:text-5xl lg:text-7xl font-extrabold text-on-surface leading-[1.2]"
                  textAlign="left"
                  delay={50}
                  duration={1.25}
                  ease="power3.out"
                  splitType="chars"
                  from={{ opacity: 0, y: 40 }}
                  to={{ opacity: 1, y: 0 }}
                  threshold={0.1}
                  rootMargin="-100px"
                />
                <br />
                <span className="inline-flex max-w-full flex-wrap items-baseline gap-x-[0.25em]">
                  <SplitText
                    text="Hidup Lebih"
                    tag="span"
                    className="inline-block shrink-0 text-4xl sm:text-5xl lg:text-7xl font-extrabold text-on-surface leading-[1.28]"
                    textAlign="left"
                    delay={50}
                    duration={1.25}
                    ease="power3.out"
                    splitType="chars"
                    from={{ opacity: 0, y: 40 }}
                    to={{ opacity: 1, y: 0 }}
                    threshold={0.1}
                    rootMargin="-100px"
                  />
                  <ShinyText
                    text="Segar"
                    speed={2}
                    delay={0}
                    color="#5579a3"
                    shineColor="#ffffff"
                    spread={95}
                    direction="left"
                    yoyo={false}
                    pauseOnHover={false}
                    disabled={false}
                    className="shrink-0 text-4xl sm:text-5xl lg:text-7xl font-extrabold font-headline leading-[1.28]"
                  />
                </span>
              </h1>
              <p className="mb-8 max-w-lg text-base leading-relaxed text-on-surface-variant sm:mb-10 sm:text-lg lg:text-xl">
                Layanan laundry antar-jemput profesional untuk kenyamanan Anda. Kami menjaga setiap serat kain Anda dengan standar hotel berbintang.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                <Link
                  to="/login"
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-container px-6 py-3.5 text-base font-bold text-on-primary shadow-lg transition-transform hover:opacity-95 active:scale-[0.99] sm:min-h-0 sm:px-10 sm:py-4 sm:text-lg md:hover:scale-[1.02]"
                >
                  Pesan Sekarang
                  <Icon name="arrow_forward" />
                </Link>
                <a
                  href="#harga"
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-6 py-3.5 text-base font-bold text-primary transition-colors hover:bg-surface-container-low sm:min-h-0 sm:px-10 sm:py-4 sm:text-lg"
                >
                  Lihat Harga
                </a>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
              <div className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full bg-primary/5 blur-3xl sm:-right-20 sm:-top-20 sm:h-96 sm:w-96" />
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl shadow-2xl sm:rounded-3xl">
                <img
                  alt="Stack of perfectly folded clean white towels"
                  className="h-full w-full object-cover"
                  src={heroImageSrc}
                  width={800}
                  height={1000}
                  fetchPriority="high"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent" />
              </div>
              <div className="relative mt-4 flex items-center gap-3 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-4 shadow-xl sm:absolute sm:-bottom-6 sm:-left-4 sm:mt-0 sm:max-w-[calc(100%-1rem)] sm:p-6 md:-left-6">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary sm:h-12 sm:w-12">
                  <Icon name="local_shipping" filled />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-on-surface">Gratis Antar Jemput</p>
                  <p className="text-xs text-on-surface-variant">Khusus area Jabodetabek</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Promo & konten dari owner (API) */}
        {landingBlocks.length > 0 && (
          <section className="py-16 lg:py-20 bg-surface-container-low border-y border-outline-variant/15" id="promo-info">
            <div className="max-w-7xl mx-auto w-full min-w-0 px-4 sm:px-6 lg:px-10">
              <div className="text-center mb-12 max-w-2xl mx-auto">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2 font-headline">
                  Penawaran &amp; informasi
                </p>
                <h2 className="text-2xl font-extrabold tracking-tight text-on-surface font-headline sm:text-3xl lg:text-4xl">
                  Promo &amp; info terbaru
                </h2>
                <p className="text-on-surface-variant mt-3 text-base">
                  Update dari kami — cek promo dan pengumuman sebelum pesan.
                </p>
                <p className="text-on-surface-variant/90 mt-2 text-sm font-medium">
                  {landingBlocks.length} penawaran &amp; informasi aktif
                  {landingBlocks.length === 100
                    ? ' — tampilan publik dibatasi 100 item (urut prioritas). Nonaktifkan yang jarang dipakai jika perlu.'
                    : ''}
                </p>
              </div>

              <div className="relative mx-auto mt-10 w-full max-w-7xl px-0 sm:px-10 md:px-14 lg:px-16">
                <Carousel
                  opts={{
                    align: 'start',
                    // Tanpa loop: mode loop Embla menduplikasi slide sehingga kartu terlihat "berputar" berulang.
                    loop: false,
                  }}
                  className="w-full"
                >
                  <CarouselContent className="-ml-3 md:-ml-4">
                    {landingBlocks.map((item) => (
                      <CarouselItem
                        key={item.id}
                        className="pl-3 md:pl-4 basis-full min-[520px]:basis-1/2 xl:basis-1/3"
                      >
                        <article className="bg-surface-container-lowest rounded-3xl border border-outline-variant/20 overflow-hidden shadow-sm flex flex-col hover:border-primary/25 transition-colors h-full min-h-[280px]">
                          {item.image_url ? (
                            <div className="aspect-[16/10] w-full overflow-hidden bg-surface-container shrink-0">
                              <img
                                src={item.image_url}
                                alt=""
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </div>
                          ) : null}
                          <div className="p-6 lg:p-7 flex flex-col flex-1 min-h-0">
                            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wide w-fit mb-3">
                              {KIND_LABEL_PUBLIC[item.kind] ?? item.kind}
                            </div>
                            <h3 className="text-xl font-bold font-headline text-on-surface mb-2 leading-snug line-clamp-3">
                              {item.title}
                            </h3>
                            {item.preview ? (
                              <p className="text-on-surface-variant text-sm leading-relaxed whitespace-pre-wrap line-clamp-5 flex-1 min-h-0">
                                {item.preview}
                              </p>
                            ) : (
                              <div className="flex-1" />
                            )}
                            {item.slug ? (
                              <Link
                                to={`/konten/${item.slug}`}
                                className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-primary/30 bg-transparent px-4 py-2.5 text-sm font-bold text-primary hover:bg-primary/5 transition-colors"
                              >
                                Baca selengkapnya
                                <Icon name="article" className="text-base" />
                              </Link>
                            ) : null}
                            {item.link_url && item.cta_label ? (
                              <a
                                href={item.link_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-5 inline-flex items-center justify-center gap-2 bg-primary text-on-primary px-5 py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
                              >
                                {item.cta_label}
                                <Icon name="open_in_new" className="text-base" />
                              </a>
                            ) : item.link_url ? (
                              <a
                                href={item.link_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-5 text-primary font-bold text-sm hover:underline inline-flex items-center gap-1"
                              >
                                Selengkapnya
                                <Icon name="arrow_forward" className="text-base" />
                              </a>
                            ) : null}
                          </div>
                        </article>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious
                    variant="outline"
                    className="top-[42%] z-10 hidden size-9 -translate-y-1/2 border-outline-variant/50 bg-surface-container-lowest/95 shadow-md sm:inline-flex sm:left-1"
                  />
                  <CarouselNext
                    variant="outline"
                    className="top-[42%] z-10 hidden size-9 -translate-y-1/2 border-outline-variant/50 bg-surface-container-lowest/95 shadow-md sm:inline-flex sm:right-1"
                  />
                </Carousel>
                {landingBlocks.length > 1 ? (
                  <p className="mt-5 text-center text-xs text-on-surface-variant sm:hidden">
                    Geser kartu untuk melihat promo lainnya.
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        )}

        {/* Layanan */}
        <section className="py-16 sm:py-24 bg-surface-container-low" id="layanan">
          <div className="max-w-7xl mx-auto w-full min-w-0 px-4 sm:px-6 lg:px-10">
            <div className="mb-12 text-center sm:mb-16">
              <h2 className="mb-3 font-headline text-2xl font-extrabold text-on-surface sm:mb-4 sm:text-3xl lg:text-4xl">
                Layanan Kami
              </h2>
              <p className="text-on-surface-variant max-w-2xl mx-auto">
                Kami menyediakan berbagai pilihan perawatan pakaian yang disesuaikan dengan kebutuhan kain Anda.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3 md:gap-8">
              <div className="group rounded-3xl bg-surface-container-lowest p-4 transition-all duration-300 sm:p-8 md:hover:scale-[1.02]">
                <div className="w-16 h-16 rounded-2xl bg-primary/5 text-primary flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-on-primary transition-colors">
                  <Icon name="dry_cleaning" />
                </div>
                <h3 className="text-2xl font-bold mb-2 font-headline">Cuci & Lipat</h3>
                <p className="text-on-surface-variant mb-6">
                  Pencucian higienis dengan deterjen premium dan pelipatan rapi ala butik.
                </p>
                <p className="text-sm font-medium text-secondary flex items-center gap-1">
                  Mulai dari <span className="text-xl font-extrabold">Rp 8.000</span> /kg
                </p>
              </div>
              <div className="group rounded-3xl bg-surface-container-lowest p-4 transition-all duration-300 sm:p-8 md:hover:scale-[1.02]">
                <div className="w-16 h-16 rounded-2xl bg-primary/5 text-primary flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-on-primary transition-colors">
                  <Icon name="iron" />
                </div>
                <h3 className="text-2xl font-bold mb-2 font-headline">Setrika</h3>
                <p className="text-on-surface-variant mb-6">
                  Penyetrikaan uap profesional untuk menghilangkan kerutan tanpa merusak serat.
                </p>
                <p className="text-sm font-medium text-secondary flex items-center gap-1">
                  Flat rate <span className="text-xl font-extrabold">Rp 6.000</span> /kg
                </p>
              </div>
              <div className="group rounded-3xl bg-surface-container-lowest p-4 transition-all duration-300 sm:p-8 md:hover:scale-[1.02]">
                <div className="w-16 h-16 rounded-2xl bg-primary/5 text-primary flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-on-primary transition-colors">
                  <Icon name="checkroom" />
                </div>
                <h3 className="text-2xl font-bold mb-2 font-headline">Dry Cleaning</h3>
                <p className="text-on-surface-variant mb-6">
                  Perawatan khusus untuk jas, gaun, dan bahan sensitif lainnya dengan teknik profesional.
                </p>
                <p className="text-sm font-medium text-secondary flex items-center gap-1">
                  Mulai dari <span className="text-xl font-extrabold">Rp 25.000</span> /pc
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Daftar Harga - Home Cleaning & Perawatan */}
        <section className="py-16 sm:py-24 bg-surface-container-low" id="harga">
          <div className="max-w-7xl mx-auto w-full min-w-0 px-4 sm:px-6 lg:px-10">
            {/* Header intro - redesain */}
            <div className="max-w-2xl mx-auto mb-16">
              <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-6 text-center shadow-sm sm:p-8 lg:p-10">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3 font-headline">
                  Harga transparan
                </p>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-on-surface mb-4 font-headline tracking-tight">
                  Daftar Harga
                </h2>
                <p className="text-on-surface-variant text-base leading-relaxed mb-8 max-w-lg mx-auto">
                  Home cleaning, perawatan sofa, springbed, serta mobil &amp; perlengkapan bayi. Tanpa biaya tersembunyi.
                </p>
                <div className="inline-flex flex-wrap items-center justify-center gap-2">
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-palette-sky/20 text-on-surface-variant text-sm font-bold">
                    <Icon name="percent" className="text-lg" />
                    Diskon 25%
                  </span>
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary text-sm font-bold">
                    <Icon name="local_shipping" className="text-lg" />
                    Gratis transportasi
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 mb-10 p-4 rounded-xl bg-surface-container border border-outline-variant/30">
              <p className="text-sm font-medium text-on-surface-variant flex items-center gap-2">
                <Icon name="info" className="text-primary text-lg" />
                Pastikan transaksi Anda hanya melalui nomor tertera di bawah ini.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3 md:gap-8">
              {/* Home Cleaning */}
              <div className="group rounded-3xl bg-surface-container-lowest p-4 transition-all duration-300 sm:p-8 md:hover:scale-[1.02]">
                <div className="w-16 h-16 rounded-2xl bg-primary/5 text-primary flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-on-primary transition-colors">
                  <Icon name="home" className="text-4xl" />
                </div>
                <h3 className="text-2xl font-bold mb-2 font-headline text-on-surface">Home Cleaning</h3>
                <ul className="space-y-2 text-sm text-on-surface-variant">
                  <li className="flex justify-between gap-3"><span className="min-w-0 break-words pr-1">Daily Cleaning</span><span className="font-extrabold text-secondary shrink-0">Rp 75rb</span></li>
                  <li className="flex justify-between gap-3"><span className="min-w-0 break-words pr-1">Salon Kamar Mandi</span><span className="font-extrabold text-secondary shrink-0">Rp 250rb–400rb</span></li>
                  <li className="flex justify-between gap-3"><span className="min-w-0 break-words pr-1">Torrent Kecil</span><span className="font-extrabold text-secondary shrink-0">Rp 200rb</span></li>
                  <li className="flex justify-between gap-3"><span className="min-w-0 break-words pr-1">Torrent Sedang</span><span className="font-extrabold text-secondary shrink-0">Rp 250rb</span></li>
                  <li className="flex justify-between gap-3"><span className="min-w-0 break-words pr-1">Torrent Besar</span><span className="font-extrabold text-secondary shrink-0">Rp 350rb</span></li>
                  <li className="flex justify-between gap-3"><span className="min-w-0 break-words pr-1">Cuci AC</span><span className="font-extrabold text-secondary shrink-0">Rp 85rb</span></li>
                  <li className="flex justify-between gap-3"><span className="min-w-0 break-words pr-1">Karpet Kantor / m</span><span className="font-extrabold text-secondary shrink-0">Rp 20rb</span></li>
                  <li className="flex justify-between gap-3"><span className="min-w-0 break-words pr-1">Karpet Masjid / m</span><span className="font-extrabold text-secondary shrink-0">Rp 20rb</span></li>
                  <li className="flex justify-between gap-3"><span className="min-w-0 break-words pr-1">Potong Rumput / m</span><span className="font-extrabold text-secondary shrink-0">Rp 10rb–50rb</span></li>
                </ul>
              </div>

              {/* Sofa */}
              <div className="group rounded-3xl bg-surface-container-lowest p-4 transition-all duration-300 sm:p-8 md:hover:scale-[1.02]">
                <div className="w-16 h-16 rounded-2xl bg-primary/5 text-primary flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-on-primary transition-colors">
                  <Icon name="weekend" className="text-4xl" />
                </div>
                <h3 className="text-2xl font-bold mb-2 font-headline text-on-surface">Sofa</h3>
                <ul className="space-y-2 text-sm text-on-surface-variant">
                  <li className="flex justify-between gap-3"><span className="min-w-0 break-words pr-1">Sofa / Seat</span><span className="font-extrabold text-secondary shrink-0">Rp 65rb</span></li>
                  <li className="flex justify-between gap-3"><span className="min-w-0 break-words pr-1">Sofa Bed Jumbo</span><span className="font-extrabold text-secondary shrink-0">Rp 200rb</span></li>
                  <li className="flex justify-between gap-3"><span className="min-w-0 break-words pr-1">Sofa Bed Sedang</span><span className="font-extrabold text-secondary shrink-0">Rp 150rb</span></li>
                  <li className="flex justify-between gap-3"><span className="min-w-0 break-words pr-1">Kursi Kantor</span><span className="font-extrabold text-secondary shrink-0">Rp 30rb</span></li>
                  <li className="flex justify-between gap-3"><span className="min-w-0 break-words pr-1">Kursi Makan</span><span className="font-extrabold text-secondary shrink-0">Rp 25rb</span></li>
                  <li className="flex justify-between gap-3"><span className="min-w-0 break-words pr-1">Bantal Sofa</span><span className="font-extrabold text-secondary shrink-0">Rp 15rb</span></li>
                </ul>
              </div>

              {/* Springbed */}
              <div className="group rounded-3xl bg-surface-container-lowest p-4 transition-all duration-300 sm:p-8 md:hover:scale-[1.02]">
                <div className="w-16 h-16 rounded-2xl bg-primary/5 text-primary flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-on-primary transition-colors">
                  <Icon name="bed" className="text-4xl" />
                </div>
                <h3 className="text-2xl font-bold mb-2 font-headline text-on-surface">Springbed</h3>
                <ul className="space-y-2 text-sm text-on-surface-variant">
                  <li className="flex justify-between gap-3"><span className="min-w-0 break-words pr-1">200 × 200</span><span className="font-extrabold text-secondary shrink-0">Rp 300rb</span></li>
                  <li className="flex justify-between gap-3"><span className="min-w-0 break-words pr-1">180 × 200</span><span className="font-extrabold text-secondary shrink-0">Rp 250rb</span></li>
                  <li className="flex justify-between gap-3"><span className="min-w-0 break-words pr-1">160 × 200</span><span className="font-extrabold text-secondary shrink-0">Rp 200rb</span></li>
                  <li className="flex justify-between gap-3"><span className="min-w-0 break-words pr-1">120 × 200</span><span className="font-extrabold text-secondary shrink-0">Rp 180rb</span></li>
                  <li className="flex justify-between gap-3"><span className="min-w-0 break-words pr-1">90 × 200</span><span className="font-extrabold text-secondary shrink-0">Rp 150rb</span></li>
                  <li className="flex justify-between gap-3"><span className="min-w-0 break-words pr-1">Bahan Latex</span><span className="font-extrabold text-secondary shrink-0">+Rp 25rb</span></li>
                  <li className="flex justify-between gap-3"><span className="min-w-0 break-words pr-1">Springbed Sorong 120×200</span><span className="font-extrabold text-secondary shrink-0">Rp 350rb</span></li>
                  <li className="flex justify-between gap-3"><span className="min-w-0 break-words pr-1">Springbed Sorong 90×200</span><span className="font-extrabold text-secondary shrink-0">Rp 300rb</span></li>
                  <li className="flex justify-between gap-3"><span className="min-w-0 break-words pr-1">Springbed Anak</span><span className="font-extrabold text-secondary shrink-0">Rp 150rb</span></li>
                  <li className="flex justify-between gap-3"><span className="min-w-0 break-words pr-1">Dipan</span><span className="font-extrabold text-secondary shrink-0">Rp 150rb</span></li>
                  <li className="flex justify-between gap-3"><span className="min-w-0 break-words pr-1">Bantal / Guling</span><span className="font-extrabold text-secondary shrink-0">Rp 20rb</span></li>
                </ul>
              </div>

              {/* Mobil & Baby - baris kedua, di tengah seperti Layanan */}
              <div className="group rounded-3xl bg-surface-container-lowest p-4 transition-all duration-300 sm:p-8 md:col-start-2 md:hover:scale-[1.02]">
                <div className="w-16 h-16 rounded-2xl bg-primary/5 text-primary flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-on-primary transition-colors">
                  <Icon name="directions_car" className="text-4xl" />
                </div>
                <h3 className="text-2xl font-bold mb-2 font-headline text-on-surface">Mobil & Baby</h3>
                <ul className="space-y-2 text-sm text-on-surface-variant">
                  <li className="flex justify-between gap-3"><span className="min-w-0 break-words pr-1">Jok Mobil / Seat</span><span className="font-extrabold text-secondary shrink-0">Rp 65rb</span></li>
                  <li className="flex justify-between gap-3"><span className="min-w-0 break-words pr-1">Interior Mobil</span><span className="font-extrabold text-secondary shrink-0">Rp 75rb–150rb</span></li>
                  <li className="flex justify-between gap-3"><span className="min-w-0 break-words pr-1">Carseat</span><span className="font-extrabold text-secondary shrink-0">Rp 135rb</span></li>
                  <li className="flex justify-between gap-3"><span className="min-w-0 break-words pr-1">Stroller</span><span className="font-extrabold text-secondary shrink-0">Rp 150rb</span></li>
                </ul>
              </div>
            </div>

            <div className="text-center mt-16">
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center justify-center gap-2 bg-primary text-on-primary px-10 py-4 rounded-xl font-bold text-lg shadow-lg transition-opacity ${
                  waDigits ? 'hover:opacity-90' : 'pointer-events-none opacity-50'
                }`}
                aria-disabled={!waDigits}
              >
                <Icon name="phone" />
                {profile.phone || '—'}
              </a>
              <p className="text-on-surface-variant text-sm mt-3">Pesan &amp; konfirmasi hanya melalui nomor ini</p>
            </div>
          </div>
        </section>

        {/* Cara Kerja */}
        <section className="py-16 sm:py-24 bg-surface" id="cara-kerja">
          <div className="max-w-7xl mx-auto w-full min-w-0 px-4 sm:px-6 lg:px-10">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
              <div className="relative order-2 lg:order-1">
                <img
                  alt="Close up of a modern high-end washing machine in a clean room"
                  className="max-h-[280px] w-full rounded-3xl object-cover shadow-xl sm:max-h-[360px] lg:max-h-none lg:rounded-[2rem]"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuB62BIVqb1ZS5eV2fMNjUN16pyCUw0dl0e2ry0EFbJGKphvmC5EgeOmwz8tSYl0oSOBJORPBR0dWNysEvj_vhFdbKlP8ncklBNJAsh3C3b92WlDtdfhuL1ern1FAYnxoLfplzKAOK2EXLkHQz27FgKx3iB-Jq-EZpLlX0PHO1y8QhMZIxKT_BToIbUaxSet8mXpyXXMCGjyH6Kx2hzO6_sPulM757CGLSWze8IuAmEKULgRIWVFepyBYeI72QndfjwF5sRQJjIEbpo"
                />
              </div>
              <div className="order-1 lg:order-2">
                <h2 className="mb-8 font-headline text-2xl font-extrabold sm:mb-12 sm:text-3xl lg:text-4xl">Cara Kerja</h2>
                <div className="space-y-8 sm:space-y-12">
                  <div className="flex gap-4 sm:gap-6">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-on-primary font-bold flex items-center justify-center text-xl">
                      1
                    </div>
                    <div>
                      <h4 className="text-xl font-bold mb-2 font-headline">Atur Penjemputan</h4>
                      <p className="text-on-surface-variant">
                        Pesan melalui WhatsApp atau aplikasi kami. Kurir kami akan datang ke lokasi Anda sesuai jadwal.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4 sm:gap-6">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-on-primary font-bold flex items-center justify-center text-xl">
                      2
                    </div>
                    <div>
                      <h4 className="text-xl font-bold mb-2 font-headline">Kami Bersihkan</h4>
                      <p className="text-on-surface-variant">
                        Pakaian Anda diproses dengan deterjen ramah lingkungan dan teknik pencucian terbaik sesuai jenis kain.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4 sm:gap-6">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-on-primary font-bold flex items-center justify-center text-xl">
                      3
                    </div>
                    <div>
                      <h4 className="text-xl font-bold mb-2 font-headline">Antar ke Alamat</h4>
                      <p className="text-on-surface-variant">
                        Hanya dalam 24-48 jam, pakaian bersih dan wangi Anda akan kembali ke tangan Anda dengan rapi.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Kenapa Kami */}
        <section className="relative overflow-hidden bg-primary py-16 text-on-primary sm:py-24" id="kenapa-kami">
          <div className="absolute top-0 right-0 w-1/3 h-full bg-white/5 skew-x-[-20deg] translate-x-1/2" />
          <div className="max-w-7xl mx-auto w-full min-w-0 px-4 sm:px-6 lg:px-10 relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-extrabold mb-4 font-headline">
                Kenapa Memilih {brandShort}?
              </h2>
              <p className="text-on-primary/80 max-w-2xl mx-auto">
                Komitmen kami adalah memberikan hasil yang lebih dari sekedar bersih.
              </p>
            </div>
            <div className="grid gap-10 md:grid-cols-3 md:gap-12">
              <div className="text-center">
                <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Icon name="moped" />
                </div>
                <h4 className="text-xl font-bold mb-3 font-headline">Gratis Antar Jemput</h4>
                <p className="text-on-primary/70">
                  Hemat waktu dan tenaga Anda. Biarkan kurir kami yang bekerja menjemput cucian Anda.
                </p>
              </div>
              <div className="text-center">
                <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Icon name="eco" />
                </div>
                <h4 className="text-xl font-bold mb-3 font-headline">Wangi Tahan Lama</h4>
                <p className="text-on-primary/70">
                  Menggunakan parfum laundry premium yang lembut di hidung namun bertahan hingga 7 hari di lemari.
                </p>
              </div>
              <div className="text-center">
                <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Icon name="health_and_safety" />
                </div>
                <h4 className="text-xl font-bold mb-3 font-headline">Higienis & Steril</h4>
                <p className="text-on-primary/70">
                  Setiap pesanan dicuci secara terpisah. Kami menjamin tidak ada pencampuran pakaian antar pelanggan.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Trust */}
        <section className="py-20 bg-surface">
          <div className="max-w-7xl mx-auto w-full min-w-0 px-4 sm:px-6 lg:px-10 flex flex-col items-center">
            <p className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-10">
              Telah Dipercayai Oleh Ribuan Keluarga
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4 opacity-40 grayscale sm:gap-x-12 sm:gap-y-6">
              <div className="flex w-[calc(50%-0.75rem)] min-w-0 flex-col items-center gap-1.5 text-center font-headline text-base font-black sm:w-auto sm:flex-row sm:gap-2 sm:text-2xl">
                <Icon name="apartment" className="shrink-0" />
                <span className="text-balance leading-tight">Kencana Residensi</span>
              </div>
              <div className="flex w-[calc(50%-0.75rem)] min-w-0 flex-col items-center gap-1.5 text-center font-headline text-base font-black sm:w-auto sm:flex-row sm:gap-2 sm:text-2xl">
                <Icon name="home" className="shrink-0" />
                <span className="text-balance leading-tight">Permata Hijau</span>
              </div>
              <div className="flex w-[calc(50%-0.75rem)] min-w-0 flex-col items-center gap-1.5 text-center font-headline text-base font-black sm:w-auto sm:flex-row sm:gap-2 sm:text-2xl">
                <Icon name="domain" className="shrink-0" />
                <span className="text-balance leading-tight">Senayan Suites</span>
              </div>
              <div className="flex w-[calc(50%-0.75rem)] min-w-0 flex-col items-center gap-1.5 text-center font-headline text-base font-black sm:w-auto sm:flex-row sm:gap-2 sm:text-2xl">
                <Icon name="location_city" className="shrink-0" />
                <span className="text-balance leading-tight">Gading Terrace</span>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 py-16 sm:px-6 sm:py-24">
          <div className="relative mx-auto w-full min-w-0 max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-r from-secondary to-primary p-8 text-center text-on-primary sm:rounded-[2.5rem] sm:p-12 lg:rounded-[3rem] lg:p-20">
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                backgroundSize: '40px 40px',
              }}
            />
            <div className="relative z-10">
              <h2 className="mb-4 font-headline text-2xl font-extrabold sm:mb-6 sm:text-3xl md:text-4xl lg:text-5xl">
                Siap untuk Hidup Lebih Praktis?
              </h2>
              <p className="mx-auto mb-8 max-w-xl text-base text-on-primary/90 sm:mb-10 sm:text-lg md:text-xl">
                Dapatkan diskon 20% untuk pesanan pertama Anda. Kami jemput sekarang juga!
              </p>
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex min-h-12 w-full max-w-sm items-center justify-center rounded-xl bg-surface-container-lowest px-6 py-3.5 font-headline text-base font-black text-primary shadow-2xl transition-opacity sm:inline-flex sm:w-auto sm:max-w-none sm:rounded-2xl sm:px-10 sm:py-4 sm:text-lg md:py-5 md:text-xl md:hover:opacity-95 ${
                  waDigits ? '' : 'pointer-events-none opacity-50'
                }`}
                aria-disabled={!waDigits}
              >
                Pesan via WhatsApp
              </a>
            </div>
          </div>
        </section>
        </ClickSpark>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container-low pt-20 pb-10">
        <div className="max-w-7xl mx-auto w-full min-w-0 px-4 sm:px-6 lg:px-10 border-b border-outline-variant/30 pb-16 grid md:grid-cols-4 gap-12">
          <div className="col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-primary flex items-center justify-center rounded-md text-on-primary">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 4H17.3334V17.3334H30.6666V30.6666H44V44H4V4Z" fill="currentColor" />
                </svg>
              </div>
              <span className="text-xl font-extrabold tracking-tight text-primary font-headline">
                {profile.outlet_name}
              </span>
            </div>
            <p className="text-on-surface-variant max-w-sm mb-6 leading-relaxed">
              Layanan cuci dan perawatan pakaian yang mengutamakan kebersihan, kerapian, dan komunikasi yang jelas—supaya Anda tenang menyerahkan cucian.
            </p>
            <div className="flex gap-4">
              <a
                className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface hover:bg-primary hover:text-on-primary transition-all"
                href="#"
                aria-label="Facebook"
              >
                <Icon name="share" />
              </a>
              <a
                className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface hover:bg-primary hover:text-on-primary transition-all"
                href="#"
                aria-label="Instagram"
              >
                <Icon name="photo_camera" />
              </a>
            </div>
          </div>
          <div>
            <h5 className="font-bold mb-6 font-headline">Navigasi</h5>
            <ul className="space-y-4 text-on-surface-variant">
              <li>
                <a className="hover:text-primary" href="#">Tentang Kami</a>
              </li>
              <li>
                <a className="hover:text-primary" href="#layanan">Layanan</a>
              </li>
              <li>
                <a className="hover:text-primary" href="#harga">Harga & Paket</a>
              </li>
              <li>
                <a className="hover:text-primary" href="#cara-kerja">Cara Kerja</a>
              </li>
            </ul>
          </div>
          <div>
            <h5 className="font-bold mb-6 font-headline">Kontak</h5>
            <ul className="space-y-4 text-on-surface-variant">
              <li className="flex items-start gap-3">
                <span className="text-primary shrink-0">
                  <Icon name="location_on" />
                </span>
                {profile.address || '—'}
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary shrink-0">
                  <Icon name="call" />
                </span>
                {profile.phone ? (
                  <a href={telUri(profile.phone)} className="hover:text-primary">
                    {profile.phone}
                  </a>
                ) : (
                  '—'
                )}
              </li>
            </ul>
          </div>
          {mapSrc ? (
            <div className="md:col-span-4">
              <div className="aspect-video w-full max-w-3xl mx-auto overflow-hidden rounded-2xl border border-outline-variant/30 shadow-sm">
                <iframe
                  title={`Peta lokasi ${profile.outlet_name}`}
                  src={mapSrc}
                  className="h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
            </div>
          ) : null}
        </div>
        <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col items-center gap-4 px-4 pt-8 text-sm text-on-surface-variant sm:px-6 md:flex-row md:justify-between lg:px-10">
          <p className="text-center md:text-left">
            © {new Date().getFullYear()} {profile.outlet_name}. Seluruh hak cipta dilindungi.
          </p>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
            <a className="hover:text-primary" href="#">Syarat & Ketentuan</a>
            <a className="hover:text-primary" href="#">Kebijakan Privasi</a>
          </div>
        </div>
      </footer>

      {/* Aksi cepat — hanya mobile (ruang di atas = padding di <main>) */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-outline-variant/25 bg-surface/95 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] backdrop-blur-md md:hidden"
        role="navigation"
        aria-label="Aksi cepat"
      >
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex min-h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-bold text-white shadow-sm ${
            waDigits ? 'bg-[#25D366] active:opacity-90' : 'pointer-events-none bg-on-surface-variant/35'
          }`}
          aria-disabled={!waDigits}
        >
          <Icon name="chat" className="shrink-0 text-lg" />
          <span className="truncate">WA</span>
        </a>
        <Link
          to="/login"
          className="flex min-h-12 min-w-0 flex-1 items-center justify-center gap-1 rounded-xl bg-primary px-2 text-center text-sm font-bold text-on-primary shadow-sm"
        >
          <span className="truncate">Pesan / Masuk</span>
        </Link>
      </div>
    </div>
  )
}
