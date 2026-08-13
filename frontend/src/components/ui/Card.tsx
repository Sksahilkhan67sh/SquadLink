import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, bevel = true, ...props }: HTMLAttributes<HTMLDivElement> & { bevel?: boolean }) {
  return (
    <div
      className={cn(
        'border border-border bg-surface shadow-[var(--shadow-panel)]',
        bevel && 'bevel-md',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center justify-between border-b border-border px-5 py-4', className)} {...props} />
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('font-display text-lg font-semibold tracking-wide text-steel-100', className)} {...props} />
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />
}
