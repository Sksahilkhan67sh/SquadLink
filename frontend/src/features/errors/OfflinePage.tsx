import { useNavigate } from 'react-router-dom'
import { CloudOff, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ErrorLayout } from './ErrorLayout'

export function OfflinePage() {
  const navigate = useNavigate()
  return (
    <ErrorLayout
      icon={<CloudOff className="size-9" />}
      title="You're offline"
      description="Voice, messaging, and live status won't update, but you can still browse cached content."
      actions={<Button size="lg" onClick={() => navigate('/')}>Continue Offline <ArrowRight className="size-4" /></Button>}
    />
  )
}
