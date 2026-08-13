import { useNavigate } from 'react-router-dom'
import { Swords, MessageSquare, Compass, UserPlus, Mic, ChevronRight, Bell } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/shared/Skeleton'
import { ErrorState } from '@/components/shared/ErrorState'
import { useAppData } from '@/lib/realtime/AppDataContext'
import { useVoiceSession } from '@/lib/realtime/VoiceSessionContext'
import { useAuth } from '@/lib/auth/AuthContext'
import { useApiData } from '@/lib/hooks/useApiData'
import { friendsApi } from '@/lib/api/friends'
import { messagesApi } from '@/lib/api/messages'
import { notificationsApi } from '@/lib/api/notifications'
import { friendToUi, conversationToUi } from '@/lib/adapters'
import { communityAccent } from '@/lib/color'
import { timeAgo } from '@/lib/utils'

const QUICK_ACTIONS = [
  { label: 'Create Party', icon: Swords, to: '/party' },
  { label: 'Start Voice', icon: Mic, to: '/voice' },
  { label: 'Invite Friend', icon: UserPlus, to: '/friends?tab=add' },
  { label: 'Open Community', icon: Compass, to: '/communities' },
]

export function HomePage() {
  const navigate = useNavigate()
  const { profile, communities } = useAppData()
  const { user } = useAuth()
  const { activeParty } = useVoiceSession()

  const friendsState = useApiData(() => friendsApi.list(), [])
  const conversationsState = useApiData(() => messagesApi.listConversations(), [])
  const notificationsState = useApiData(() => notificationsApi.list(1, 5), [])

  const online =
    friendsState.status === 'success' || friendsState.status === 'empty'
      ? friendsState.data.map(friendToUi).filter((f) => f.status !== 'offline')
      : []
  const unreadNotifs =
    notificationsState.status === 'success' || notificationsState.status === 'empty'
      ? notificationsState.data.items.filter((n) => !n.read)
      : []

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <PageHeader
        title={`Welcome back${profile ? `, ${profile.displayName.split(' ')[0]}` : ''}`}
        description="Here's what your squad is up to."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {QUICK_ACTIONS.map(({ label, icon: Icon, to }) => (
          <button
            key={label}
            onClick={() => navigate(to)}
            className="bevel-md focus-ring group flex items-center gap-3 border border-border bg-surface p-4 text-left transition-colors hover:border-orange-500/40 hover:bg-surface-2"
          >
            <span className="bevel-sm flex size-10 items-center justify-center bg-orange-500/12 text-orange-500 transition-colors group-hover:bg-orange-500 group-hover:text-black">
              <Icon className="size-[18px]" />
            </span>
            <span className="text-sm font-semibold text-steel-100">{label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          {activeParty && (
            <Card>
              <CardHeader>
                <CardTitle>Current Party</CardTitle>
                {activeParty.game && <Badge variant="orange">{activeParty.game}</Badge>}
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-steel-100">{activeParty.name}</p>
                    <p className="text-xs text-steel-500">
                      {activeParty.members.length}/{activeParty.maxSize} members{activeParty.region ? ` · ${activeParty.region}` : ''}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => navigate('/voice')}>Join Voice</Button>
                </div>
                <div className="flex flex-wrap gap-3">
                  {activeParty.members.map((m) => (
                    <div key={m.userId} className="flex items-center gap-2 rounded-sm bg-surface-2 py-1.5 pl-1.5 pr-3">
                      <Avatar name={m.user.displayName} color={m.user.avatarColor} size="xs" />
                      <span className="text-xs font-medium text-steel-200">{m.user.displayName.split(' ')[0]}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Recent Messages</CardTitle>
              <button onClick={() => navigate('/messages')} className="focus-ring flex items-center gap-1 text-xs font-semibold text-steel-500 hover:text-orange-400">
                View all <ChevronRight className="size-3.5" />
              </button>
            </CardHeader>
            <CardContent className="p-0">
              {conversationsState.status === 'loading' && (
                <div className="flex flex-col gap-3 p-5">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              )}
              {conversationsState.status === 'error' && <ErrorState message={conversationsState.error} onRetry={conversationsState.retry} />}
              {conversationsState.status === 'empty' && <p className="p-5 text-sm text-steel-600">No conversations yet.</p>}
              {(conversationsState.status === 'success' || conversationsState.status === 'empty') && conversationsState.data && (
                <div className="divide-y divide-border">
                  {conversationsState.data.slice(0, 4).map((raw) => {
                    const c = conversationToUi(raw, user?.id ?? '')
                    const other = c.participants.find((p) => p.id !== user?.id) ?? c.participants[0]
                    const lastMessage = c.messages[0]
                    return (
                      <button
                        key={c.id}
                        onClick={() => navigate(`/messages?c=${c.id}`)}
                        className="focus-ring flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-surface-2"
                      >
                        <Avatar name={other?.displayName ?? c.name ?? '?'} color={other?.avatarColor ?? '#f2691c'} status={c.type === 'dm' && other ? other.status : undefined} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-steel-100">{c.name ?? other?.displayName}</p>
                            {c.type === 'group' && <MessageSquare className="size-3 text-steel-600" />}
                          </div>
                          <p className="truncate text-xs text-steel-500">{lastMessage?.content ?? 'No messages yet'}</p>
                        </div>
                        {c.unread > 0 && <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-black">{c.unread}</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Friends Online</CardTitle>
              <Badge variant="success">{online.length}</Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {friendsState.status === 'loading' && (
                <>
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </>
              )}
              {friendsState.status === 'error' && <ErrorState message={friendsState.error} onRetry={friendsState.retry} />}
              {online.length === 0 && (friendsState.status === 'success' || friendsState.status === 'empty') && (
                <p className="text-sm text-steel-600">No friends online right now.</p>
              )}
              {online.slice(0, 6).map((f) => (
                <button key={f.id} onClick={() => navigate('/friends')} className="focus-ring flex w-full items-center gap-3 text-left hover:opacity-80">
                  <Avatar name={f.displayName} color={f.avatarColor} status={f.status} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-steel-100">{f.displayName}</p>
                    <p className="truncate text-xs text-steel-500">{f.currentGame ?? f.statusText ?? 'Online'}</p>
                  </div>
                </button>
              ))}
              <Button variant="ghost" size="sm" className="mt-1 justify-center" onClick={() => navigate('/friends')}>
                See all friends
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Communities</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              {communities.length === 0 && <p className="text-sm text-steel-600">You haven't joined any communities yet.</p>}
              {communities.map((c) => (
                <button key={c.id} onClick={() => navigate(`/communities/${c.id}`)} className="focus-ring flex w-full items-center gap-3 text-left hover:opacity-80">
                  <span className="bevel-sm flex size-9 shrink-0 items-center justify-center text-xs font-display font-bold text-black" style={{ backgroundColor: communityAccent(c.id) }}>
                    {c.tag.slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-steel-100">{c.name}</p>
                    <p className="text-xs text-steel-500">{c.memberCount.toLocaleString()} members</p>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <Bell className="size-4 text-steel-500" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {notificationsState.status === 'loading' && <Skeleton className="h-10 w-full" />}
              {notificationsState.status === 'error' && <ErrorState message={notificationsState.error} onRetry={notificationsState.retry} />}
              {unreadNotifs.slice(0, 3).map((n) => (
                <div key={n.id} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-orange-500" />
                  <p className="text-steel-300">{n.body}</p>
                  <span className="ml-auto shrink-0 text-xs text-steel-600">{timeAgo(n.createdAt)}</span>
                </div>
              ))}
              {(notificationsState.status === 'success' || notificationsState.status === 'empty') && unreadNotifs.length === 0 && (
                <p className="text-sm text-steel-600">You're all caught up.</p>
              )}
              <Button variant="ghost" size="sm" className="mt-1 justify-center" onClick={() => navigate('/notifications')}>
                View all
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
