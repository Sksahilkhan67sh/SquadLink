import { http } from './http'
import type { ApiPreferences } from './types'

export const settingsApi = {
  getPreferences: () => http.get<ApiPreferences>('/settings/preferences'),

  updatePreferences: (data: Partial<ApiPreferences>) => http.patch<ApiPreferences>('/settings/preferences', data),

  changePassword: (currentPassword: string, newPassword: string) =>
    http.patch<void>('/settings/password', { currentPassword, newPassword }),

  deleteAccount: () => http.delete<void>('/settings/account'),
}
