import { Tooltip } from '@base-ui/react/tooltip'
import { cn } from '@/lib/utils'
import type { ComponentProps, ReactNode } from 'react'

/** Tanpa `align: shift` — shift horizontal membuat tooltip “meluncur” ke tengah viewport dan tidak sejajar kolom grafik. */
const CHART_TOOLTIP_COLLISION = {
  side: 'flip' as const,
  align: 'none' as const,
  fallbackAxisSide: 'end' as const,
}

function TooltipProvider({ children, ...props }: ComponentProps<typeof Tooltip.Provider>) {
  return (
    <Tooltip.Provider delay={100} closeDelay={40} {...props}>
      {children}
    </Tooltip.Provider>
  )
}

const TooltipRoot = Tooltip.Root
const TooltipTrigger = Tooltip.Trigger

type PositionerProps = ComponentProps<typeof Tooltip.Positioner>

function TooltipContent({
  className,
  children,
  side = 'top',
  align = 'center',
  sideOffset = 10,
  alignOffset = 0,
  positionMethod = 'fixed',
  collisionPadding = 12,
  collisionAvoidance = CHART_TOOLTIP_COLLISION,
  collisionBoundary,
  positionerClassName,
}: {
  children: ReactNode
  className?: string
  positionerClassName?: string
  side?: PositionerProps['side']
  align?: PositionerProps['align']
  sideOffset?: PositionerProps['sideOffset']
  alignOffset?: PositionerProps['alignOffset']
  positionMethod?: PositionerProps['positionMethod']
  collisionPadding?: PositionerProps['collisionPadding']
  collisionAvoidance?: PositionerProps['collisionAvoidance']
  collisionBoundary?: PositionerProps['collisionBoundary']
}) {
  const boundary =
    collisionBoundary ??
    (typeof document !== 'undefined' ? document.body : ('clipping-ancestors' as const))

  return (
    <Tooltip.Portal>
      <Tooltip.Positioner
        className={cn('isolate z-[300]', positionerClassName)}
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        positionMethod={positionMethod}
        collisionPadding={collisionPadding}
        collisionAvoidance={collisionAvoidance}
        collisionBoundary={boundary}
      >
        <Tooltip.Popup
          className={cn(
            'z-[300] max-w-[min(280px,calc(100vw-1rem))] rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg outline-none',
            'origin-(--transform-origin) duration-150 ease-out',
            'data-[instant]:!animate-none data-[instant]:!opacity-100',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
            'data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2',
            'data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2',
            'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95',
            'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            className
          )}
        >
          {children}
        </Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  )
}

export { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent }
