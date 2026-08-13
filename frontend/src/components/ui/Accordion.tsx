import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Accordion({ items }: { items: { title: string; content: ReactNode }[] }) {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className="divide-y divide-border border border-border">
      {items.map((item, i) => (
        <div key={i}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="focus-ring flex w-full items-center justify-between px-4 py-3.5 text-left text-sm font-semibold text-steel-100 hover:bg-surface-2"
          >
            {item.title}
            <ChevronDown className={cn('size-4 text-steel-500 transition-transform', open === i && 'rotate-180')} />
          </button>
          {open === i && <div className="anim-slide-up px-4 pb-4 text-sm text-steel-400">{item.content}</div>}
        </div>
      ))}
    </div>
  )
}
