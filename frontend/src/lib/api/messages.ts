import { http } from './http'
import type { ApiConversation, ApiMessage, PaginatedResult } from './types'

export const messagesApi = {
  listConversations: () => http.get<ApiConversation[]>('/conversations'),

  search: (query: string) => http.get<ApiMessage[]>('/conversations/search', { q: query }),

  getOrCreateDm: (userId: string) => http.post<ApiConversation>('/conversations/dm', { userId }),

  createGroup: (name: string, memberIds: string[]) =>
    http.post<ApiConversation>('/conversations/group', { name, memberIds }),

  listMessages: (conversationId: string, page = 1, limit = 50) =>
    http.get<PaginatedResult<ApiMessage>>(`/conversations/${conversationId}/messages`, { page, limit }),

  sendMessage: (
    conversationId: string,
    data: { content: string; replyToId?: string; attachments?: { type: 'IMAGE' | 'FILE'; url: string; name: string; size?: number }[] },
  ) => http.post<ApiMessage>(`/conversations/${conversationId}/messages`, data),

  markRead: (conversationId: string) => http.patch<void>(`/conversations/${conversationId}/read`),

  mute: (conversationId: string) => http.patch<void>(`/conversations/${conversationId}/mute`),

  unmute: (conversationId: string) => http.patch<void>(`/conversations/${conversationId}/unmute`),

  editMessage: (messageId: string, content: string) =>
    http.patch<ApiMessage>(`/conversations/messages/${messageId}`, { content }),

  deleteMessage: (messageId: string) => http.delete<void>(`/conversations/messages/${messageId}`),

  pinMessage: (conversationId: string, messageId: string) =>
    http.patch<void>(`/conversations/${conversationId}/messages/${messageId}/pin`),

  unpinMessage: (conversationId: string, messageId: string) =>
    http.patch<void>(`/conversations/${conversationId}/messages/${messageId}/unpin`),

  react: (messageId: string, emoji: string) =>
    http.post<void>(`/conversations/messages/${messageId}/reactions`, { emoji }),

  unreact: (messageId: string, emoji: string) =>
    http.delete<void>(`/conversations/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`),
}
