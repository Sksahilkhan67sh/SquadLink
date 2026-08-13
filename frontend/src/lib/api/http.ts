import { env } from '../env'

/**
 * Access token lives in memory only (module-level variable), never in
 * localStorage/sessionStorage — it's short-lived (15m) and refreshed via
 * the httpOnly `refresh_token` cookie, which JS can never read anyway.
 * A page reload loses the in-memory token by design; `bootstrapSession()`
 * (called once at app start) exchanges the refresh cookie for a fresh one.
 */
let accessToken: string | null = null
let accessTokenExpiresAt = 0

export function setAccessToken(token: string | null, expiresInSeconds?: number) {
  accessToken = token
  accessTokenExpiresAt = token && expiresInSeconds ? Date.now() + expiresInSeconds * 1000 : 0
}

export function getAccessToken() {
  return accessToken
}

/** True if the in-memory access token exists and isn't within 10s of expiring. */
export function isAccessTokenFresh() {
  return Boolean(accessToken) && Date.now() < accessTokenExpiresAt - 10_000
}

export class ApiError extends Error {
  status: number
  code?: string
  details?: unknown

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export class NetworkError extends Error {
  constructor(message = 'Network request failed') {
    super(message)
    this.name = 'NetworkError'
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | boolean | undefined | null>
  /** Multipart form body — when set, `body` is ignored and Content-Type is left for the browser to set (with boundary). */
  form?: FormData
  /** Internal: prevents infinite refresh loops. */
  _isRetry?: boolean
  signal?: AbortSignal
}

const REQUEST_TIMEOUT_MS = 15_000

function buildUrl(path: string, query?: RequestOptions['query']) {
  const url = new URL(`${env.apiUrl}/api/v1${path}`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

/** Set by AuthContext so the http layer can trigger a refresh without a circular import. */
let refreshHandler: (() => Promise<boolean>) | null = null
export function registerRefreshHandler(handler: () => Promise<boolean>) {
  refreshHandler = handler
}

/** Set by AuthContext so a hard-expired session can redirect to /login. */
let onSessionExpired: (() => void) | null = null
export function registerSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler
}

interface ApiSuccessEnvelope<T> {
  success: true
  data: T
  meta?: Record<string, unknown>
  timestamp: string
}

interface ApiErrorEnvelope {
  success: false
  error: { code: string; message: string; details?: unknown }
  timestamp: string
  path: string
}

function isEnvelope(payload: unknown): payload is ApiSuccessEnvelope<unknown> | ApiErrorEnvelope {
  return Boolean(payload) && typeof payload === 'object' && 'success' in (payload as object)
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, form, _isRetry, signal } = options

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  if (signal) signal.addEventListener('abort', () => controller.abort())

  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  if (!form) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      credentials: 'include', // send the httpOnly refresh_token cookie
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeout)
    if ((err as Error).name === 'AbortError') {
      throw new NetworkError('Request timed out')
    }
    throw new NetworkError()
  }
  clearTimeout(timeout)

  // 204 No Content
  if (response.status === 204) return undefined as T

  let payload: unknown = null
  const text = await response.text()
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      // Non-JSON body (shouldn't happen for this API); leave payload null.
    }
  }

  // Every response is wrapped by the backend's ResponseInterceptor /
  // GlobalExceptionFilter as {success, data|error, timestamp, ...} — unwrap
  // it here, once, so every api/*.ts module can keep working with plain
  // response shapes.
  const unwrapped = isEnvelope(payload) ? payload : null

  if (response.ok) {
    if (unwrapped && unwrapped.success) return unwrapped.data as T
    return payload as T
  }

  let errMessage: string
  let code: string | undefined
  let details: unknown
  if (unwrapped && !unwrapped.success) {
    errMessage = unwrapped.error.message
    code = unwrapped.error.code
    details = unwrapped.error.details
  } else {
    // Fallback for a response that somehow bypassed the envelope (e.g. a
    // proxy/framework-level error page) — best-effort rather than crashing.
    const message = (payload as { message?: string | string[] })?.message
    errMessage = (Array.isArray(message) ? message.join(', ') : message) ?? response.statusText ?? 'Request failed'
  }

  // Access token expired mid-session — try exactly one silent refresh,
  // then retry the original request once.
  if (response.status === 401 && !_isRetry && refreshHandler && path !== '/auth/refresh') {
    const refreshed = await refreshHandler()
    if (refreshed) {
      return request<T>(path, { ...options, _isRetry: true })
    }
    onSessionExpired?.()
  }

  throw new ApiError(response.status, errMessage, code, details ?? payload)
}

export const http = {
  get: <T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal) =>
    request<T>(path, { method: 'GET', query, signal }),
  post: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: 'POST', body, signal }),
  patch: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: 'PATCH', body, signal }),
  put: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: 'PUT', body, signal }),
  delete: <T>(path: string, signal?: AbortSignal) => request<T>(path, { method: 'DELETE', signal }),
  postForm: <T>(path: string, form: FormData, signal?: AbortSignal) =>
    request<T>(path, { method: 'POST', form, signal }),
}
