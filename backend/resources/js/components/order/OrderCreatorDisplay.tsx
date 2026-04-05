import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials } from '@/lib/avatar-initials'
import { cn } from '@/lib/utils'

export type OrderCreator = {
  id?: number
  name?: string | null
  avatar_url?: string | null
}

type Props = {
  creator?: OrderCreator | null
  /** Avatar + teks lebih rapat untuk tabel / daftar */
  compact?: boolean
  className?: string
}

export function OrderCreatorDisplay({ creator, compact, className }: Props) {
  const name = creator?.name?.trim()
  if (!name) {
    return <span className={cn('text-xs text-muted-foreground', className)}>—</span>
  }
  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <Avatar
        size="sm"
        className={cn(
          'shrink-0 ring-1 ring-border/50',
          compact && '!size-7 text-[9px]'
        )}
      >
        {creator?.avatar_url ? <AvatarImage src={creator.avatar_url} alt="" /> : null}
        <AvatarFallback delay={0}>{getInitials(name)}</AvatarFallback>
      </Avatar>
      <span
        className={cn(
          'truncate font-medium text-foreground',
          compact ? 'text-xs' : 'text-sm'
        )}
      >
        {name}
      </span>
    </div>
  )
}
