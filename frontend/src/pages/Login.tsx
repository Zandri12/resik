import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import ClickSpark from '@/components/ClickSpark'

const STORAGE_REMEMBER_EMAIL = 'resik_remember_email'
const STORAGE_REMEMBER_ME = 'resik_remember_me'
const DEFAULT_HERO_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuB9gN3d3MVhzQxFInxPYYY8gorKxdn23i39XvOhAbzbMOIhCbs1NY7n1xzKpQW1RSg66X3gUuPKDPeKqx3DjhnUoHJ7v5wo2d9XnKCldvc3e8Jl2gNreJ50DCuMb5asH6mrXy6KxhGDILA2Igq7heeNWYjcNKDV7b9VE21W-dT-0fHWLpIRuXvOGyT6SW4kHBSs26aHWIHVcI0Bp7C9R13-NeHzGbc3WB5lvntMLhoF5P3f8S9qzgDNdaV1AoaEUu72RHwK09MJAEk'
const heroImage = (import.meta.env.VITE_LOGIN_HERO_IMAGE as string) || DEFAULT_HERO_IMAGE

function LogoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 4H17.3334V17.3334H30.6666V30.6666H44V44H4V4Z"
        fill="currentColor"
      />
    </svg>
  )
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_REMEMBER_ME)
      if (saved === 'true') {
        const savedEmail = localStorage.getItem(STORAGE_REMEMBER_EMAIL)
        if (savedEmail) {
          setEmail(savedEmail)
          setRememberMe(true)
        }
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    document.title = 'Resik Laundry'
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      try {
        if (rememberMe) {
          localStorage.setItem(STORAGE_REMEMBER_ME, 'true')
          localStorage.setItem(STORAGE_REMEMBER_EMAIL, email)
        } else {
          localStorage.removeItem(STORAGE_REMEMBER_ME)
          localStorage.removeItem(STORAGE_REMEMBER_EMAIL)
        }
      } catch {
        /* ignore */
      }
      navigate('/dashboard')
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Login gagal'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <ClickSpark
      sparkColor="#005160"
      sparkSize={10}
      sparkRadius={15}
      sparkCount={8}
      duration={400}
      className="login-page flex min-h-screen min-h-[100dvh] w-full flex-col items-center justify-center overflow-y-auto bg-surface p-4 font-body text-on-surface antialiased h-auto sm:p-6 sm:py-8 lg:p-12"
    >
      <div className="flex w-full max-w-[1200px] flex-1 flex-col overflow-hidden py-4 lg:flex-row lg:rounded-xl lg:bg-surface-container-low">
        {/* Left Branding Side (Hidden on Mobile) */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-center bg-surface-container-low p-16">
          <div className="mb-12 flex items-center gap-4 text-primary">
            <div className="size-8">
              <LogoIcon />
            </div>
            <h1 className="font-headline text-2xl font-bold tracking-tight">
              Resik Laundry
            </h1>
          </div>
          <h2 className="font-headline mb-6 text-5xl font-black leading-tight tracking-tight text-on-surface">
            Kesegaran yang <span className="text-primary">Terorganisir.</span>
          </h2>
          <p className="max-w-md text-lg font-normal leading-relaxed text-on-surface-variant">
            Kelola operasional laundry Anda dengan presisi dan kemudahan dalam
            satu platform yang bersih dan efisien.
          </p>
          <div className="mt-12 aspect-square w-full max-w-sm overflow-hidden rounded-xl bg-surface-container-lowest">
            <div
              className="h-full w-full bg-cover bg-center opacity-80"
              style={{ backgroundImage: `url('${heroImage}')` }}
              aria-hidden
            />
          </div>
        </div>

        {/* Right Login Form Side */}
        <div className="flex flex-1 flex-col justify-center bg-surface-container-lowest p-6 sm:p-8 md:p-12 lg:rounded-r-xl lg:p-16">
          {/* Mobile Logo */}
          <div className="mb-8 flex items-center gap-3 text-primary lg:mb-12 lg:hidden">
            <div className="size-6">
              <LogoIcon />
            </div>
            <h2 className="font-headline text-xl font-bold">Resik Laundry</h2>
          </div>

          <div className="mx-auto w-full max-w-md">
            <div className="mb-10">
              <h3 className="font-headline mb-2 text-3xl font-black tracking-tight text-on-surface">
                Masuk
              </h3>
              <p className="text-base text-on-surface-variant">
                Silakan masuk ke akun Anda untuk melanjutkan
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container">
                  {error}
                </div>
              )}

              {/* Email Field */}
              <div className="space-y-2">
                <label className="font-label ml-1 text-sm font-medium text-on-surface-variant">
                  Email atau Username
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="placeholder:text-outline h-12 w-full rounded-xl border-0 bg-surface-container-low px-4 text-base text-on-surface focus:ring-2 focus:ring-surface-tint/40 sm:h-14"
                    placeholder="contoh@resik.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label className="font-label ml-1 text-sm font-medium text-on-surface-variant">
                  Kata Sandi
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="placeholder:text-outline h-12 w-full rounded-xl border-0 bg-surface-container-low px-4 pr-12 text-base text-on-surface focus:ring-2 focus:ring-surface-tint/40 sm:h-14"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="material-symbols-outlined absolute right-4 min-h-[44px] min-w-[44px] touch-manipulation text-on-surface-variant transition-colors hover:text-primary sm:min-h-0 sm:min-w-0"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                  >
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </button>
                </div>
              </div>

              {/* Options Row */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="group flex min-h-[44px] cursor-pointer items-center gap-3 sm:min-h-0">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-5 w-5 shrink-0 rounded border-outline-variant bg-surface-container-low text-primary transition-all focus:ring-2 focus:ring-surface-tint/40 focus:ring-offset-0"
                  />
                  <span className="text-sm font-medium text-on-surface-variant transition-colors group-hover:text-on-surface">
                    Ingat Saya
                  </span>
                </label>
                <Link
                  to="/lupa-sandi"
                  className="min-h-[44px] flex items-center text-sm font-semibold text-primary hover:underline sm:min-h-0"
                >
                  Lupa sandi?
                </Link>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="primary-gradient flex h-12 w-full min-h-[44px] touch-manipulation items-center justify-center gap-2 rounded-xl font-headline text-base font-bold text-on-primary shadow-lg shadow-primary/10 transition-all hover:shadow-primary/20 disabled:opacity-50 sm:h-14 sm:text-lg"
              >
                {loading ? 'Memproses...' : 'Masuk'}
              </button>
            </form>

            {/* Footer Links */}
            <div className="mt-12 pt-8 text-center">
              <p className="text-sm text-on-surface-variant">
                Belum memiliki akun?{' '}
                <Link
                  to="/hubungi-admin"
                  className="ml-1 font-bold text-secondary transition-colors hover:text-primary"
                >
                  Hubungi Admin
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Minimal Footer */}
      <footer className="mt-12 text-center text-xs text-outline">
        <p>© {new Date().getFullYear()} Resik Laundry Management. All rights reserved.</p>
      </footer>
    </ClickSpark>
  )
}
