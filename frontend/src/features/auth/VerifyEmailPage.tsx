import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MailCheck, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react'
import { AuthLayout } from './AuthLayout'
import { Button } from '@/components/ui/Button'
import { authApi } from '@/lib/api/auth'
import { useAuth } from '@/lib/auth/AuthContext'
import { useToast } from '@/components/ui/Toast'

export function VerifyEmailPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const { user, refreshUser } = useAuth()
  const toast = useToast()
  const [resending, setResending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(false)
  const [verifyError, setVerifyError] = useState(false)
  const ran = useRef(false)

  // If the user opened the emailed link (?token=...), verify automatically.
  useEffect(() => {
    if (!token || ran.current) return
    ran.current = true
    setVerifying(true)
    authApi
      .verifyEmail(token)
      .then(async () => {
        setVerified(true)
        await refreshUser()
      })
      .catch(() => setVerifyError(true))
      .finally(() => setVerifying(false))
  }, [token, refreshUser])

  async function resend() {
    if (!user?.email) return
    setResending(true)
    try {
      await authApi.resendVerification(user.email)
      toast.push({ kind: 'success', title: 'Verification email sent' })
    } catch {
      toast.push({ kind: 'error', title: "Couldn't send email — try again shortly" })
    } finally {
      setResending(false)
    }
  }

  if (verified) {
    return (
      <AuthLayout title="Email verified" subtitle="You're all set.">
        <div className="bevel-md flex flex-col items-center border border-border bg-surface p-8 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="size-6" />
          </div>
          <Button size="lg" className="mt-2 w-full" onClick={() => navigate('/')}>Continue to SquadLink</Button>
        </div>
      </AuthLayout>
    )
  }

  if (verifyError) {
    return (
      <AuthLayout title="Verification failed" subtitle="This link is invalid or has expired.">
        <div className="bevel-md flex flex-col items-center border border-border bg-surface p-8 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-red-500/15 text-red-400">
            <AlertTriangle className="size-6" />
          </div>
          <p className="text-sm text-steel-400">Request a new verification email below.</p>
          <button
            onClick={resend}
            disabled={resending || !user}
            className="focus-ring mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-steel-500 hover:text-orange-400 disabled:opacity-50"
          >
            <RefreshCw className={resending ? 'size-3.5 animate-spin' : 'size-3.5'} />
            {resending ? 'Sending…' : 'Resend email'}
          </button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Verify your email" subtitle="Almost there — confirm your address to continue.">
      <div className="bevel-md flex flex-col items-center border border-border bg-surface p-8 text-center">
        <div className="bevel-md mb-5 flex size-16 items-center justify-center border border-orange-500/30 bg-orange-500/10 text-orange-500">
          <MailCheck className="size-7" />
        </div>
        <p className="text-sm text-steel-400">
          {verifying
            ? 'Verifying your email…'
            : (
              <>We sent a verification link to <span className="font-semibold text-steel-200">{user?.email ?? 'your inbox'}</span>. Open it on this device to continue automatically.</>
            )}
        </p>
        <button
          onClick={resend}
          disabled={resending || !user}
          className="focus-ring mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-steel-500 hover:text-orange-400 disabled:opacity-50"
        >
          <RefreshCw className={resending ? 'size-3.5 animate-spin' : 'size-3.5'} />
          {resending ? 'Sending…' : 'Resend email'}
        </button>
      </div>
    </AuthLayout>
  )
}
