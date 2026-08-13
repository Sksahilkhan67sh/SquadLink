export type PresenceStatus = 'online' | 'in-game' | 'idle' | 'do-not-disturb' | 'offline'

export interface User {
  id: string
  displayName: string
  handle: string
  avatarColor: string
  status: PresenceStatus
  statusText?: string
  currentGame?: string
  bio?: string
  level: number
  bannerAccent: string
  joinDate: string
}

export interface Friend extends User {
  mutualCommunities: number
  lastPlayed?: { game: string; date: string }
  pinned?: boolean
}

export interface FriendRequest {
  id: string
  user: User
  direction: 'incoming' | 'outgoing'
  sentAt: string
  mutualFriends: number
}

export interface Message {
  id: string
  authorId: string
  content: string
  sentAt: string
  editedAt?: string
  status: 'sent' | 'delivered' | 'read'
  attachments?: { id: string; type: 'image' | 'file'; name: string; size?: string }[]
  replyToId?: string
  pinned?: boolean
  reactions?: { emoji: string; count: number; reacted?: boolean }[]
}

export interface Conversation {
  id: string
  type: 'dm' | 'group'
  name: string
  participants: User[]
  messages: Message[]
  unread: number
  muted?: boolean
}

export interface PartyMember {
  user: User
  isLeader?: boolean
  isSpeaking?: boolean
  muted?: boolean
  deafened?: boolean
}

export interface Party {
  id: string
  name: string
  game: string
  members: PartyMember[]
  maxSize: number
  voiceConnected: boolean
  region: string
}

export interface Channel {
  id: string
  name: string
  type: 'text' | 'voice' | 'announcement'
  unread?: number
  memberCount?: number
}

export interface CommunityEvent {
  id: string
  title: string
  date: string
  attendees: number
  game: string
}

export interface Community {
  id: string
  name: string
  tag: string
  memberCount: number
  onlineCount: number
  accent: string
  channelGroups: { name: string; channels: Channel[] }[]
  events: CommunityEvent[]
  announcements: { id: string; title: string; body: string; postedAt: string; author: string }[]
  roles: { id: string; name: string; color: string; memberCount: number; permissions: string[] }[]
}

export interface AppNotification {
  id: string
  type: 'friend-request' | 'party-invite' | 'message' | 'community' | 'system' | 'mention'
  title: string
  body: string
  createdAt: string
  read: boolean
  actor?: User
}

export interface Achievement {
  id: string
  name: string
  description: string
  unlocked: boolean
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}
