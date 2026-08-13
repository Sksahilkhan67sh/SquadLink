import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, MessageSquare, Check, X, UserPlus, Send, Pin } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Skeleton } from '@/components/shared/Skeleton'
import { ErrorState } from '@/components/shared/ErrorState'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { ContextMenu } from '@/components/ui/ContextMenu'
import { useToast } from '@/components/ui/Toast'
import { friendsApi, type ApiFriendEntry } from '@/lib/api/friends'
import { messagesApi } from '@/lib/api/messages'
import { useApiData } from '@/lib/hooks/useApiData'
import { friendToUi } from '@/lib/adapters'
import { ApiError } from '@/lib/api/http'
import type { Friend } from '@/types'
import { FriendProfileModal } from './FriendProfileModal'

export function FriendsPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { push } = useToast()
  const [tab, setTab] = useState(params.get('tab') === 'add' ? 'add' : 'all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Friend | null>(null)
  const [addHandle, setAddHandle] = useState('')
  const [sending, setSending] = useState(false)

  const friendsState = useApiData(() => friendsApi.list(), [])
  const incomingState = useApiData(() => friendsApi.incomingRequests(), [])
  const outgoingState = useApiData(() => friendsApi.outgoingRequests(), [])

  const [friendsList, setFriendsList] = useState<ApiFriendEntry[]>([])
  useEffect(() => {
    if (friendsState.status === 'success' || friendsState.status === 'empty') {
      setFriendsList(friendsState.data)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendsState.status])

  const filtered = useMemo(
    () =>
      friendsList
        .filter((entry) => entry.friend.displayName.toLowerCase().includes(query.toLowerCase()))
        .map(friendToUi),
    [friendsList, query],
  )
  const online = filtered.filter((f) => f.status !== 'offline')
  const pinned = filtered.filter((f) => f.pinned)
  const incoming = incomingState.status === 'success' || incomingState.status === 'empty' ? incomingState.data : []
  const outgoing = outgoingState.status === 'success' || outgoingState.status === 'empty' ? outgoingState.data : []

  const removeFriend = useCallback(
    async (f: Friend) => {
      const prev = friendsList
      setFriendsList((p) => p.filter((entry) => entry.friend.id !== f.id))
      setSelected(null)
      try {
        await friendsApi.remove(f.id)
        push({ kind: 'success', title: 'Friend removed', description: `${f.displayName} was removed from your friends.` })
      } catch {
        setFriendsList(prev)
        push({ kind: 'error', title: "Couldn't remove friend", description: 'Try again.' })
      }
    },
    [friendsList, push],
  )

  async function sendRequest() {
    const handle = addHandle.trim().replace(/^@/, '')
    if (!handle) return
    setSending(true)
    try {
      await friendsApi.sendRequest(handle)
      push({ kind: 'success', title: 'Friend request sent', description: `Sent to @${handle}` })
      setAddHandle('')
      outgoingState.retry()
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        push({ kind: 'error', title: 'User not found', description: `No SquadLink user with handle @${handle}.` })
      } else if (err instanceof ApiError && err.status === 409) {
        push({ kind: 'error', title: 'Already sent', description: 'You already have a pending request or are already friends.' })
      } else {
        push({ kind: 'error', title: "Couldn't send request", description: 'Try again.' })
      }
    } finally {
      setSending(false)
    }
  }

  async function acceptRequest(id: string, name: string) {
    try {
      await friendsApi.acceptRequest(id)
      push({ kind: 'success', title: 'Friend added', description: `You and ${name} are now friends.` })
      incomingState.retry()
      friendsState.retry()
    } catch {
      push({ kind: 'error', title: "Couldn't accept request", description: 'Try again.' })
    }
  }

  async function declineRequest(id: string) {
    try {
      await friendsApi.declineRequest(id)
      push({ kind: 'info', title: 'Request declined' })
      incomingState.retry()
    } catch {
      push({ kind: 'error', title: "Couldn't decline request", description: 'Try again.' })
    }
  }

  async function cancelRequest(id: string) {
    try {
      await friendsApi.cancelRequest(id)
      push({ kind: 'info', title: 'Request cancelled' })
      outgoingState.retry()
    } catch {
      push({ kind: 'error', title: "Couldn't cancel request", description: 'Try again.' })
    }
  }

  async function openDm(f: Friend) {
    try {
      const convo = await messagesApi.getOrCreateDm(f.id)
      navigate(`/messages?c=${convo.id}`)
    } catch {
      push({ kind: 'error', title: "Couldn't open conversation", description: 'Try again.' })
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <PageHeader
        title="Friends"
        description={`${friendsList.length} total · ${online.length} online`}
        actions={<Button onClick={() => setTab('add')}><UserPlus className="size-4" /> Add Friend</Button>}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-5">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="online">Online</TabsTrigger>
          <TabsTrigger value="pending">Pending {incoming.length > 0 && <Badge variant="orange" className="ml-1.5">{incoming.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="add">Add Friend</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <FriendSearchBar query={query} setQuery={setQuery} />
          {friendsState.status === 'loading' && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          )}
          {friendsState.status === 'error' && <ErrorState message={friendsState.error} onRetry={friendsState.retry} />}
          {(friendsState.status === 'success' || friendsState.status === 'empty') && (
            <>
              {pinned.length > 0 && (
                <div className="mb-5">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-steel-600"><Pin className="size-3" /> Pinned</p>
                  <FriendGrid list={pinned} onOpen={setSelected} onMessage={openDm} />
                </div>
              )}
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-steel-600">All Friends — {filtered.length}</p>
              {filtered.length === 0 ? (
                <EmptyState icon={<Search className="size-6" />} title="No friends found" description={query ? 'Try a different search term.' : 'Send a friend request to get started.'} />
              ) : (
                <FriendGrid list={filtered} onOpen={setSelected} onMessage={openDm} onRemove={removeFriend} />
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="online">
          <FriendSearchBar query={query} setQuery={setQuery} />
          {online.length === 0 ? (
            <EmptyState icon={<Search className="size-6" />} title="No one's online" description="Check back later, or send an invite." />
          ) : (
            <FriendGrid list={online} onOpen={setSelected} onMessage={openDm} onRemove={removeFriend} />
          )}
        </TabsContent>

        <TabsContent value="pending">
          <div className="flex flex-col gap-6">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-steel-600">Incoming — {incoming.length}</p>
              {incomingState.status === 'loading' && <Skeleton className="h-14 w-full" />}
              {incomingState.status === 'error' && <ErrorState message={incomingState.error} onRetry={incomingState.retry} />}
              {(incomingState.status === 'success' || incomingState.status === 'empty') && incoming.length === 0 ? (
                <p className="text-sm text-steel-600">No incoming requests.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {incoming.map((r) => {
                    const name = r.sender?.displayName ?? 'Unknown user'
                    return (
                      <div key={r.id} className="bevel-md flex items-center gap-3 border border-border bg-surface p-3.5">
                        <Avatar name={name} color={r.sender?.avatarColor ?? '#f2691c'} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-steel-100">{name}</p>
                          {r.sender && <p className="text-xs text-steel-500">@{r.sender.handle}</p>}
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => acceptRequest(r.id, name)}>
                          <Check className="size-4" /> Accept
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => declineRequest(r.id)}>
                          <X className="size-4" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-steel-600">Outgoing — {outgoing.length}</p>
              {outgoingState.status === 'loading' && <Skeleton className="h-14 w-full" />}
              {(outgoingState.status === 'success' || outgoingState.status === 'empty') && outgoing.length === 0 ? (
                <p className="text-sm text-steel-600">No outgoing requests.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {outgoing.map((r) => (
                    <div key={r.id} className="bevel-md flex items-center gap-3 border border-border bg-surface p-3.5">
                      <Avatar name={r.receiver?.displayName ?? 'Unknown user'} color={r.receiver?.avatarColor ?? '#f2691c'} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-steel-100">{r.receiver?.displayName ?? 'Unknown user'}</p>
                        <p className="text-xs text-steel-500">Request pending</p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => cancelRequest(r.id)}>Cancel</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="add">
          <div className="bevel-md max-w-md border border-border bg-surface p-6">
            <h3 className="font-display text-lg font-semibold text-steel-100">Add Friend</h3>
            <p className="mt-1 text-sm text-steel-500">Enter a SquadLink handle to send a friend request.</p>
            <div className="mt-4 flex gap-2">
              <Input placeholder="e.g. shadowstrike" value={addHandle} onChange={(e) => setAddHandle(e.target.value)} icon={<span className="text-steel-600">@</span>} onKeyDown={(e) => e.key === 'Enter' && sendRequest()} />
              <Button onClick={sendRequest} loading={sending}><Send className="size-4" /> Send</Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <FriendProfileModal
        friend={selected}
        onClose={() => setSelected(null)}
        onMessage={(f) => { setSelected(null); openDm(f) }}
        onRemove={removeFriend}
      />
    </div>
  )
}

function FriendSearchBar({ query, setQuery }: { query: string; setQuery: (v: string) => void }) {
  return (
    <Input
      className="mb-5 max-w-sm"
      placeholder="Search friends…"
      icon={<Search className="size-4" />}
      value={query}
      onChange={(e) => setQuery(e.target.value)}
    />
  )
}

function FriendGrid({ list, onOpen, onMessage, onRemove }: {
  list: Friend[]
  onOpen: (f: Friend) => void
  onMessage: (f: Friend) => void
  onRemove?: (f: Friend) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((f) => (
        <ContextMenu
          key={f.id}
          items={[
            { label: 'View profile', onClick: () => onOpen(f) },
            { label: 'Send message', icon: <MessageSquare className="size-4" />, onClick: () => onMessage(f) },
            ...(onRemove ? [{ label: 'Remove friend', danger: true, onClick: () => onRemove(f) }] : []),
          ]}
        >
          <button onClick={() => onOpen(f)} className="bevel-md focus-ring flex w-full items-center gap-3 border border-border bg-surface p-3.5 text-left transition-colors hover:border-border-strong hover:bg-surface-2">
            <Avatar name={f.displayName} color={f.avatarColor} status={f.status} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-steel-100">{f.displayName}</p>
              <p className="truncate text-xs text-steel-500">{f.currentGame ?? f.statusText ?? 'Offline'}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onMessage(f) }}
              className="focus-ring flex size-8 shrink-0 items-center justify-center rounded-sm text-steel-500 hover:bg-surface-3 hover:text-orange-400"
            >
              <MessageSquare className="size-4" />
            </button>
          </button>
        </ContextMenu>
      ))}
    </div>
  )
}
