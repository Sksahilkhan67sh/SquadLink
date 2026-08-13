import { http } from './http'
import type { ApiNotification, PaginatedResult } from './types'

export const notificationsApi = {
  list: (page = 1, limit = 20) => http.get<PaginatedResult<ApiNotification>>('/notifications', { page, limit }),

  unreadCount: () => http.get<{ count: number }>('/notifications/unread-count'),

  markRead: (id: string) => http.patch<ApiNotification>(`/notifications/${id}/read`),

  markAllRead: () => http.patch<void>('/notifications/read-all'),

  remove: (id: string) => http.delete<void>(`/notifications/${id}`),
}
