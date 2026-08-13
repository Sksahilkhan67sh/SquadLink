// Types mirroring backend DTOs (see backend/src/**/dto and prisma/schema.prisma).
// Kept separate from the app's UI types (src/types) since the wire shape and the
// shape components want to render aren't always identical — adapters in each
// api/*.ts module bridge the two.

export type PresenceStatusApi = 'ONLINE' | 'IN_GAME' | 'IDLE' | 'DO_NOT_DISTURB' | 'OFFLINE'

export interface PaginatedResult<T> {
  items: T[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ApiUserPublic {
  id: string
  handle: string
  displayName: string
  avatarUrl: string | null
  avatarColor: string
  bannerAccent: string
  bio: string | null
  level: number
  status: PresenceStatusApi
  statusText: string | null
  currentGame: string | null
  joinedAt: string
}

export interface ApiUserPrivate extends ApiUserPublic {
  email: string
  emailVerified: boolean
}

export interface ApiAuthUser {
  id: string
  email: string
  handle: string
  displayName: string
  avatarUrl: string | null
  emailVerified: boolean
}

export interface ApiAuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface ApiAuthResponse {
  user: ApiAuthUser
  tokens: ApiAuthTokens
}

export interface ApiFriendRequest {
  id: string
  senderId: string
  receiverId: string
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED'
  createdAt: string
  sender?: ApiUserPublic
  receiver?: ApiUserPublic
}

export interface ApiAttachment {
  id: string
  type: 'IMAGE' | 'FILE'
  url: string
  name: string
  size: number | null
}

export interface ApiReaction {
  emoji: string
  userId: string
}

export interface ApiMessage {
  id: string
  conversationId: string
  authorId: string
  author?: ApiUserPublic
  content: string
  createdAt: string
  editedAt: string | null
  deletedAt: string | null
  replyToId: string | null
  pinned: boolean
  attachments?: ApiAttachment[]
  reactions?: ApiReaction[]
}

export interface ApiConversationParticipant {
  userId: string
  user: ApiUserPublic
  muted: boolean
  lastReadAt: string | null
  joinedAt: string
}

export interface ApiConversation {
  id: string
  type: 'DM' | 'GROUP'
  name: string | null
  participants: ApiConversationParticipant[]
  messages?: ApiMessage[]
  /** Only present on the bulk list endpoint (GET /conversations); absent on getOrCreateDm/createGroup. */
  unread?: number
  createdAt: string
}

export interface ApiPartyMember {
  userId: string
  user: ApiUserPublic
  role: 'LEADER' | 'MEMBER'
  muted: boolean
  deafened: boolean
}

export interface ApiParty {
  id: string
  name: string
  game: string | null
  maxSize: number
  region: string | null
  openInvites: boolean
  members: ApiPartyMember[]
  voiceRoom?: { name: string } | null
  createdAt: string
}

export interface ApiPartyInvite {
  id: string
  partyId: string
  party?: ApiParty
  inviterId: string
  inviteeId: string
  createdAt: string
}

export interface ApiVoiceToken {
  token: string
  url: string
  roomName: string
}

export interface ApiChannel {
  id: string
  name: string
  type: 'TEXT' | 'VOICE' | 'ANNOUNCEMENT'
  position: number
}

export interface ApiChannelGroup {
  id: string
  name: string
  position: number
  channels: ApiChannel[]
}

export interface ApiCommunityRole {
  id: string
  name: string
  color: string
  permissions: string[]
  position: number
}

export interface ApiCommunityMemberRole {
  id: string
  role: ApiCommunityRole
}

export interface ApiCommunityMember {
  userId: string
  user: ApiUserPublic
  roles: ApiCommunityMemberRole[]
  joinedAt: string
}

export interface ApiCommunityEvent {
  id: string
  title: string
  game: string | null
  date: string
}

export interface ApiAnnouncement {
  id: string
  title: string
  body: string
  postedAt: string
  authorId: string
  // The backend doesn't include the author relation on this endpoint —
  // only authorId. Left optional/absent rather than fabricated; resolve
  // against the community member list if a display name is needed.
  author?: ApiUserPublic | null
}

export interface ApiCommunity {
  id: string
  name: string
  tag: string
  iconUrl: string | null
  memberCount: number
  onlineCount?: number
  channelGroups?: ApiChannelGroup[]
  events?: ApiCommunityEvent[]
  announcements?: ApiAnnouncement[]
  roles?: ApiCommunityRole[]
  createdAt: string
}

export interface ApiNotification {
  id: string
  recipientId: string
  actorId: string | null
  actor?: ApiUserPublic | null
  type: 'FRIEND_REQUEST' | 'PARTY_INVITE' | 'MESSAGE' | 'COMMUNITY' | 'SYSTEM' | 'MENTION'
  title: string
  body: string
  read: boolean
  createdAt: string
}

export interface ApiPreferences {
  accentTheme: string
  density: string
  language: string
  inputVolume: number
  outputVolume: number
  noiseSuppression: boolean
  pushToTalk: boolean
  notifyDirectMessage: boolean
  notifyPartyInvite: boolean
  notifyCommunity: boolean
  notifySound: boolean
  showActivityStatus: boolean
  allowFriendRequests: string
}

export interface ApiUpload {
  id: string
  url: string
  mimeType: string
  size: number
}

export interface ApiSearchResults {
  users: ApiUserPublic[]
  communities: ApiCommunity[]
  messages: ApiMessage[]
}
