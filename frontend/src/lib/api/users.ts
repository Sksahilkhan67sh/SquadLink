import { http } from './http'
import type { ApiUserPrivate, ApiUserPublic } from './types'

export const usersApi = {
  me: () => http.get<ApiUserPrivate>('/users/me'),

  updateProfile: (data: Partial<{ displayName: string; handle: string; bio: string; avatarColor: string; bannerAccent: string }>) =>
    http.patch<ApiUserPrivate>('/users/me', data),

  updatePresence: (data: Partial<{ status: string; statusText: string; currentGame: string }>) =>
    http.patch<ApiUserPrivate>('/users/me/presence', data),

  // NOTE: the backend also exposes GET/PATCH /users/me/preferences, which is
  // a duplicate of /settings/preferences (see settings.ts). Both currently
  // read/write the same UserPreferences row. The frontend standardizes on
  // settingsApi for preferences so there's a single source of truth; the
  // duplicate route is flagged in the integration report rather than used
  // here or removed from the backend.

  deleteAccount: () => http.delete<void>('/users/me'),

  search: (query: string) => http.get<ApiUserPublic[]>('/users/search', { q: query }),

  byHandle: (handle: string) => http.get<ApiUserPublic>(`/users/${handle}`),
}
