import { http } from './http'
import type { ApiUserPrivate, ApiUserPublic } from './types'

export const usersApi = {
  me: () => http.get<ApiUserPrivate>('/users/me'),

  updateProfile: (data: Partial<{ displayName: string; handle: string; bio: string; avatarColor: string; bannerAccent: string }>) =>
    http.patch<ApiUserPrivate>('/users/me', data),

  updatePresence: (data: Partial<{ status: string; statusText: string; currentGame: string }>) =>
    http.patch<ApiUserPrivate>('/users/me/presence', data),

  // Preferences live only under settingsApi (/settings/preferences) — the
  // backend used to also expose GET/PATCH /users/me/preferences as an
  // undocumented duplicate of the same UserPreferences row; that route has
  // been removed so there's a single source of truth.

  deleteAccount: () => http.delete<void>('/users/me'),

  search: (query: string) => http.get<ApiUserPublic[]>('/users/search', { q: query }),

  byHandle: (handle: string) => http.get<ApiUserPublic>(`/users/${handle}`),
}
