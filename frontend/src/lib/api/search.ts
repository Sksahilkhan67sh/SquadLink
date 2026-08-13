import { http } from './http'
import type { ApiCommunity, ApiMessage, ApiSearchResults, ApiUserPublic } from './types'

export const searchApi = {
  all: (query: string, signal?: AbortSignal) => http.get<ApiSearchResults>('/search', { q: query }, signal),

  users: (query: string, signal?: AbortSignal) => http.get<ApiUserPublic[]>('/search/users', { q: query }, signal),

  communities: (query: string, signal?: AbortSignal) =>
    http.get<ApiCommunity[]>('/search/communities', { q: query }, signal),

  messages: (query: string, signal?: AbortSignal) => http.get<ApiMessage[]>('/search/messages', { q: query }, signal),
}
