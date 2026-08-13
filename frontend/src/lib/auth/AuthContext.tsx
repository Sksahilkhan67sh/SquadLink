import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi } from '../api/auth'
import { usersApi } from '../api/users'
import { ApiError, getAccessToken, registerRefreshHandler, registerSessionExpiredHandler, setAccessToken } from '../api/http'
import type { ApiAuthUser } from '../api/types'
import { connectSocket, disconnectSocket } from '../realtime/socket'

interface AuthContextValue {
  user: ApiAuthUser | null
  status: 'loading' | 'authenticated' | 'unauthenticated' | 'session-expired'
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  register: (data: { handle: string; displayName: string; email: string; password: string }) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  /** Used by the /oauth/callback route: we only get a bare access token from the redirect fragment. */
  applyOAuthToken: (accessToken: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiAuthUser | null>(null)
  const [status, setStatus] = useState<AuthContextValue['status']>('loading')

  const applySession = useCallback((session: { user: ApiAuthUser; tokens: { accessToken: string; expiresIn: number } }) => {
    setAccessToken(session.tokens.accessToken, session.tokens.expiresIn)
    setUser(session.user)
    setStatus('authenticated')
    connectSocket()
  }, [])

  const clearSession = useCallback(() => {
    setAccessToken(null)
    setUser(null)
    disconnectSocket()
  }, [])

  // Silent refresh: the httpOnly refresh_token cookie is the real source of
  // truth, so a page reload (which loses the in-memory access token) can
  // still recover a session without the user re-entering credentials.
  const attemptRefresh = useCallback(async (): Promise<boolean> => {
    try {
      const session = await authApi.refresh()
      applySession(session)
      return true
    } catch {
      clearSession()
      return false
    }
  }, [applySession, clearSession])

  useEffect(() => {
    registerRefreshHandler(attemptRefresh)
    registerSessionExpiredHandler(() => {
      clearSession()
      setStatus('session-expired')
    })
  }, [attemptRefresh, clearSession])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const ok = await attemptRefresh()
      if (!cancelled && !ok) setStatus('unauthenticated')
    })()
    return () => {
      cancelled = true
    }
    // Only run once at mount — attemptRefresh is stable via useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(
    async (email: string, password: string, rememberMe?: boolean) => {
      const session = await authApi.login({ email, password, rememberMe })
      applySession(session)
    },
    [applySession],
  )

  const register = useCallback(
    async (data: { handle: string; displayName: string; email: string; password: string }) => {
      const session = await authApi.register(data)
      applySession(session)
    },
    [applySession],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch (err) {
      // Already-invalid session shouldn't block clearing local state.
      if (!(err instanceof ApiError)) throw err
    } finally {
      clearSession()
      setStatus('unauthenticated')
    }
  }, [clearSession])

  const refreshUser = useCallback(async () => {
    await attemptRefresh()
  }, [attemptRefresh])

  // The OAuth callback redirect only carries a short-lived access token in
  // the URL fragment (see backend auth.controller comment on why the
  // refresh token stays server-side as an httpOnly cookie). We set it, then
  // fetch the profile to populate `user` and pick up the refresh cookie
  // that the redirect response already set.
  const applyOAuthToken = useCallback(async (accessToken: string) => {
    setAccessToken(accessToken, 15 * 60)
    const me = await usersApi.me()
    setUser({
      id: me.id,
      email: me.email,
      handle: me.handle,
      displayName: me.displayName,
      avatarUrl: me.avatarUrl,
      emailVerified: me.emailVerified,
    })
    setStatus('authenticated')
    connectSocket()
  }, [])

  const value = useMemo(
    () => ({ user, status, login, register, logout, refreshUser, applyOAuthToken }),
    [user, status, login, register, logout, refreshUser, applyOAuthToken],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

export function isAuthenticated() {
  return Boolean(getAccessToken())
}
