import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function ErrorState({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-16 text-center ${className ?? ''}`}>
      <div className="bevel-md carbon-weave mb-5 flex size-16 items-center justify-center border border-border bg-surface-2 text-red-400">
        <AlertTriangle className="size-6" />
      </div>
      <h3 className="font-display text-lg font-semibold text-steel-100">Something went wrong</h3>
      <p className="mt-1.5 max-w-sm text-sm text-steel-500">{message}</p>
      {onRetry && (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
