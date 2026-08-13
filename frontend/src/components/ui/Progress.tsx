import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Progress({ value, className, accent = 'orange' }: { value: number; className?: string; accent?: 'orange' | 'success' }) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', accent === 'orange' ? 'bg-orange-500' : 'bg-success')}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

export function Spinner({ className, size = 'size-5' }: { className?: string; size?: string }) {
  return <Loader2 className={cn(size, 'animate-spin text-orange-500', className)} />
}
