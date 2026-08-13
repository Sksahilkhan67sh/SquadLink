import { WifiOff, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ErrorLayout } from './ErrorLayout'

export function NetworkErrorPage() {
  return (
    <ErrorLayout
      icon={<WifiOff className="size-9" />}
      title="Connection lost"
      description="We couldn't reach SquadLink servers. Check your connection and try again."
      actions={<Button size="lg" onClick={() => window.location.reload()}><RotateCw className="size-4" /> Try Again</Button>}
    />
  )
}
