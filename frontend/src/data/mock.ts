import type {
  User, Friend, FriendRequest, Conversation, Party, Community,
  AppNotification, Achievement, Message,
} from '@/types'

const ACCENTS = ['#f2691c', '#9aa0a8', '#5fb87a', '#e0a53a', '#8a8fc9', '#e0503a']
const colorFor = (seed: number) => ACCENTS[seed % ACCENTS.length]

export const currentUser: User = {
  id: 'me',
  displayName: 'Roshan Verk',
  handle: 'roshanv',
  avatarColor: '#f2691c',
  status: 'online',
  statusText: 'Grinding ranked',
  currentGame: 'Valorant',
  bio: 'Full-stack dev by day, IGL by night. NA-East. Main: Duelist.',
  level: 47,
  bannerAccent: '#f2691c',
  joinDate: '2023-02-11',
}

const NAMES = [
  'Ava Chen', 'Marcus Reed', 'Priya Nair', 'Diego Ruiz', 'Lena Volkov',
  'Kofi Mensah', 'Sana Malik', 'Jonas Weber', 'Yuki Tanaka', 'Theo Brandt',
  'Nadia Farouk', 'Owen Clarke', 'Mei Lin', 'Rafael Costa', 'Ines Dubois',
  'Sam Okafor', 'Petra Novak', 'Wes Griggs', 'Amara Boateng', 'Liam Foster',
]

const GAMES = ['Valorant', 'Apex Legends', 'League of Legends', 'Fortnite', 'CS2', 'Overwatch 2', 'Rocket League']
const STATUSES: User['status'][] = ['online', 'in-game', 'idle', 'do-not-disturb', 'offline']

function makeUser(i: number): User {
  const status = STATUSES[i % STATUSES.length]
  return {
    id: `u${i}`,
    displayName: NAMES[i % NAMES.length],
    handle: NAMES[i % NAMES.length].toLowerCase().replace(' ', '') + (i > NAMES.length ? i : ''),
    avatarColor: colorFor(i),
    status,
    statusText: status === 'in-game' ? 'In a match' : status === 'idle' ? 'Away' : undefined,
    currentGame: status === 'in-game' || status === 'online' ? GAMES[i % GAMES.length] : undefined,
    level: 5 + ((i * 7) % 90),
    bannerAccent: colorFor(i + 2),
    joinDate: `202${2 + (i % 3)}-0${1 + (i % 9)}-1${i % 9}`,
    bio: 'Here for the squad, staying for the wins.',
  }
}

export const friends: Friend[] = Array.from({ length: 18 }, (_, i) => {
  const u = makeUser(i)
  return {
    ...u,
    mutualCommunities: 1 + (i % 5),
    lastPlayed: { game: GAMES[i % GAMES.length], date: `2026-08-0${1 + (i % 7)}T18:30:00Z` },
    pinned: i < 3,
  }
})

export const friendRequests: FriendRequest[] = [
  { id: 'fr1', user: makeUser(20), direction: 'incoming', sentAt: '2026-08-06T14:00:00Z', mutualFriends: 4 },
  { id: 'fr2', user: makeUser(21), direction: 'incoming', sentAt: '2026-08-05T09:12:00Z', mutualFriends: 1 },
  { id: 'fr3', user: makeUser(22), direction: 'outgoing', sentAt: '2026-08-04T20:45:00Z', mutualFriends: 7 },
]

function makeMessages(participants: User[], count: number): Message[] {
  const lines = [
    "yo you up for a game tonight?", "gg that was close", "clip that last round 😂",
    "check the party settings, I updated the region", "one sec, grabbing a drink",
    "who's on vc?", "new patch dropped, buffs to duelists", "same time as usual?",
    "carried ngl", "brb reconnecting", "let's run it back", "invite sent",
  ]
  return Array.from({ length: count }, (_, i) => {
    const author = i % 3 === 0 ? currentUser : participants[i % participants.length]
    return {
      id: `m${participants[0]?.id ?? 'x'}-${i}`,
      authorId: author.id,
      content: lines[i % lines.length],
      sentAt: new Date(Date.now() - (count - i) * 1000 * 60 * 26).toISOString(),
      status: 'read',
      pinned: i === 2,
      reactions: i % 5 === 0 ? [{ emoji: '🔥', count: 2, reacted: true }] : undefined,
    } as Message
  })
}

export const conversations: Conversation[] = [
  {
    id: 'c1', type: 'dm', name: friends[0].displayName, participants: [friends[0]],
    messages: makeMessages([friends[0]], 14), unread: 2,
  },
  {
    id: 'c2', type: 'group', name: 'Ranked Squad', participants: [friends[1], friends[2], friends[3]],
    messages: makeMessages([friends[1], friends[2], friends[3]], 9), unread: 0,
  },
  {
    id: 'c3', type: 'dm', name: friends[4].displayName, participants: [friends[4]],
    messages: makeMessages([friends[4]], 6), unread: 0, muted: true,
  },
  {
    id: 'c4', type: 'dm', name: friends[5].displayName, participants: [friends[5]],
    messages: makeMessages([friends[5]], 3), unread: 5,
  },
  {
    id: 'c5', type: 'group', name: 'Weekend Warriors', participants: [friends[6], friends[7]],
    messages: makeMessages([friends[6], friends[7]], 20), unread: 0,
  },
]

export const activeParty: Party = {
  id: 'p1',
  name: "Roshan's Party",
  game: 'Valorant',
  region: 'NA East',
  maxSize: 5,
  voiceConnected: true,
  members: [
    { user: currentUser, isLeader: true, isSpeaking: true },
    { user: friends[0], isSpeaking: false },
    { user: friends[1], muted: true },
    { user: friends[2], isSpeaking: true },
  ],
}

export const communities: Community[] = [
  {
    id: 'com1', name: 'Ascendant Collective', tag: 'ASND', memberCount: 4218, onlineCount: 612, accent: '#f2691c',
    channelGroups: [
      { name: 'Info', channels: [
        { id: 'ch1', name: 'welcome', type: 'announcement' },
        { id: 'ch2', name: 'announcements', type: 'announcement', unread: 1 },
      ]},
      { name: 'Text', channels: [
        { id: 'ch3', name: 'general', type: 'text', unread: 12 },
        { id: 'ch4', name: 'clips-and-highlights', type: 'text' },
        { id: 'ch5', name: 'looking-for-group', type: 'text', unread: 3 },
      ]},
      { name: 'Voice', channels: [
        { id: 'ch6', name: 'Main Lobby', type: 'voice', memberCount: 8 },
        { id: 'ch7', name: 'Ranked Grind', type: 'voice', memberCount: 3 },
        { id: 'ch8', name: 'Chill Zone', type: 'voice', memberCount: 0 },
      ]},
    ],
    events: [
      { id: 'ev1', title: 'Ranked Night — 5-stack scrims', date: '2026-08-09T19:00:00Z', attendees: 24, game: 'Valorant' },
      { id: 'ev2', title: 'Community Tournament: Round 1', date: '2026-08-14T17:00:00Z', attendees: 63, game: 'Apex Legends' },
    ],
    announcements: [
      { id: 'an1', title: 'Season 3 kicks off Friday', body: 'New ranked season, new rewards track, and a refreshed map rotation land Friday at reset.', postedAt: '2026-08-06T12:00:00Z', author: 'Mods' },
      { id: 'an2', title: 'Voice server maintenance', body: 'Ranked Grind and Chill Zone will be briefly unavailable Thursday 3–4am for upgrades.', postedAt: '2026-08-04T08:00:00Z', author: 'Admin' },
    ],
    roles: [
      { id: 'r1', name: 'Founder', color: '#f2691c', memberCount: 1, permissions: ['Administrator'] },
      { id: 'r2', name: 'Moderator', color: '#5fb87a', memberCount: 6, permissions: ['Manage Messages', 'Kick Members', 'Manage Channels'] },
      { id: 'r3', name: 'Verified', color: '#9aa0a8', memberCount: 4211, permissions: ['Send Messages', 'Join Voice'] },
    ],
  },
  {
    id: 'com2', name: 'Late Night Lobby', tag: 'LNL', memberCount: 892, onlineCount: 74, accent: '#9aa0a8',
    channelGroups: [
      { name: 'Text', channels: [{ id: 'ch9', name: 'general', type: 'text' }, { id: 'ch10', name: 'memes', type: 'text', unread: 7 }] },
      { name: 'Voice', channels: [{ id: 'ch11', name: 'Late Night VC', type: 'voice', memberCount: 5 }] },
    ],
    events: [],
    announcements: [],
    roles: [{ id: 'r4', name: 'Member', color: '#9aa0a8', memberCount: 892, permissions: ['Send Messages'] }],
  },
]

export const notifications: AppNotification[] = [
  { id: 'n1', type: 'party-invite', title: 'Party invite', body: 'Ava Chen invited you to join their party.', createdAt: '2026-08-07T07:40:00Z', read: false, actor: friends[0] },
  { id: 'n2', type: 'friend-request', title: 'Friend request', body: 'Rafael Costa sent you a friend request.', createdAt: '2026-08-07T06:10:00Z', read: false, actor: friends[13] },
  { id: 'n3', type: 'mention', title: 'Mentioned in #general', body: '"@roshanv what time works for scrims?"', createdAt: '2026-08-06T22:05:00Z', read: false, actor: friends[3] },
  { id: 'n4', type: 'community', title: 'Ascendant Collective', body: 'New event: Community Tournament — Round 1.', createdAt: '2026-08-06T18:00:00Z', read: true },
  { id: 'n5', type: 'message', title: 'New message', body: 'Kofi Mensah: gg that was close', createdAt: '2026-08-06T15:22:00Z', read: true, actor: friends[5] },
  { id: 'n6', type: 'system', title: 'App updated', body: 'SquadLink 2.4.0 is installed with voice quality improvements.', createdAt: '2026-08-05T09:00:00Z', read: true },
]

export const achievements: Achievement[] = [
  { id: 'a1', name: 'First Squad', description: 'Formed your first party of 4+', unlocked: true, rarity: 'common' },
  { id: 'a2', name: 'Night Owl', description: 'Online past 2am five nights running', unlocked: true, rarity: 'rare' },
  { id: 'a3', name: 'Community Builder', description: 'Joined 10 communities', unlocked: true, rarity: 'rare' },
  { id: 'a4', name: 'Clutch Caller', description: 'Called the winning strat in a ranked match', unlocked: false, rarity: 'epic' },
  { id: 'a5', name: 'Legend of the Lobby', description: 'Top of the leaderboard three seasons straight', unlocked: false, rarity: 'legendary' },
  { id: 'a6', name: 'Always On Comms', description: '500 hours in voice channels', unlocked: true, rarity: 'epic' },
]

export const recentActivity = [
  { id: 'act1', text: 'You finished a Valorant match — Victory, 13–8', at: '2026-08-07T07:10:00Z' },
  { id: 'act2', text: 'Ava Chen started streaming Apex Legends', at: '2026-08-07T06:45:00Z' },
  { id: 'act3', text: 'You joined Ascendant Collective', at: '2026-08-06T21:00:00Z' },
  { id: 'act4', text: 'Kofi Mensah reached Level 60', at: '2026-08-06T19:30:00Z' },
]

export const allUsers: User[] = [currentUser, ...friends]
