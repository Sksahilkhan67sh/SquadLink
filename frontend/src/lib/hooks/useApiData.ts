import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, NetworkError } from '../api/http'

export type FetchState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'success'; data: T; error?: undefined }
  | { status: 'empty'; data: T; error?: undefined }
  | { status: 'error'; data?: undefined; error: string }

function isEmpty(data: unknown): boolean {
  if (Array.isArray(data)) return data.length === 0
  if (data && typeof data === 'object' && 'items' in data) {
    return Array.isArray((data as { items: unknown[] }).items) && (data as { items: unknown[] }).items.length === 0
  }
  return false
}

function toMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return "You don't have permission to view this."
    if (err.status === 404) return 'Not found.'
    if (err.status === 429) return 'Too many requests — try again shortly.'
    if (err.status >= 500) return 'Something went wrong on our end. Try again.'
    return err.message || 'Request failed.'
  }
  if (err instanceof NetworkError) return "Couldn't reach the server. Check your connection."
  return 'Something went wrong.'
}

/**
 * Runs `fetcher` on mount and whenever `deps` change, exposing a consistent
 * loading/success/empty/error shape plus a `retry()` for the error state.
 * `fetcher` receives an AbortSignal so in-flight requests are cancelled if
 * deps change again before the previous request resolves.
 */
export function useApiData<T>(fetcher: (signal: AbortSignal) => Promise<T>, deps: unknown[] = []): FetchState<T> & { retry: () => void } {
  const [state, setState] = useState<FetchState<T>>({ status: 'loading' })
  const attempt = useRef(0)

  const run = useCallback(() => {
    const controller = new AbortController()
    setState({ status: 'loading' })
    fetcher(controller.signal)
      .then((data) => {
        setState({ status: isEmpty(data) ? 'empty' : 'success', data })
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setState({ status: 'error', error: toMessage(err) })
      })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => run(), [run])

  const retry = useCallback(() => {
    attempt.current += 1
    run()
  }, [run])

  return { ...state, retry } as FetchState<T> & { retry: () => void }
}
