import { Link } from 'react-router-dom'
import ClickSpark from '@/components/ClickSpark'

export default function ForgotPassword() {
  return (
    <ClickSpark
      sparkColor="#005160"
      sparkSize={10}
      sparkRadius={15}
      sparkCount={8}
      duration={400}
      className="flex min-h-screen w-full flex-col items-center justify-center bg-surface p-4 font-body text-on-surface antialiased h-auto sm:p-8"
    >
      <div className="w-full max-w-md rounded-xl bg-surface-container-lowest p-6 shadow-sm sm:p-8">
        <h1 className="font-headline text-2xl font-bold tracking-tight text-on-surface">
          Lupa sandi?
        </h1>
        <p className="mt-3 text-on-surface-variant">
          Untuk reset kata sandi, hubungi administrator outlet Anda.
        </p>
        <Link
          to="/login"
          className="primary-gradient mt-6 inline-flex items-center gap-2 rounded-xl px-4 py-3 font-headline font-semibold text-on-primary transition-opacity hover:opacity-90"
        >
          Kembali ke Masuk
        </Link>
      </div>
    </ClickSpark>
  )
}
