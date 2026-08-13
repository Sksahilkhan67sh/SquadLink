import { useEffect, useRef, useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { Hash, Volume2, Megaphone, Calendar, Shield, Settings2, ChevronLeft, Plus } from 'lucide-react'
import { Room, Track, type RemoteTrack, type RemoteTrackPublication } from 'livekit-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Skeleton } from '@/components/shared/Skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Card, CardContent } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { communitiesApi } from '@/lib/api/communities'
import { voiceApi } from '@/lib/api/voice'
import { useApiData } from '@/lib/hooks/useApiData'
import { presenceToUi } from '@/lib/adapters'
import { communityAccent } from '@/lib/color'
import { cn, timeAgo } from '@/lib/utils'
import { env } from '@/lib/env'
import type { ApiChannel } from '@/lib/api/types'

export function CommunityDetailPage() {
  const { id } = useParams()
  const { push } = useToast()
  const communityState = useApiData(() => communitiesApi.get(id!), [id])
  const membersState = useApiData(() => communitiesApi.listMembers(id!), [id])
  const eventsState = useApiData(() => communitiesApi.listEvents(id!), [id])
  const announcementsState = useApiData(() => communitiesApi.listAnnouncements(id!), [id])

  const [activeChannel, setActiveChannel] = useState<string | undefined>()
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [evTitle, setEvTitle] = useState('')
  const [evDate, setEvDate] = useState('')
  const [evGame, setEvGame] = useState('')

  useEffect(() => {
    if (communityState.status === 'success' && !activeChannel) {
      const first = communityState.data.channelGroups?.[0]?.channels[0]
      if (first) setActiveChannel(first.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityState.status])

  if (!id) return <Navigate to="/communities" replace />

  if (communityState.status === 'loading') {
    return <div className="p-6"><Skeleton className="h-8 w-64" /><Skeleton className="mt-3 h-40 w-full" /></div>
  }
  if (communityState.status === 'error') {
    return <div className="p-6"><ErrorState message={communityState.error} onRetry={communityState.retry} /></div>
  }

  const community = communityState.data
  const channel = community.channelGroups?.flatMap((g) => g.channels).find((c) => c.id === activeChannel)
  const accent = communityAccent(community.id)

  async function createEvent() {
    if (!evTitle.trim() || !evDate) return
    try {
      await communitiesApi.createEvent(id!, evTitle.trim(), new Date(evDate).toISOString(), evGame.trim() || undefined)
      eventsState.retry()
      setEventModalOpen(false)
      setEvTitle(''); setEvDate(''); setEvGame('')
      push({ kind: 'success', title: 'Event created' })
    } catch {
      push({ kind: 'error', title: "Couldn't create event" })
    }
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border">
        <div className="flex items-center gap-2 border-b border-border px-4 py-4">
          <Link to="/communities" className="focus-ring text-steel-500 hover:text-steel-100"><ChevronLeft className="size-4" /></Link>
          <span className="bevel-sm flex size-7 items-center justify-center text-[10px] font-display font-bold text-black" style={{ backgroundColor: accent }}>
            {community.tag.slice(0, 2)}
          </span>
          <p className="truncate text-sm font-semibold text-steel-100">{community.name}</p>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-3">
          {(community.channelGroups ?? []).map((g) => (
            <div key={g.id} className="mb-3">
              <p className="mb-1 px-2 text-[11px] font-bold uppercase tracking-widest text-steel-700">{g.name}</p>
              {g.channels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannel(ch.id)}
                  className={cn(
                    'focus-ring flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm transition-colors',
                    activeChannel === ch.id ? 'bg-surface-2 text-steel-100' : 'text-steel-500 hover:bg-surface-2 hover:text-steel-200',
                  )}
                >
                  {ch.type === 'VOICE' ? <Volume2 className="size-4 shrink-0" /> : ch.type === 'ANNOUNCEMENT' ? <Megaphone className="size-4 shrink-0" /> : <Hash className="size-4 shrink-0" />}
                  <span className="min-w-0 flex-1 truncate">{ch.name}</span>
                </button>
              ))}
            </div>
          ))}
          {(community.channelGroups ?? []).length === 0 && <p className="px-2 text-xs text-steel-600">No channels yet.</p>}
        </div>
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto px-6 py-6">
        <PageHeader
          title={community.name}
          description={`${community.memberCount.toLocaleString()} members`}
          actions={<Button variant="outline"><Settings2 className="size-4" /> Community Settings</Button>}
        />

        <Tabs defaultValue="channel">
          <TabsList className="mb-5">
            <TabsTrigger value="channel">{channel?.type === 'VOICE' ? 'Voice' : 'Channel'}</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="announcements">Announcements</TabsTrigger>
            <TabsTrigger value="roles">Roles</TabsTrigger>
          </TabsList>

          <TabsContent value="channel">
            {!channel ? (
              <EmptyState icon={<Hash className="size-6" />} title="Select a channel" />
            ) : channel.type === 'VOICE' ? (
              <VoiceChannelPanel channel={channel} />
            ) : (
              <EmptyState
                icon={<Hash className="size-6" />}
                title={`#${channel.name}`}
                description="Text channel messaging isn't available yet — this is a known backend gap (see integration report). Channel structure, voice, members, events, announcements, and roles are fully live."
              />
            )}
          </TabsContent>

          <TabsContent value="members">
            {membersState.status === 'loading' && <Skeleton className="h-40 w-full" />}
            {membersState.status === 'error' && <ErrorState message={membersState.error} onRetry={membersState.retry} />}
            {(membersState.status === 'success' || membersState.status === 'empty') && (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {membersState.data.map((m) => (
                  <div key={m.userId} className="bevel-md flex items-center gap-3 border border-border bg-surface p-3.5">
                    <Avatar name={m.user.displayName} color={m.user.avatarColor} status={presenceToUi(m.user.status)} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-steel-100">{m.user.displayName}</p>
                      <p className="truncate text-xs text-steel-500">{m.roles.map((r) => r.role.name).join(', ') || 'Member'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="events">
            <div className="mb-3 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setEventModalOpen(true)}><Plus className="size-4" /> New event</Button>
            </div>
            {eventsState.status === 'loading' && <Skeleton className="h-20 w-full" />}
            {eventsState.status === 'error' && <ErrorState message={eventsState.error} onRetry={eventsState.retry} />}
            {(eventsState.status === 'success' || eventsState.status === 'empty') && eventsState.data.length === 0 ? (
              <EmptyState icon={<Calendar className="size-6" />} title="No events scheduled" description="Check back soon, or create one for the community." />
            ) : (
              <div className="flex flex-col gap-3">
                {(eventsState.status === 'success' || eventsState.status === 'empty' ? eventsState.data : []).map((ev) => (
                  <div key={ev.id} className="bevel-md flex items-center gap-4 border border-border bg-surface p-4">
                    <div className="bevel-sm flex size-12 flex-col items-center justify-center bg-orange-500/12 text-orange-400">
                      <span className="text-[10px] font-bold uppercase">{new Date(ev.date).toLocaleDateString(undefined, { month: 'short' })}</span>
                      <span className="font-display text-lg font-bold leading-none">{new Date(ev.date).getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-steel-100">{ev.title}</p>
                      <p className="text-xs text-steel-500">
                        {new Date(ev.date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                        {ev.game ? ` · ${ev.game}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="announcements">
            {announcementsState.status === 'loading' && <Skeleton className="h-20 w-full" />}
            {announcementsState.status === 'error' && <ErrorState message={announcementsState.error} onRetry={announcementsState.retry} />}
            {(announcementsState.status === 'success' || announcementsState.status === 'empty') && announcementsState.data.length === 0 ? (
              <EmptyState icon={<Megaphone className="size-6" />} title="No announcements yet" />
            ) : (
              <div className="flex flex-col gap-3">
                {(announcementsState.status === 'success' || announcementsState.status === 'empty' ? announcementsState.data : []).map((a) => (
                  <Card key={a.id} bevel>
                    <CardContent>
                      <div className="mb-1.5 flex items-center gap-2">
                        <Megaphone className="size-4 text-orange-500" />
                        <h3 className="font-display text-base font-semibold text-steel-100">{a.title}</h3>
                      </div>
                      <p className="text-sm text-steel-400">{a.body}</p>
                      <p className="mt-2 text-xs text-steel-600">{a.author?.displayName ?? 'Unknown'} · {timeAgo(a.postedAt)} ago</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="roles">
            <div className="flex flex-col gap-2.5">
              {(community.roles ?? []).length === 0 && <p className="text-sm text-steel-600">No custom roles yet.</p>}
              {(community.roles ?? []).map((r) => (
                <div key={r.id} className="bevel-md flex items-center gap-4 border border-border bg-surface p-4">
                  <span className="size-3 rounded-full" style={{ backgroundColor: r.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-steel-100">{r.name}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {r.permissions.map((p) => (
                        <span key={p} className="flex items-center gap-1 rounded-sm bg-surface-2 px-2 py-0.5 text-[11px] text-steel-400"><Shield className="size-3" /> {p}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Modal open={eventModalOpen} onClose={() => setEventModalOpen(false)} title="New Event" footer={<Button onClick={createEvent} disabled={!evTitle.trim() || !evDate}>Create</Button>}>
        <div className="flex flex-col gap-3">
          <Input placeholder="Event title" value={evTitle} onChange={(e) => setEvTitle(e.target.value)} />
          <Input type="datetime-local" value={evDate} onChange={(e) => setEvDate(e.target.value)} />
          <Input placeholder="Game (optional)" value={evGame} onChange={(e) => setEvGame(e.target.value)} />
        </div>
      </Modal>
    </div>
  )
}

/** Self-contained LiveKit connection for a community voice channel — independent of party voice. */
function VoiceChannelPanel({ channel }: { channel: ApiChannel }) {
  const { push } = useToast()
  const [connecting, setConnecting] = useState(false)
  const [connected, setConnected] = useState(false)
  const [participantCount, setParticipantCount] = useState(0)
  const [room, setRoom] = useState<Room | null>(null)
  // Same as party voice: remote audio tracks are subscribed by the SDK but
  // never played back unless we attach() them to a real <audio> element.
  const audioContainerRef = useRef<HTMLDivElement | null>(null)
  const attachedElsRef = useRef<Map<string, HTMLMediaElement>>(new Map())

  const detachAllAudio = () => {
    attachedElsRef.current.forEach((el) => el.remove())
    attachedElsRef.current.clear()
  }

  useEffect(() => () => { room?.disconnect(); detachAllAudio() }, [room])

  async function join() {
    setConnecting(true)
    try {
      const grant = await voiceApi.joinChannel(channel.id)
      const r = new Room({ adaptiveStream: true, dynacast: true })
      r.on('participantConnected', () => setParticipantCount(r.numParticipants))
      r.on('participantDisconnected', () => setParticipantCount(r.numParticipants))
      r.on('disconnected', () => { detachAllAudio(); setConnected(false); setRoom(null) })
      r.on('trackSubscribed', (track: RemoteTrack, publication: RemoteTrackPublication) => {
        if (track.kind !== Track.Kind.Audio) return
        const el = track.attach() as HTMLMediaElement
        el.autoplay = true
        attachedElsRef.current.set(publication.trackSid, el)
        audioContainerRef.current?.appendChild(el)
      })
      r.on('trackUnsubscribed', (track: RemoteTrack, publication: RemoteTrackPublication) => {
        if (track.kind !== Track.Kind.Audio) return
        track.detach().forEach((el) => el.remove())
        attachedElsRef.current.delete(publication.trackSid)
      })
      await r.connect(grant.url || env.livekitUrl, grant.token)
      await r.localParticipant.setMicrophoneEnabled(true)
      setParticipantCount(r.numParticipants)
      setRoom(r)
      setConnected(true)
    } catch {
      push({ kind: 'error', title: "Couldn't join voice channel" })
    } finally {
      setConnecting(false)
    }
  }

  function leave() {
    room?.disconnect()
    detachAllAudio()
    setRoom(null)
    setConnected(false)
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <Volume2 className="size-8 text-orange-500" />
        <div>
          <h3 className="font-display text-lg font-semibold text-steel-100">{channel.name}</h3>
          <p className="text-sm text-steel-500">{connected ? `${participantCount} connected` : 'Not connected'}</p>
        </div>
        {connected ? (
          <Button variant="danger" onClick={leave}>Leave Voice Channel</Button>
        ) : (
          <Button loading={connecting} onClick={join}>Join Voice Channel</Button>
        )}
      </CardContent>
      <div ref={audioContainerRef} style={{ display: 'none' }} aria-hidden="true" />
    </Card>
  )
}