import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function EmptyState({ icon, title, description, action, className }: {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
      <div className="bevel-md carbon-weave mb-5 flex size-16 items-center justify-center border border-border bg-surface-2 text-orange-500">
        {icon}
      </div>
      <h3 className="font-display text-lg font-semibold text-steel-100">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-steel-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
