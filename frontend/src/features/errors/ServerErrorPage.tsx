import { useNavigate } from 'react-router-dom'
import { ServerCrash, RotateCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ErrorLayout } from './ErrorLayout'

export function ServerErrorPage() {
  const navigate = useNavigate()
  return (
    <ErrorLayout
      code="500"
      icon={<ServerCrash className="size-9" />}
      title="Something broke on our end"
      description="Our servers hit a snag. We're on it — try refreshing in a moment."
      actions={
        <>
          <Button variant="outline" size="lg" onClick={() => window.location.reload()}><RotateCw className="size-4" /> Retry</Button>
          <Button size="lg" onClick={() => navigate('/')}><Home className="size-4" /> Home</Button>
        </>
      }
    />
  )
}
