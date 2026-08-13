import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Info, TriangleAlert, XCircle, X } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'info' | 'warning'
interface ToastItem { id: number; kind: ToastKind; title: string; description?: string }

interface ToastCtx { push: (t: Omit<ToastItem, 'id'>) => void }
const Ctx = createContext<ToastCtx | null>(null)

const icons: Record<ToastKind, ReactNode> = {
  success: <CheckCircle2 className="size-5 text-success" />,
  error: <XCircle className="size-5 text-[#ff8570]" />,
  info: <Info className="size-5 text-steel-300" />,
  warning: <TriangleAlert className="size-5 text-warning" />,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const push = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { ...t, id }])
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4500)
  }, [])

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      {createPortal(
        <div className="fixed bottom-5 right-5 z-[100] flex w-80 flex-col gap-2.5">
          {toasts.map((t) => (
            <div key={t.id} className="anim-slide-in-right bevel-sm flex items-start gap-3 border border-border-strong bg-surface-2 p-3.5 shadow-2xl">
              {icons[t.kind]}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-steel-100">{t.title}</p>
                {t.description && <p className="mt-0.5 text-xs text-steel-500">{t.description}</p>}
              </div>
              <button onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} className="text-steel-600 hover:text-steel-200">
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </Ctx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
