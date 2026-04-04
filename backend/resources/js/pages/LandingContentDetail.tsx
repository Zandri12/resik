import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { landingContentsApi, type LandingContentKind, type LandingContentItem } from '@/services/api'
import { ArticleBody } from '@/components/ArticleBody'
import { buttonVariants } from '@/components/ui/button'
import { cn, looksLikeHtml } from '@/lib/utils'
import ClickSpark from '@/components/ClickSpark'

const KIND_LABEL: Record<LandingContentKind, string> = {
  promo: 'Promo',
  pengumuman: 'Pengumuman',
  info: 'Info',
}

function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className ?? ''}`.trim()} data-icon={name}>
      {name}
    </span>
  )
}

export default function LandingContentDetail() {
  const { slug } = useParams<{ slug: string }>()
  const [item, setItem] = useState<LandingContentItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) {
      setNotFound(true)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    landingContentsApi
      .publicGet(slug)
      .then((r) => {
        if (!cancelled) setItem(r.data)
      })
      .catch((e) => {
        if (!cancelled) {
          if (e?.response?.status === 404) setNotFound(true)
          setItem(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  return (
    <div className="min-h-dvh min-h-screen min-w-0 overflow-x-clip bg-surface font-body text-on-surface">
      <header className="pt-safe-header sticky top-0 z-50 border-b border-outline-variant/20 bg-surface/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 w-full min-w-0 max-w-3xl items-center px-4 sm:px-6">
          <ClickSpark
            sparkColor="#005160"
            sparkSize={10}
            sparkRadius={15}
            sparkCount={8}
            duration={400}
            className="flex h-full w-full items-center justify-between gap-4"
          >
            <Link
              to="/#promo-info"
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' }),
                '-ml-2 inline-flex items-center gap-2 text-on-surface-variant'
              )}
            >
              <Icon name="arrow_back" className="text-lg" />
              Kembali
            </Link>
            <Link to="/" className="shrink-0 font-headline text-sm font-bold text-primary">
              Resik Laundry
            </Link>
          </ClickSpark>
        </div>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:py-14">
        <ClickSpark
          sparkColor="#005160"
          sparkSize={10}
          sparkRadius={15}
          sparkCount={8}
          duration={400}
          className="h-auto min-h-full w-full"
        >
        {loading ? (
          <p className="text-center text-on-surface-variant">Memuat...</p>
        ) : notFound || !item ? (
          <div className="text-center py-16 space-y-4">
            <h1 className="font-headline text-2xl font-bold text-on-surface">Konten tidak ditemukan</h1>
            <p className="text-on-surface-variant text-sm">
              Halaman mungkin sudah dihapus atau tautan salah.
            </p>
            <Link to="/" className={cn(buttonVariants({ variant: 'default' }), 'inline-flex')}>
              Ke beranda
            </Link>
          </div>
        ) : (
          <article>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wide mb-4">
              {KIND_LABEL[item.kind] ?? item.kind}
            </div>
            <h1 className="font-headline text-2xl font-extrabold leading-tight text-on-surface sm:text-3xl lg:text-4xl mb-4">
              {item.title}
            </h1>
            {item.excerpt ? (
              <p className="text-lg text-on-surface-variant leading-relaxed mb-8 border-l-4 border-primary/30 pl-4">
                {item.excerpt}
              </p>
            ) : null}
            {/*
              Hindari duplikat: image_url kartu = gambar pertama di body CKEditor — jangan render hero + body.
              Hero tetap dipakai untuk HTML tanpa gambar atau konten non-HTML (Markdown + URL kartu).
            */}
            {item.image_url &&
            (!looksLikeHtml(item.body ?? '') || !/<img\b/i.test(item.body ?? '')) ? (
              <div className="rounded-2xl overflow-hidden border border-outline-variant/20 mb-10 aspect-video bg-surface-container">
                <img src={item.image_url} alt="" className="w-full h-full object-cover" />
              </div>
            ) : null}
            <ArticleBody body={item.body} />
            <div className="mt-12 pt-8 border-t border-outline-variant/20 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
              <Link
                to="/#promo-info"
                className={cn(buttonVariants({ variant: 'outline' }), 'inline-flex justify-center')}
              >
                Lihat promo &amp; info lainnya
              </Link>
              {item.link_url && item.cta_label ? (
                <a
                  href={item.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: 'default' }), 'inline-flex justify-center gap-1')}
                >
                  {item.cta_label}
                  <Icon name="open_in_new" className="text-base" />
                </a>
              ) : null}
            </div>
          </article>
        )}
        </ClickSpark>
      </main>
    </div>
  )
}
