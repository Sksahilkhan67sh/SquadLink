import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { LoadingScreen } from '@/components/shared/LoadingScreen'

/** Splash/loading state while we bootstrap the session from the refresh cookie. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()
  if (status === 'loading') {
    return <LoadingScreen message="Signing you in…" />
  }
  return <>{children}</>
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
    return <Navigate to="/" replace />
  }
  return <Outlet />
}
