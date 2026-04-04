'use client'

import { DayPicker } from 'react-day-picker'
import { cn } from '@/lib/utils'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({ className, classNames, ...props }: CalendarProps) {
  return (
    <DayPicker
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row gap-2',
        month: 'flex flex-col gap-4',
        month_caption: 'flex justify-center pt-1 relative items-center',
        caption_label: 'text-sm font-medium',
        nav: 'flex items-center gap-1',
        button_previous: 'size-7 rounded-md border border-input bg-background inline-flex items-center justify-center hover:bg-accent',
        button_next: 'size-7 rounded-md border border-input bg-background inline-flex items-center justify-center hover:bg-accent',
        month_grid: 'w-full border-collapse space-x-1',
        weekdays: 'flex',
        weekday:
          'text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]',
        week: 'flex w-full mt-2',
        day: 'size-8 text-center text-sm p-0 relative rounded-md',
        day_button:
          'size-8 p-0 font-normal rounded-md hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
        today: 'bg-accent text-accent-foreground',
        outside: 'text-muted-foreground opacity-50',
        disabled: 'text-muted-foreground opacity-50',
        ...classNames,
      }}
      {...props}
    />
  )
}

export { Calendar }
