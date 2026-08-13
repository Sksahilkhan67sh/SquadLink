import { useNavigate } from 'react-router-dom'
import { Compass, Home } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ErrorLayout } from './ErrorLayout'

export function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <ErrorLayout
      code="404"
      icon={<Compass className="size-9" />}
      title="This page wandered off"
      description="The page you're looking for doesn't exist or may have moved."
      actions={<Button size="lg" onClick={() => navigate('/')}><Home className="size-4" /> Back to Home</Button>}
    />
  )
}
