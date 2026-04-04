import { Link } from 'react-router-dom'
import ClickSpark from '@/components/ClickSpark'

const contactEmail = import.meta.env.VITE_CONTACT_EMAIL as string | undefined
const contactUrl = import.meta.env.VITE_CONTACT_URL as string | undefined

export default function ContactAdmin() {
  const contactHref = contactEmail
    ? `mailto:${contactEmail}`
    : contactUrl || undefined

  return (
    <ClickSpark
      sparkColor="#005160"
      sparkSize={10}
      sparkRadius={15}
      sparkCount={8}
      duration={400}
      className="flex min-h-dvh min-h-screen w-full min-w-0 flex-col items-center justify-center bg-surface p-4 font-body text-on-surface antialiased h-auto sm:p-8"
    >
      <div className="w-full max-w-md rounded-xl bg-surface-container-lowest p-6 shadow-sm sm:p-8">
        <h1 className="font-headline text-2xl font-bold tracking-tight text-on-surface">
          Hubungi Admin
        </h1>
        <p className="mt-3 text-on-surface-variant">
          Belum memiliki akun? Hubungi administrator untuk mendaftarkan outlet
          Anda.
        </p>
        {contactHref ? (
          <a
            href={contactHref}
            className="primary-gradient mt-6 inline-flex items-center gap-2 rounded-xl px-4 py-3 font-headline font-semibold text-on-primary transition-opacity hover:opacity-90"
          >
            {contactEmail ? 'Kirim Email' : 'Buka Link'}
          </a>
        ) : null}
        <Link
          to="/login"
          className="mt-4 block text-sm font-medium text-primary hover:underline"
        >
          ← Kembali ke Masuk
        </Link>
      </div>
    </ClickSpark>
  )
}
