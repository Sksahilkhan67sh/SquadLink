import type { PresenceStatusApi, ApiUserPublic, ApiMessage, ApiAttachment, ApiConversation, ApiNotification } from './api/types'
import type { ApiFriendEntry } from './api/friends'
import type { PresenceStatus, User, Message, Conversation, Friend, AppNotification } from '@/types'

const PRESENCE_MAP: Record<PresenceStatusApi, PresenceStatus> = {
  ONLINE: 'online',
  IN_GAME: 'in-game',
  IDLE: 'idle',
  DO_NOT_DISTURB: 'do-not-disturb',
  OFFLINE: 'offline',
}

export function presenceToUi(status: PresenceStatusApi): PresenceStatus {
  return PRESENCE_MAP[status] ?? 'offline'
}

/** Deterministic accent color from a user id — the backend doesn't store a per-user accent beyond avatarColor, which this prefers when set. */
const ACCENTS = ['#f2691c', '#9aa0a8', '#5fb87a', '#e0a53a', '#8a8fc9', '#e0503a']
function fallbackAccent(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return ACCENTS[hash % ACCENTS.length]
}

export function userToUi(u: ApiUserPublic): User {
  return {
    id: u.id,
    displayName: u.displayName,
    handle: u.handle,
    avatarColor: u.avatarColor || fallbackAccent(u.id),
    status: presenceToUi(u.status),
    statusText: u.statusText ?? undefined,
    currentGame: u.currentGame ?? undefined,
    bio: u.bio ?? undefined,
    level: u.level,
    bannerAccent: u.bannerAccent || fallbackAccent(u.id + 'banner'),
    joinDate: u.joinedAt,
  }
}

function attachmentToUi(a: ApiAttachment): NonNullable<Message['attachments']>[number] {
  return {
    id: a.id,
    type: a.type === 'IMAGE' ? 'image' : 'file',
    name: a.name,
    size: a.size ? `${Math.round(a.size / 1024)} KB` : undefined,
  }
}

export function messageToUi(m: ApiMessage, currentUserId: string): Message {
  const reactionCounts = new Map<string, { count: number; reacted: boolean }>()
  for (const r of m.reactions ?? []) {
    const existing = reactionCounts.get(r.emoji) ?? { count: 0, reacted: false }
    existing.count += 1
    if (r.userId === currentUserId) existing.reacted = true
    reactionCounts.set(r.emoji, existing)
  }

  return {
    id: m.id,
    authorId: m.authorId,
    content: m.content,
    sentAt: m.createdAt,
    editedAt: m.editedAt ?? undefined,
    status: 'sent',
    attachments: m.attachments?.map(attachmentToUi),
    replyToId: m.replyToId ?? undefined,
    pinned: m.pinned,
    reactions: Array.from(reactionCounts.entries()).map(([emoji, v]) => ({ emoji, count: v.count, reacted: v.reacted })),
  }
}

export function conversationToUi(c: ApiConversation, currentUserId: string): Conversation {
  const lastMessage = c.messages?.[0]
  const mine = c.participants.find((p) => p.userId === currentUserId)
  return {
    id: c.id,
    type: c.type === 'DM' ? 'dm' : 'group',
    name: c.name ?? c.participants.filter((p) => p.userId !== currentUserId).map((p) => p.user.displayName).join(', '),
    participants: c.participants.map((p) => userToUi(p.user)),
    messages: lastMessage ? [messageToUi(lastMessage, currentUserId)] : [],
    unread: c.unread ?? 0,
    muted: mine?.muted ?? false,
  }
}

export function friendToUi(entry: ApiFriendEntry): Friend {
  return {
    ...userToUi(entry.friend),
    pinned: entry.pinned,
    // The backend doesn't expose per-friend "mutual communities" or "last
    // played" history endpoints, so these are honestly zero/absent rather
    // than fabricated — see FriendsPage integration notes.
    mutualCommunities: 0,
  }
}

const NOTIFICATION_TYPE_MAP: Record<ApiNotification['type'], AppNotification['type']> = {
  FRIEND_REQUEST: 'friend-request',
  PARTY_INVITE: 'party-invite',
  MESSAGE: 'message',
  COMMUNITY: 'community',
  SYSTEM: 'system',
  MENTION: 'mention',
}

export function notificationToUi(n: ApiNotification): AppNotification {
  return {
    id: n.id,
    type: NOTIFICATION_TYPE_MAP[n.type] ?? 'system',
    title: n.title,
    body: n.body,
    createdAt: n.createdAt,
    read: n.read,
    actor: n.actor ? userToUi(n.actor) : undefined,
  }
}
