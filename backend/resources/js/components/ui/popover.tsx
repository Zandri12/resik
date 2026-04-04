'use client'

import * as React from 'react'
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { cn } from '@/lib/utils'

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger
const PopoverClose = PopoverPrimitive.Close

type PositionerProps = React.ComponentProps<typeof PopoverPrimitive.Positioner>

function PopoverContent({
  className,
  align,
  side,
  sideOffset,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Popup> & {
  align?: PositionerProps['align']
  side?: PositionerProps['side']
  sideOffset?: PositionerProps['sideOffset']
}) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner align={align} side={side} sideOffset={sideOffset}>
        <PopoverPrimitive.Popup
          className={cn(
            'z-50 w-auto rounded-lg border border-border bg-popover p-0 text-popover-foreground shadow-md outline-none',
            className
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

export { Popover, PopoverTrigger, PopoverContent, PopoverClose }
