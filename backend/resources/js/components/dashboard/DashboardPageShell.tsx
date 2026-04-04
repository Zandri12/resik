import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  children: ReactNode
  className?: string
}

/** Wrapper halaman dashboard — mengikuti latar `bg-background` aplikasi. */
export function DashboardPageShell({ children, className }: Props) {
  return <div className={cn('min-w-0', className)}>{children}</div>
}
