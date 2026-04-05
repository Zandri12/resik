import { Button, buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export type BulkAction = {
  id: string
  label: string
  onClick: () => void
  destructive?: boolean
  disabled?: boolean
}

type DataTableBulkBarProps = {
  selectedCount: number
  actions: BulkAction[]
  className?: string
  /** Clear selection control is optional (e.g. after action) */
  onClear?: () => void
}

export function DataTableBulkBar({
  selectedCount,
  actions,
  className,
  onClear,
}: DataTableBulkBarProps) {
  if (selectedCount <= 0 || actions.length === 0) return null

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm',
        className
      )}
    >
      <span className="font-semibold text-foreground">
        {selectedCount} dipilih
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          type="button"
          className={cn(
            buttonVariants({ variant: 'secondary', size: 'sm' }),
            'rounded-lg gap-1'
          )}
        >
          Aksi massal
          <span className="material-symbols-outlined text-base">expand_more</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[12rem]">
          {actions.map((a) => (
            <DropdownMenuItem
              key={a.id}
              variant={a.destructive ? 'destructive' : 'default'}
              disabled={a.disabled}
              onClick={a.onClick}
            >
              {a.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {onClear && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={onClear}
        >
          Batal pilih
        </Button>
      )}
    </div>
  )
}
