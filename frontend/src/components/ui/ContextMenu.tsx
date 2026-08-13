import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ContextMenuItem { label: string; icon?: ReactNode; onClick?: () => void; danger?: boolean }

export function ContextMenu({ children, items }: { children: ReactNode; items: ContextMenuItem[] }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = () => setPos(null)
    if (pos) document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [pos])

  return (
    <div
      ref={ref}
      onContextMenu={(e) => {
        e.preventDefault()
        setPos({ x: e.clientX, y: e.clientY })
      }}
    >
      {children}
      {pos &&
        createPortal(
          <div
            className="anim-fade-in bevel-sm fixed z-[90] min-w-[180px] border border-border-strong bg-surface-2 py-1.5 shadow-2xl"
            style={{ top: pos.y, left: pos.x }}
          >
            {items.map((item, i) => (
              <button
                key={i}
                onClick={() => { item.onClick?.(); setPos(null) }}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors ${item.danger ? 'text-[#ff8570] hover:bg-danger/15' : 'text-steel-200 hover:bg-surface-3'}`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}
