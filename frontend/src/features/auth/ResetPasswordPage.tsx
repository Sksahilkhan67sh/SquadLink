import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Lock, CheckCircle2, AlertTriangle } from 'lucide-react'
import { AuthLayout } from './AuthLayout'
import { Input, Label } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { authApi } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/http'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const mismatch = confirm.length > 0 && password !== confirm

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (mismatch || !token) return
    setError(null)
    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      setDone(true)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 400 || err.status === 404)) {
        setError('This reset link is invalid or has expired. Request a new one.')
      } else {
        setError('Something went wrong. Try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <AuthLayout title="Invalid link" subtitle="This password reset link is missing its token.">
        <div className="bevel-md flex flex-col items-center border border-border bg-surface p-8 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-red-500/15 text-red-400">
            <AlertTriangle className="size-6" />
          </div>
          <p className="text-sm text-steel-400">Open the link from your email again, or request a new one.</p>
          <Button size="lg" className="mt-6 w-full" onClick={() => navigate('/forgot-password')}>Request a new link</Button>
        </div>
      </AuthLayout>
    )
  }

  if (done) {
    return (
      <AuthLayout title="Password reset" subtitle="You're all set.">
        <div className="bevel-md flex flex-col items-center border border-border bg-surface p-8 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="size-6" />
          </div>
          <p className="text-sm text-steel-400">Your password has been updated. Log in with your new password.</p>
          <Button size="lg" className="mt-6 w-full" onClick={() => navigate('/login')}>Back to login</Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Set a new password" subtitle="Make it something you'll remember.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="new-password">New password</Label>
          <Input id="new-password" type="password" placeholder="At least 8 characters" icon={<Lock className="size-4" />} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input id="confirm-password" type="password" placeholder="Re-enter password" icon={<Lock className="size-4" />} required value={confirm} onChange={(e) => setConfirm(e.target.value)} error={mismatch ? 'Passwords don\u2019t match' : error ?? undefined} />
        </div>
        <Button type="submit" size="lg" className="mt-2 w-full" loading={loading} disabled={mismatch || !password}>
          Reset password
        </Button>
      </form>
    </AuthLayout>
  )
}
