import * as React from 'react'
import { cn } from '@/lib/utils'

function Alert({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      role="alert"
      className={cn('relative w-full rounded-lg border px-4 py-3 text-sm', className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mb-1 font-medium leading-none', className)} {...props} />
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('text-muted-foreground', className)} {...props} />
}

export { Alert, AlertDescription, AlertTitle }
