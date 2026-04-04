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
        <Skeleton className="h-4 w-28" />
        <Skeleton className="size-10 rounded-xl" />
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="mt-2 h-3 w-20" />
      </CardContent>
    </Card>
  )
}

export function DashboardOwnerSkeleton() {
  return (
    <DashboardPageShell>
      <div className="mx-auto w-full min-w-0 max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
        <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0 space-y-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-10 w-full max-w-md" />
            <Skeleton className="h-5 w-full max-w-lg" />
          </div>
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-11 w-40 rounded-xl" />
            <Skeleton className="h-11 w-44 rounded-xl" />
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-10 w-64 rounded-2xl" />
        </div>
        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-3 xl:grid-cols-5">
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
        </div>
        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
          <StatSkeleton />
          <StatSkeleton />
        </div>
        <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
        </div>

        <Separator />

        <Card className={cn('mb-10', dashPanel)}>
          <CardHeader className={cn(dashPanelHeader, 'space-y-2')}>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full max-w-xl" />
          </CardHeader>
          <CardContent className="space-y-4 p-5 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-[220px] w-full rounded-md" />
          </CardContent>
        </Card>

        <Card className={cn('mb-10', dashPanel)}>
          <CardHeader className={cn(dashPanelHeader, 'space-y-2')}>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="p-5 sm:p-6">
            <Skeleton className="h-64 w-full rounded-md" />
          </CardContent>
        </Card>
      </div>
    </DashboardPageShell>
  )
}
