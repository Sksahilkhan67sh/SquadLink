import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Mail, MailCheck, ArrowLeft } from 'lucide-react'
import { AuthLayout } from './AuthLayout'
import { Input, Label } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { authApi } from '@/lib/api/auth'
import { ApiError, NetworkError } from '@/lib/api/http'

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      // Backend always returns 204 regardless of whether the email exists,
      // so success here never leaks account existence.
      await authApi.forgotPassword(email)
      setSent(true)
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError('Too many attempts. Try again in a few minutes.')
      } else if (err instanceof NetworkError) {
        setError("Couldn't reach the server. Check your connection.")
      } else {
        setError('Something went wrong. Try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <AuthLayout title="Check your inbox" subtitle="We sent a reset link to your email.">
        <div className="bevel-md flex flex-col items-center border border-border bg-surface p-8 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-success/15 text-success">
            <MailCheck className="size-6" />
          </div>
          <p className="text-sm text-steel-400">Didn’t get it? Check your spam folder, or try again in a minute.</p>
          <Link to="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-orange-400 hover:text-orange-300">
            <ArrowLeft className="size-4" /> Back to login
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Enter your email and we’ll send a reset link."
      footer={<Link to="/login" className="inline-flex items-center gap-1.5 font-semibold text-orange-400 hover:text-orange-300"><ArrowLeft className="size-3.5" /> Back to login</Link>}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="fp-email">Email</Label>
          <Input id="fp-email" type="email" placeholder="you@example.com" icon={<Mail className="size-4" />} required value={email} onChange={(e) => setEmail(e.target.value)} error={error ?? undefined} />
        </div>
        <Button type="submit" size="lg" className="mt-2 w-full" loading={loading}>
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  )
}
