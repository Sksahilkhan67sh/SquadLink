import { http } from './http'
import type {
  ApiAnnouncement,
  ApiChannel,
  ApiChannelGroup,
  ApiCommunity,
  ApiCommunityEvent,
  ApiCommunityMember,
  ApiCommunityRole,
} from './types'

/**
 * The backend returns the raw Prisma `Community` row plus a Prisma-style
 * `_count: { members: number }` (see CommunitiesRepository's
 * `communityInclude`) rather than a flat `memberCount` field. Normalizing
 * it once here — instead of in every page component — means `ApiCommunity`
 * can stay the clean shape the UI actually wants.
 */
interface RawCommunity extends Omit<ApiCommunity, 'memberCount'> {
  _count?: { members: number }
}

function normalizeCommunity(raw: RawCommunity): ApiCommunity {
  const { _count, ...rest } = raw
  return { ...rest, memberCount: _count?.members ?? 0 }
}

export const communitiesApi = {
  listMine: () => http.get<RawCommunity[]>('/communities').then((list) => list.map(normalizeCommunity)),

  browse: (query?: string) =>
    http.get<RawCommunity[]>('/communities/browse', { q: query }).then((list) => list.map(normalizeCommunity)),

  create: (name: string, tag: string) =>
    http.post<RawCommunity>('/communities', { name, tag }).then(normalizeCommunity),

  get: (id: string) => http.get<RawCommunity>(`/communities/${id}`).then(normalizeCommunity),

  update: (id: string, data: Partial<{ name: string; tag: string }>) =>
    http.patch<RawCommunity>(`/communities/${id}`, data).then(normalizeCommunity),

  remove: (id: string) => http.delete<void>(`/communities/${id}`),

  join: (id: string) => http.post<RawCommunity>(`/communities/${id}/join`).then(normalizeCommunity),

  leave: (id: string) => http.post<void>(`/communities/${id}/leave`),

  listMembers: (id: string) => http.get<ApiCommunityMember[]>(`/communities/${id}/members`),

  kickMember: (id: string, userId: string) => http.delete<void>(`/communities/${id}/members/${userId}`),

  createChannelGroup: (id: string, name: string, position?: number) =>
    http.post<ApiChannelGroup>(`/communities/${id}/channel-groups`, { name, position }),

  createChannel: (id: string, groupId: string, name: string, type: 'TEXT' | 'VOICE' | 'ANNOUNCEMENT', position?: number) =>
    http.post<ApiChannel>(`/communities/${id}/channel-groups/${groupId}/channels`, { name, type, position }),

  deleteChannel: (id: string, channelId: string) => http.delete<void>(`/communities/${id}/channels/${channelId}`),

  createRole: (id: string, name: string, color: string, permissions: string[], position?: number) =>
    http.post<ApiCommunityRole>(`/communities/${id}/roles`, { name, color, permissions, position }),

  deleteRole: (id: string, roleId: string) => http.delete<void>(`/communities/${id}/roles/${roleId}`),

  assignRole: (id: string, userId: string, roleId: string) =>
    http.post<void>(`/communities/${id}/members/${userId}/roles/${roleId}`),

  unassignRole: (id: string, userId: string, roleId: string) =>
    http.delete<void>(`/communities/${id}/members/${userId}/roles/${roleId}`),

  listEvents: (id: string) => http.get<ApiCommunityEvent[]>(`/communities/${id}/events`),

  createEvent: (id: string, title: string, date: string, game?: string) =>
    http.post<ApiCommunityEvent>(`/communities/${id}/events`, { title, date, game }),

  listAnnouncements: (id: string) => http.get<ApiAnnouncement[]>(`/communities/${id}/announcements`),

  createAnnouncement: (id: string, title: string, body: string) =>
    http.post<ApiAnnouncement>(`/communities/${id}/announcements`, { title, body }),
}
