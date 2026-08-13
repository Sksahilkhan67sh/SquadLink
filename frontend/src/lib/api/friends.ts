import { http } from './http'
import type { ApiFriendRequest, ApiUserPublic } from './types'

/** Matches FriendsService.listFriends' actual return shape — a friendship
 * record with the *other* user nested under `friend`, not a flat merge. */
export interface ApiFriendEntry {
  friend: ApiUserPublic
  pinned: boolean
  since: string
}

export const friendsApi = {
  list: () => http.get<ApiFriendEntry[]>('/friends'),

  incomingRequests: () => http.get<ApiFriendRequest[]>('/friends/requests/incoming'),

  outgoingRequests: () => http.get<ApiFriendRequest[]>('/friends/requests/outgoing'),

  sendRequest: (handle: string) => http.post<ApiFriendRequest>('/friends/requests', { handle }),

  acceptRequest: (id: string) => http.post<void>(`/friends/requests/${id}/accept`),

  declineRequest: (id: string) => http.post<void>(`/friends/requests/${id}/decline`),

  cancelRequest: (id: string) => http.delete<void>(`/friends/requests/${id}`),

  pin: (userId: string) => http.put<void>(`/friends/${userId}/pin`),

  unpin: (userId: string) => http.delete<void>(`/friends/${userId}/pin`),

  mutual: (userId: string) => http.get<ApiUserPublic[]>(`/friends/${userId}/mutual`),

  remove: (userId: string) => http.delete<void>(`/friends/${userId}`),

  block: (userId: string) => http.post<void>(`/friends/${userId}/block`),

  unblock: (userId: string) => http.delete<void>(`/friends/${userId}/block`),

  blocked: () => http.get<ApiUserPublic[]>('/friends/blocked'),
}
