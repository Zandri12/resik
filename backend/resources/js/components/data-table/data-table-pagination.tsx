import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type DataTablePaginationProps = {
  currentPage: number
  lastPage: number
  from: number | null
  to: number | null
  total: number
  onPageChange: (page: number) => void
  /** e.g. "order", "user" — used in "Menampilkan … dari N …" */
  itemLabel: string
  className?: string
}

export function DataTablePagination({
  currentPage,
  lastPage,
  from,
  to,
  total,
  onPageChange,
  itemLabel,
  className,
}: DataTablePaginationProps) {
  if (lastPage <= 0) return null

  return (
    <div
      className={cn(
        'px-8 py-5 bg-surface-container-low/50 flex items-center justify-between border-t border-outline-variant/10',
        className
      )}
    >
      <p className="text-xs text-on-surface-variant">
        Menampilkan {from ?? 0}-{to ?? 0} dari {total} {itemLabel}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-lg border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <span className="material-symbols-outlined text-sm">chevron_left</span>
        </Button>
        {Array.from({ length: Math.min(5, lastPage) }, (_, i) => {
          const p =
            currentPage <= 3
              ? i + 1
              : currentPage >= lastPage - 2
                ? lastPage - 4 + i
                : currentPage - 2 + i
          if (p < 1 || p > lastPage) return null
          return (
            <Button
              key={p}
              size="icon"
              className={cn(
                'h-8 w-8 rounded-lg text-xs font-bold',
                p === currentPage
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-lowest border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container'
              )}
              onClick={() => onPageChange(p)}
            >
              {p}
            </Button>
          )
        })}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-lg border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container"
          disabled={currentPage >= lastPage}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <span className="material-symbols-outlined text-sm">chevron_right</span>
        </Button>
      </div>
    </div>
  )
}
