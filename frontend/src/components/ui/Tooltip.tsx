import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Tooltip({ content, children, side = 'top' }: { content: string; children: ReactNode; side?: 'top' | 'bottom' | 'right' }) {
  const [show, setShow] = useState(false)
  const pos = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }[side]

  return (
    <span className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span className={cn('anim-fade-in pointer-events-none absolute z-50 whitespace-nowrap rounded-sm border border-border-strong bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-steel-200 shadow-xl', pos)}>
          {content}
        </span>
      )}
    </span>
  )
}
