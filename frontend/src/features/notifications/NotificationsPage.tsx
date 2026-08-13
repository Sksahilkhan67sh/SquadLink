import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Swords, MessageSquare, Compass, Bell, AtSign, Check, Trash2, X } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Skeleton } from '@/components/shared/Skeleton'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { useToast } from '@/components/ui/Toast'
import { notificationsApi } from '@/lib/api/notifications'
import { partyApi, type ApiPartyIncomingInvite } from '@/lib/api/party'
import { notificationToUi } from '@/lib/adapters'
import { useAppData } from '@/lib/realtime/AppDataContext'
import { useVoiceSession } from '@/lib/realtime/VoiceSessionContext'
import { getSocket } from '@/lib/realtime/socket'
import type { AppNotification } from '@/types'
import type { ApiNotification } from '@/lib/api/types'
import { cn, timeAgo } from '@/lib/utils'

const ICONS: Record<AppNotification['type'], React.ElementType> = {
  'friend-request': UserPlus,
  'party-invite': Swords,
  message: MessageSquare,
  community: Compass,
  system: Bell,
  mention: AtSign,
}

const PAGE_SIZE = 20

export function NotificationsPage() {
  const navigate = useNavigate()
  const { refreshUnreadCount } = useAppData()
  const { refreshActiveParty } = useVoiceSession()
  const { push } = useToast()
  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [partyInvites, setPartyInvites] = useState<ApiPartyIncomingInvite[]>([])
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const unread = items.filter((n) => !n.read)

  const loadPartyInvites = useCallback(() => {
    partyApi.incomingInvites().then(setPartyInvites).catch(() => {})
  }, [])

  const load = useCallback(async (reset = true) => {
    setLoading(true)
    setError(null)
    try {
      const res = await notificationsApi.list(reset ? 1 : page + 1, PAGE_SIZE)
      const ui = res.items.map(notificationToUi)
      setItems((prev) => (reset ? ui : [...prev, ...ui]))
      setPage(res.page)
      setHasMore(res.page < res.totalPages)
    } catch {
      setError("Couldn't load notifications.")
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  useEffect(() => {
    load(true)
    loadPartyInvites()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // New notifications arrive live; prepend so the list stays current without a full reload.
  // A fresh party invite means the incoming-invites list needs refreshing too, so the
  // matching Join/Decline buttons show up without the person having to reload the page.
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    const onCreated = (n: ApiNotification) => {
      setItems((prev) => [notificationToUi(n), ...prev])
      if (n.type === 'PARTY_INVITE') loadPartyInvites()
    }
    socket.on('notification:created', onCreated)
    return () => { socket.off('notification:created', onCreated) }
  }, [loadPartyInvites])

  async function markAllRead() {
    const prev = items
    setItems((p) => p.map((n) => ({ ...n, read: true })))
    try {
      await notificationsApi.markAllRead()
      refreshUnreadCount()
    } catch {
      setItems(prev)
    }
  }

  async function markRead(id: string) {
    const prev = items
    setItems((p) => p.map((n) => (n.id === id ? { ...n, read: true } : n)))
    try {
      await notificationsApi.markRead(id)
      refreshUnreadCount()
    } catch {
      setItems(prev)
    }
  }

  async function remove(id: string) {
    const prev = items
    setItems((p) => p.filter((n) => n.id !== id))
    try {
      await notificationsApi.remove(id)
    } catch {
      setItems(prev)
    }
  }

  function findInviteFor(n: AppNotification) {
    if (n.type !== 'party-invite' || !n.actor) return undefined
    return partyInvites.find((inv) => inv.inviterId === n.actor!.id)
  }

  async function respondToPartyInvite(n: AppNotification, accept: boolean) {
    const invite = findInviteFor(n)
    if (!invite) return
    setRespondingId(invite.id)
    try {
      if (accept) {
        await partyApi.acceptInvite(invite.id)
        await refreshActiveParty()
        push({ kind: 'success', title: 'Joined party', description: invite.party?.name })
      } else {
        await partyApi.declineInvite(invite.id)
        push({ kind: 'info', title: 'Invite declined' })
      }
      setPartyInvites((prev) => prev.filter((inv) => inv.id !== invite.id))
      markRead(n.id)
    } catch {
      push({ kind: 'error', title: accept ? "Couldn't join party" : "Couldn't decline invite", description: 'Try again.' })
    } finally {
      setRespondingId(null)
    }
  }

  function route(n: AppNotification) {
    if (!n.read) markRead(n.id)
    if (n.type === 'friend-request') navigate('/friends?tab=pending')
    else if (n.type === 'party-invite') navigate('/party')
    else if (n.type === 'message' || n.type === 'mention') navigate('/messages')
    else if (n.type === 'community') navigate('/communities')
  }

  const list = (data: AppNotification[]) =>
    data.length === 0 && !loading ? (
      <EmptyState icon={<Bell className="size-6" />} title="Nothing here" description="You're all caught up." />
    ) : (
      <div className="flex flex-col gap-2">
        {data.map((n) => {
          const Icon = ICONS[n.type]
          const invite = findInviteFor(n)
          return (
            <div
              key={n.id}
              className={cn(
                'bevel-md group flex items-start gap-3.5 border border-border p-4 transition-colors',
                n.read ? 'bg-surface' : 'bg-orange-500/[0.04] border-orange-500/20',
              )}
            >
              {n.actor ? (
                <Avatar name={n.actor.displayName} color={n.actor.avatarColor} size="md" />
              ) : (
                <div className="flex size-10 items-center justify-center rounded-full bg-surface-3 text-orange-500"><Icon className="size-[18px]" /></div>
              )}
              <button onClick={() => route(n)} className="focus-ring min-w-0 flex-1 text-left">
                <p className="text-sm font-semibold text-steel-100">{n.title}</p>
                <p className="mt-0.5 text-sm text-steel-500">{n.body}</p>
                <p className="mt-1.5 text-xs text-steel-600">{timeAgo(n.createdAt)} ago</p>
              </button>

              {invite ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button size="sm" variant="secondary" loading={respondingId === invite.id} onClick={() => respondToPartyInvite(n, true)}>
                    Join
                  </Button>
                  <button
                    onClick={() => respondToPartyInvite(n, false)}
                    disabled={respondingId === invite.id}
                    className="focus-ring flex size-8 items-center justify-center rounded-sm text-steel-500 hover:bg-danger/20 hover:text-[#ff8570] disabled:opacity-50"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {!n.read && (
                    <button onClick={() => markRead(n.id)} className="focus-ring flex size-8 items-center justify-center rounded-sm text-steel-500 hover:bg-surface-3 hover:text-success">
                      <Check className="size-4" />
                    </button>
                  )}
                  <button onClick={() => remove(n.id)} className="focus-ring flex size-8 items-center justify-center rounded-sm text-steel-500 hover:bg-surface-3 hover:text-[#ff8570]">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              )}
              {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-orange-500" />}
            </div>
          )
        })}
        {loading && <><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></>}
      </div>
    )

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <PageHeader
        title="Notifications"
        description={`${unread.length} unread`}
        actions={unread.length > 0 ? <Button variant="outline" onClick={markAllRead}>Mark all read</Button> : undefined}
      />
      {error ? (
        <ErrorState message={error} onRetry={() => load(true)} />
      ) : (
        <Tabs defaultValue="all">
          <TabsList className="mb-5">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
            <TabsTrigger value="mentions">Mentions</TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            {list(items)}
            {hasMore && !loading && (
              <Button variant="ghost" size="sm" className="mt-3 w-full justify-center" onClick={() => load(false)}>Load more</Button>
            )}
          </TabsContent>
          <TabsContent value="unread">{list(unread)}</TabsContent>
          <TabsContent value="mentions">{list(items.filter((n) => n.type === 'mention'))}</TabsContent>
        </Tabs>
      )}
    </div>
  )
}
