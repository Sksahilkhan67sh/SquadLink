/**
 * Central, typed access to public runtime config.
 *
 * Only VITE_-prefixed variables are ever readable here — Vite strips
 * everything else from the client bundle, so this file can never
 * accidentally expose a backend secret even if one leaked into `.env`.
 */

function requireEnv(key: string, fallback: string): string {
  const value = import.meta.env[key as keyof ImportMetaEnv] as string | undefined
  if (value && value.length > 0) return value
  if (import.meta.env.PROD) {
    // In production, missing config should be loud rather than silently
    // falling back to a localhost URL that will never work.
    console.error(`[env] Missing ${key} — falling back to ${fallback}, this is likely wrong in production.`)
  }
  return fallback
}

export const env = {
  apiUrl: requireEnv('VITE_API_URL', 'http://localhost:3000'),
  socketUrl: requireEnv('VITE_SOCKET_URL', 'http://localhost:3000'),
  livekitUrl: requireEnv('VITE_LIVEKIT_URL', 'ws://localhost:7880'),
}
