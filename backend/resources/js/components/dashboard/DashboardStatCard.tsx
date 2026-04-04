import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { dashStatCard, dashStatCardAccent } from '@/components/dashboard/dashboard-card-styles'
import { cn } from '@/lib/utils'

type Props = {
  icon: string
  /** Kelas untuk wrapper ikon (mis. bg-primary/10 text-primary) */
  iconWrapperClassName?: string
  label: string
  subtitle?: string
  value: ReactNode
  valueClassName?: string
  className?: string
}

/** Kartu metrik bergaya blok dashboard shadcn. */
export function DashboardStatCard({
  icon,
  iconWrapperClassName,
  label,
  subtitle,
  value,
  valueClassName = 'text-foreground',
  className,
}: Props) {
  return (
    <Card className={cn(dashStatCard, className)}>
      <span className={dashStatCardAccent} aria-hidden />
      <CardHeader className="flex flex-row items-start justify-between space-y-0 px-5 pb-2 pt-5">
        <CardTitle className="pr-2 text-sm font-medium leading-snug text-muted-foreground">{label}</CardTitle>
        <div
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/80 text-muted-foreground shadow-inner ring-1 ring-border/50 dark:bg-muted/50',
            iconWrapperClassName
          )}
        >
          <span className="material-symbols-outlined text-[22px] leading-none">{icon}</span>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0">
        <div className={cn('text-2xl font-bold tabular-nums tracking-tight', valueClassName)}>{value}</div>
        {subtitle ? <p className="mt-1.5 text-xs text-muted-foreground">{subtitle}</p> : null}
      </CardContent>
    </Card>
  )
}
