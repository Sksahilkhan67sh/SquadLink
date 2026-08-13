import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'default' | 'orange' | 'success' | 'danger' | 'outline'

const variants: Record<Variant, string> = {
  default: 'bg-surface-3 text-steel-300',
  orange: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
  success: 'bg-success/15 text-success',
  danger: 'bg-danger/15 text-[#ff8570]',
  outline: 'border border-border-strong text-steel-300',
}

export function Badge({
  className, variant = 'default', children, ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
