import { http } from './http'
import type { ApiParty, ApiPartyInvite, ApiUserPublic, ApiVoiceToken } from './types'

export interface ApiPartyIncomingInvite extends ApiPartyInvite {
  inviter: ApiUserPublic | null
}

export const partyApi = {
  getActive: () => http.get<ApiParty | null>('/party/active'),

  create: (data: { name: string; game?: string; maxSize?: number }) => http.post<ApiParty>('/party', data),

  get: (id: string) => http.get<ApiParty>(`/party/${id}`),

  invite: (id: string, userId: string) => http.post<ApiPartyInvite>(`/party/${id}/invite`, { userId }),

  /** "Public party" — invites every friend of the current user at once, reusing the same per-friend invite pipeline. */
  inviteAllFriends: (id: string) => http.post<{ invited: number; totalFriends: number }>(`/party/${id}/invite-friends`),

  incomingInvites: () => http.get<ApiPartyIncomingInvite[]>('/party/invites/incoming'),

  acceptInvite: (inviteId: string) => http.post<ApiParty>(`/party/invites/${inviteId}/accept`),

  declineInvite: (inviteId: string) => http.post<void>(`/party/invites/${inviteId}/decline`),

  leave: (id: string) => http.post<void>(`/party/${id}/leave`),

  kick: (id: string, userId: string) => http.post<ApiParty>(`/party/${id}/kick/${userId}`),

  transfer: (id: string, userId: string) => http.post<ApiParty>(`/party/${id}/transfer/${userId}`),

  updateSettings: (id: string, data: Partial<{ openInvites: boolean; regionLocked: boolean; region: string }>) =>
    http.patch<ApiParty>(`/party/${id}/settings`, data),

  setVoiceState: (id: string, data: { muted?: boolean; deafened?: boolean }) =>
    http.patch<void>(`/party/${id}/voice-state`, data),

  voiceToken: (id: string) => http.get<ApiVoiceToken>(`/party/${id}/voice-token`),
}
