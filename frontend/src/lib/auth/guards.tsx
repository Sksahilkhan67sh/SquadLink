import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { LoadingScreen } from '@/components/shared/LoadingScreen'
import { LandingPage } from '@/features/landing/LandingPage'

/** Splash/loading state while we bootstrap the session from the refresh cookie. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()
  if (status === 'loading') {
    return <LoadingScreen message="Signing you in…" />
  }
  return <>{children}</>
}

/**
 * The root path "/" does double duty: it's the public marketing page for
 * a logged-out visitor, and the dashboard redirect for a logged-in one —
 * unlike every other authenticated route, it shouldn't just bounce
 * straight to /login, since a first-time visitor hitting the bare domain
 * hasn't asked for the app yet.
 */
export function RootRoute() {
  const { status } = useAuth()
  if (status === 'authenticated') {
    return <Navigate to="/home" replace />
  }
  return <LandingPage />
}

/** Wraps routes that require an authenticated session. */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <Outlet />
}

/** Wraps routes (login/register) that should redirect an already-authenticated user home. */
export function RequireGuest() {
  const { status } = useAuth()

  if (status === 'authenticated') {
    return <Navigate to="/home" replace />
  }
  return <Outlet />
}
