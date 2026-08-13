import { createContext, useContext, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface TabsCtx { value: string; setValue: (v: string) => void }
const Ctx = createContext<TabsCtx | null>(null)

export function Tabs({ defaultValue, value: controlled, onValueChange, children, className }: {
  defaultValue?: string
  value?: string
  onValueChange?: (v: string) => void
  children: ReactNode
  className?: string
}) {
  const [internal, setInternal] = useState(defaultValue ?? '')
  const value = controlled ?? internal
  const setValue = (v: string) => { if (onValueChange) onValueChange(v); else setInternal(v) }
  return <Ctx.Provider value={{ value, setValue }}><div className={className}>{children}</div></Ctx.Provider>
}

export function TabsList({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('inline-flex items-center gap-1 border-b border-border', className)}>{children}</div>
}

export function TabsTrigger({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const ctx = useContext(Ctx)!
  const active = ctx.value === value
  return (
    <button
      onClick={() => ctx.setValue(value)}
      className={cn(
        'focus-ring relative px-4 py-2.5 text-sm font-semibold tracking-wide transition-colors',
        active ? 'text-orange-400' : 'text-steel-500 hover:text-steel-200',
        className,
      )}
    >
      {children}
      {active && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-orange-500" />}
    </button>
  )
}

export function TabsContent({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const ctx = useContext(Ctx)!
  if (ctx.value !== value) return null
  return <div className={className}>{children}</div>
}
