import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth/AuthContext'

/**
 * Landing page for `${APP_URL}/oauth/callback#accessToken=...`, which the
 * backend redirects to after a successful Google/Discord/GitHub/Twitch/Steam
 * login (see auth.controller.ts `completeOAuthLogin`). The refresh token is
 * already set as an httpOnly cookie by that redirect response — this page
 * only has to pick up the access token from the fragment (never sent to the
 * server, so it doesn't leak into logs) and hydrate the session.
 */
export function OAuthCallbackPage() {
  const { applyOAuthToken } = useAuth()
  const [state, setState] = useState<'working' | 'error' | 'done'>('working')
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const hash = new URLSearchParams(window.location.hash.slice(1))
    const token = hash.get('accessToken')
    if (!token) {
      setState('error')
      return
    }
    applyOAuthToken(token)
      .then(() => setState('done'))
      .catch(() => setState('error'))
  }, [applyOAuthToken])

  if (state === 'done') return <Navigate to="/" replace />
  if (state === 'error') return <Navigate to="/login" replace state={{ oauthError: true }} />

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
      <div className="animate-pulse text-sm">Signing you in…</div>
    </div>
  )
}
