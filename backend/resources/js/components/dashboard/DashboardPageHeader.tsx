import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  badges?: ReactNode
  title: ReactNode
  description?: ReactNode
  /** Teks sekunder di atas aksi (mis. waktu terakhir refresh) */
  meta?: ReactNode
  actions?: ReactNode
  className?: string
}

export function DashboardPageHeader({
  badges,
  title,
  description,
  meta,
  actions,
  className,
}: Props) {
  return (
    <div
      className={cn(
        'flex flex-col gap-6 md:flex-row md:items-end md:justify-between',
        className
      )}
    >
      <div className="min-w-0">
        {badges ? <div className="mb-3 flex flex-wrap items-center gap-2">{badges}</div> : null}
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="flex flex-col items-stretch gap-2 sm:items-end">
        {actions ? <div className="flex flex-wrap gap-2 sm:justify-end">{actions}</div> : null}
        {meta}
      </div>
    </div>
  )
}
