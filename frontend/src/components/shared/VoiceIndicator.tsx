import { cn } from '@/lib/utils'

export function VoiceIndicator({ speaking, size = 'md' }: { speaking: boolean; size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? 'h-3' : 'h-4'
  return (
    <div className={cn('flex items-end gap-0.5', h)}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            'w-0.5 rounded-full',
            speaking ? 'bg-orange-500 animate-speak-bar' : 'bg-steel-700 h-1',
          )}
          style={speaking ? { height: '100%', animationDelay: `${i * 0.12}s` } : undefined}
        />
      ))}
    </div>
  )
}
