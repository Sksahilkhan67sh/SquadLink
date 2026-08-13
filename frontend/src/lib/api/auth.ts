import { http } from './http'
import type { ApiAuthResponse } from './types'

export const authApi = {
  register: (data: { handle: string; displayName: string; email: string; password: string }) =>
    http.post<ApiAuthResponse>('/auth/register', data),

  login: (data: { email: string; password: string; rememberMe?: boolean }) =>
    http.post<ApiAuthResponse>('/auth/login', data),

  /** Relies on the httpOnly refresh_token cookie; no body needed. */
  refresh: () => http.post<ApiAuthResponse>('/auth/refresh'),

  logout: () => http.post<void>('/auth/logout'),

  forgotPassword: (email: string) => http.post<void>('/auth/forgot-password', { email }),

  resetPassword: (token: string, newPassword: string) =>
    http.post<void>('/auth/reset-password', { token, newPassword }),

  verifyEmail: (token: string) => http.post<void>('/auth/verify-email', { token }),

  resendVerification: (email: string) => http.post<void>('/auth/resend-verification', { email }),

  sessions: () => http.get<{ id: string; userAgent: string | null; ipAddress: string | null; createdAt: string }[]>(
    '/auth/sessions',
  ),

  revokeSession: (id: string) => http.delete<void>(`/auth/sessions/${id}`),

  /** OAuth providers are full-page redirects, not fetch calls. */
  oauthUrl: (provider: 'google' | 'discord' | 'github' | 'twitch' | 'steam') =>
    `${import.meta.env.VITE_API_URL}/api/v1/auth/${provider}`,
}
