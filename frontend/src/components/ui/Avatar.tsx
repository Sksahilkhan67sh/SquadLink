import { cn, initials } from '@/lib/utils'
import type { PresenceStatus } from '@/types'

const statusColor: Record<PresenceStatus, string> = {
  online: 'bg-success',
  'in-game': 'bg-orange-500',
  idle: 'bg-warning',
  'do-not-disturb': 'bg-danger',
  offline: 'bg-steel-700',
}

const sizeMap = { xs: 'size-6 text-[10px]', sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-base', xl: 'size-20 text-xl' }
const dotSize = { xs: 'size-1.5', sm: 'size-2', md: 'size-2.5', lg: 'size-3.5', xl: 'size-4' }

interface AvatarProps {
  name: string
  color?: string
  size?: keyof typeof sizeMap
  status?: PresenceStatus
  speaking?: boolean
  className?: string
}

export function Avatar({ name, color = '#f2691c', size = 'md', status, speaking, className }: AvatarProps) {
  return (
    <div className={cn('relative shrink-0', className)}>
      <div
        className={cn(
          'flex items-center justify-center rounded-full font-display font-semibold text-black',
          sizeMap[size],
          speaking && 'ring-2 ring-orange-400 ring-offset-2 ring-offset-base',
        )}
        style={{ backgroundColor: color }}
      >
        {initials(name)}
      </div>
      {status && (
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-base',
            dotSize[size],
            statusColor[status],
          )}
        />
      )}
    </div>
  )
}
