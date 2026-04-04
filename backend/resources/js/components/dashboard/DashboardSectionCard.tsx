import type { ReactNode } from 'react'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { dashPanel, dashPanelHeader } from '@/components/dashboard/dashboard-card-styles'
import { cn } from '@/lib/utils'

type Props = {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  noPadding?: boolean
}

/** Panel konten (grafik, blok besar) dengan header shadcn standar. */
export function DashboardSectionCard({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  noPadding,
}: Props) {
  return (
    <Card className={cn('mb-10', dashPanel, className)}>
      {(title || description || actions) && (
        <CardHeader
          className={cn(
            dashPanelHeader,
            'flex flex-col gap-2 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4'
          )}
        >
          <div className="min-w-0 space-y-1">
            {title ? <CardTitle className="text-base font-semibold tracking-tight">{title}</CardTitle> : null}
            {description ? <CardDescription className="text-xs leading-relaxed sm:text-sm">{description}</CardDescription> : null}
          </div>
          {actions ? <CardAction className="w-full sm:w-auto">{actions}</CardAction> : null}
        </CardHeader>
      )}
      <CardContent className={cn(!noPadding && 'p-5 sm:p-6', bodyClassName)}>{children}</CardContent>
    </Card>
  )
}
