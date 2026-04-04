import { dashPanel, dashPanelHeader, dashStatCard, dashStatCardAccent } from '@/components/dashboard/dashboard-card-styles'
import { DashboardPageShell } from '@/components/dashboard/DashboardPageShell'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

function StatSkeleton() {
  return (
    <Card className={dashStatCard}>
      <span className={dashStatCardAccent} aria-hidden />
      <CardHeader className="flex flex-row items-start justify-between space-y-0 px-5 pb-2 pt-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="size-10 rounded-xl" />
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0">
        <Skeleton className="h-8 w-16" />
      </CardContent>
    </Card>
  )
}

export function DashboardKaryawanSkeleton() {
  return (
    <DashboardPageShell>
      <div className="mx-auto w-full min-w-0 max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-full max-w-sm" />
            <Skeleton className="h-5 w-full max-w-md" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-11 w-28 rounded-xl" />
            <Skeleton className="h-11 w-36 rounded-xl" />
            <Skeleton className="h-11 w-40 rounded-xl" />
          </div>
        </div>

        <Skeleton className="h-11 w-full max-w-2xl rounded-lg" />

        <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
        </div>

        <Card className={dashPanel}>
          <CardHeader className={cn(dashPanelHeader, 'space-y-0')}>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent className="space-y-3 px-5 pb-5 pt-4 sm:px-6">
            <Skeleton className="h-24 w-full rounded-md" />
          </CardContent>
        </Card>

        <Card className={dashPanel}>
          <CardHeader className={dashPanelHeader}>
            <Skeleton className="h-5 w-44" />
          </CardHeader>
          <CardContent className="space-y-3 p-5 sm:p-6">
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
          </CardContent>
        </Card>

        <Separator />

        <Card className={dashPanel}>
          <CardHeader className={cn(dashPanelHeader, 'pb-3 pt-4')}>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-3 px-5 pb-5 pt-3 sm:px-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-11 w-full rounded-md" />
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardPageShell>
  )
}
