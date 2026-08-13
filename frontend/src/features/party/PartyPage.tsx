import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Settings2, Mic, MicOff, Crown, Swords, LogOut, Search, X, PhoneCall } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Skeleton } from '@/components/shared/Skeleton'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Switch } from '@/components/ui/Toggle'
import { useToast } from '@/components/ui/Toast'
import { VoiceIndicator } from '@/components/shared/VoiceIndicator'
import { partyApi } from '@/lib/api/party'
import { friendsApi } from '@/lib/api/friends'
import { useApiData } from '@/lib/hooks/useApiData'
import { useVoiceSession } from '@/lib/realtime/VoiceSessionContext'
import { useCall } from '@/lib/realtime/CallContext'
import { useAuth } from '@/lib/auth/AuthContext'
import { presenceToUi, friendToUi } from '@/lib/adapters'
import { ApiError } from '@/lib/api/http'

export function PartyPage() {
  const navigate = useNavigate()
  const { push } = useToast()
  const { user } = useAuth()
  const { activeParty, connected, connecting, speakingUserIds, joinPartyVoice, leaveVoice, refreshActiveParty } = useVoiceSession()
  const { outgoingCall, startPartyCall } = useCall()

  const [inviteOpen, setInviteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newGame, setNewGame] = useState('')
  const [newIsPublic, setNewIsPublic] = useState(false)
  const [openInvites, setOpenInvites] = useState(activeParty?.openInvites ?? true)
  const [busy, setBusy] = useState<string | null>(null)

  const friendsState = useApiData(() => friendsApi.list(), [inviteOpen])
  const isLeader = activeParty?.members.find((m) => m.userId === user?.id)?.role === 'LEADER'

  async function createParty() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const created = await partyApi.create({ name: newName.trim(), game: newGame.trim() || undefined })
      if (newIsPublic) {
        await partyApi.updateSettings(created.id, { openInvites: true })
        const result = await partyApi.inviteAllFriends(created.id)
        push({ kind: 'success', title: 'Party created', description: result.invited > 0 ? `Invited ${result.invited} friend${result.invited === 1 ? '' : 's'}.` : 'No friends to invite yet.' })
      } else {
        push({ kind: 'success', title: 'Party created' })
      }
      await refreshActiveParty()
      setCreateOpen(false)
      setNewName('')
      setNewGame('')
      setNewIsPublic(false)
    } catch {
      push({ kind: 'error', title: "Couldn't create party" })
    } finally {
      setCreating(false)
    }
  }

  async function invite(userId: string, name: string) {
    if (!activeParty) return
    try {
      await partyApi.invite(activeParty.id, userId)
      push({ kind: 'success', title: 'Invite sent', description: `Sent to ${name}` })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) push({ kind: 'error', title: 'Already invited or a member' })
      else push({ kind: 'error', title: "Couldn't send invite" })
    }
  }

  async function kick(userId: string, name: string) {
    if (!activeParty) return
    setBusy(userId)
    try {
      await partyApi.kick(activeParty.id, userId)
      await refreshActiveParty()
      push({ kind: 'info', title: `${name} was removed from the party` })
    } catch {
      push({ kind: 'error', title: "Couldn't remove member" })
    } finally {
      setBusy(null)
    }
  }

  async function leaveParty() {
    if (!activeParty) return
    try {
      if (connected) await leaveVoice()
      await partyApi.leave(activeParty.id)
      await refreshActiveParty()
      push({ kind: 'info', title: 'Left party' })
    } catch {
      push({ kind: 'error', title: "Couldn't leave party" })
    }
  }

  async function toggleOpenInvites(value: boolean) {
    if (!activeParty) return
    setOpenInvites(value)
    try {
      await partyApi.updateSettings(activeParty.id, { openInvites: value })
    } catch {
      setOpenInvites(!value)
      push({ kind: 'error', title: "Couldn't update settings" })
    }
  }

  if (!activeParty) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-6">
        <PageHeader title="Party" description="Squad up and jump into voice together." />
        <EmptyState
          icon={<Swords className="size-6" />}
          title="No active party"
          description="Create a party to invite friends and start voice chat together — ready in two clicks."
          action={<Button onClick={() => setCreateOpen(true)}><Swords className="size-4" /> Create Party</Button>}
        />
        <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Party" footer={<Button onClick={createParty} loading={creating} disabled={!newName.trim()}>Create</Button>}>
          <div className="flex flex-col gap-4">
            <Input placeholder="Party name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Input placeholder="Game (optional)" value={newGame} onChange={(e) => setNewGame(e.target.value)} />
            <div className="flex flex-col gap-2">
              <label className="flex items-start gap-3 rounded-sm border border-border p-3 hover:bg-surface-2">
                <input type="radio" name="party-visibility" checked={!newIsPublic} onChange={() => setNewIsPublic(false)} className="mt-1 accent-orange-500" />
                <span>
                  <span className="block text-sm font-semibold text-steel-100">Private party</span>
                  <span className="block text-xs text-steel-500">Only people you invite can join. Invite specific friends after creating.</span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-sm border border-border p-3 hover:bg-surface-2">
                <input type="radio" name="party-visibility" checked={newIsPublic} onChange={() => setNewIsPublic(true)} className="mt-1 accent-orange-500" />
                <span>
                  <span className="block text-sm font-semibold text-steel-100">Public party</span>
                  <span className="block text-xs text-steel-500">Every friend gets a notification with a Join button as soon as the party is created.</span>
                </span>
              </label>
            </div>
          </div>
        </Modal>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <PageHeader
        title={activeParty.name}
        description={`${activeParty.game ?? 'No game set'}${activeParty.region ? ` · ${activeParty.region}` : ''} · ${activeParty.members.length}/${activeParty.maxSize} members`}
        actions={
          <>
            {isLeader && <Button variant="outline" onClick={() => setSettingsOpen(true)}><Settings2 className="size-4" /> Settings</Button>}
            <Button onClick={() => setInviteOpen(true)}><UserPlus className="size-4" /> Invite</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Party Members</CardTitle>
            <Badge variant={connected ? 'success' : 'default'}>{connected ? 'Voice connected' : 'Voice not connected'}</Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            {activeParty.members.map((m) => (
              <div key={m.userId} className="flex items-center gap-3 rounded-sm bg-surface-2 px-3.5 py-3">
                <Avatar name={m.user.displayName} color={m.user.avatarColor} status={presenceToUi(m.user.status)} size="md" speaking={speakingUserIds.has(m.userId)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-semibold text-steel-100">{m.user.displayName}</p>
                    {m.role === 'LEADER' && <Crown className="size-3.5 text-orange-500" />}
                  </div>
                  <p className="truncate text-xs text-steel-500">{m.user.currentGame ?? 'In party'}</p>
                </div>
                <VoiceIndicator speaking={speakingUserIds.has(m.userId)} />
                {m.muted ? <MicOff className="size-4 text-steel-600" /> : <Mic className="size-4 text-steel-500" />}
                {isLeader && m.userId !== user?.id && (
                  <button onClick={() => kick(m.userId, m.user.displayName)} disabled={busy === m.userId} className="focus-ring ml-1 flex size-7 items-center justify-center rounded-sm text-steel-600 hover:bg-danger/20 hover:text-[#ff8570]">
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
            {Array.from({ length: Math.max(0, activeParty.maxSize - activeParty.members.length) }).map((_, i) => (
              <button
                key={i}
                onClick={() => setInviteOpen(true)}
                className="focus-ring flex items-center gap-3 rounded-sm border border-dashed border-border-strong px-3.5 py-3 text-left text-steel-600 hover:border-orange-500/50 hover:text-orange-400"
              >
                <div className="flex size-10 items-center justify-center rounded-full border border-dashed border-current">
                  <UserPlus className="size-4" />
                </div>
                <p className="text-sm font-medium">Invite a friend</p>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader><CardTitle>Voice Controls</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              {connected ? (
                <Button variant="secondary" className="w-full justify-center" onClick={() => navigate('/voice')}>
                  <Mic className="size-4" /> Open Voice Room
                </Button>
              ) : outgoingCall?.partyId === activeParty.id ? (
                <Button variant="secondary" className="w-full justify-center" disabled>
                  <PhoneCall className="size-4 animate-pulse" /> Ringing…
                </Button>
              ) : isLeader ? (
                <>
                  <Button className="w-full justify-center" loading={connecting} onClick={() => startPartyCall(activeParty.id, activeParty.name)}>
                    <PhoneCall className="size-4" /> Start Voice Call
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-center" onClick={() => joinPartyVoice(activeParty.id)}>
                    Join without ringing everyone
                  </Button>
                </>
              ) : (
                <Button variant="ghost" size="sm" className="w-full justify-center" loading={connecting} onClick={() => joinPartyVoice(activeParty.id)}>
                  <Mic className="size-4" /> Join Voice
                </Button>
              )}
              <Button variant="danger" className="w-full justify-center" onClick={leaveParty}>
                <LogOut className="size-4" /> Leave Party
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Party Details</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between"><span className="text-steel-500">Game</span><span className="font-medium text-steel-200">{activeParty.game ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-steel-500">Region</span><span className="font-medium text-steel-200">{activeParty.region ?? '—'}</span></div>
              <div className="flex justify-between">
                <span className="text-steel-500">Open invites</span>
                <Switch checked={openInvites} onChange={toggleOpenInvites} disabled={!isLeader} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite to Party">
        <InviteList friendsState={friendsState} onInvite={invite} memberIds={new Set(activeParty.members.map((m) => m.userId))} />
      </Modal>

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Party Settings" footer={<Button onClick={() => setSettingsOpen(false)}>Done</Button>}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-steel-100">Open invites</p>
              <p className="text-xs text-steel-500">Anyone in mutual communities can request to join.</p>
            </div>
            <Switch checked={openInvites} onChange={toggleOpenInvites} />
          </div>
        </div>
      </Modal>
    </div>
  )
}

function InviteList({ friendsState, onInvite, memberIds }: {
  friendsState: ReturnType<typeof useApiData<Awaited<ReturnType<typeof friendsApi.list>>>>
  onInvite: (userId: string, name: string) => void
  memberIds: Set<string>
}) {
  const [query, setQuery] = useState('')
  const [sentTo, setSentTo] = useState<Set<string>>(new Set())

  if (friendsState.status === 'loading') {
    return <div className="flex flex-col gap-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
  }
  if (friendsState.status === 'error') return <ErrorState message={friendsState.error} onRetry={friendsState.retry} />

  const list = (friendsState.status === 'success' || friendsState.status === 'empty' ? friendsState.data : [])
    .map(friendToUi)
    .filter((f) => !memberIds.has(f.id))
    .filter((f) => f.displayName.toLowerCase().includes(query.toLowerCase()))

  return (
    <>
      <Input placeholder="Search friends…" icon={<Search className="size-4" />} className="mb-4" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
        {list.length === 0 && <p className="py-4 text-center text-sm text-steel-600">No friends to invite.</p>}
        {list.map((f) => (
          <button
            key={f.id}
            disabled={sentTo.has(f.id)}
            onClick={() => { onInvite(f.id, f.displayName); setSentTo((s) => new Set(s).add(f.id)) }}
            className="focus-ring flex items-center gap-3 rounded-sm px-2 py-2 text-left hover:bg-surface-3 disabled:opacity-50"
          >
            <Avatar name={f.displayName} color={f.avatarColor} status={f.status} size="sm" />
            <span className="flex-1 text-sm text-steel-200">{f.displayName}</span>
            <span className="text-xs font-semibold text-orange-400">{sentTo.has(f.id) ? 'Sent' : 'Invite'}</span>
          </button>
        ))}
      </div>
    </>
  )
}
