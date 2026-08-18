import { useState } from 'react'
import { Mic, MicOff, Headphones, PhoneOff, Volume2, Settings2, Swords } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/lib/utils'
import { presenceToUi } from '@/lib/adapters'
import { VoiceIndicator } from '@/components/shared/VoiceIndicator'
import { useVoiceSession } from '@/lib/realtime/VoiceSessionContext'

export function VoiceRoomPage() {
  const navigate = useNavigate()
  const {
    activeParty, connected, connecting, muted, deafened, speakingUserIds, error,
    outputVolume, setOutputVolume, joinPartyVoice, leaveVoice, toggleMute, toggleDeafen,
  } = useVoiceSession()
  const [overlayOn, setOverlayOn] = useState(true)

  if (!activeParty) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-6">
        <PageHeader title="Voice Room" description="Join a party to start voice chat." />
        <EmptyState icon={<Swords className="size-6" />} title="No active party" description="Create or join a party first." action={<Button onClick={() => navigate('/party')}>Go to Party</Button>} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <PageHeader title="Voice Room" description={`${activeParty.name}${activeParty.region ? ` · ${activeParty.region}` : ''}`} />

      {error && <div className="bevel-sm mb-5 border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-[#ff8570]">{error}</div>}

      {!connected ? (
        <div className="bevel-lg flex flex-col items-center justify-center gap-4 border border-border bg-surface p-16 text-center">
          <p className="text-sm text-steel-400">Not connected to voice.</p>
          <Button loading={connecting} onClick={() => joinPartyVoice(activeParty.id)}><Mic className="size-4" /> Join Voice</Button>
        </div>
      ) : (
        <>
          <div className="carbon-weave bevel-lg relative overflow-hidden border border-border bg-surface p-8">
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              {activeParty.members.map((m) => {
                const speaking = speakingUserIds.has(m.userId)
                return (
                  <div key={m.userId} className="bevel-md flex flex-col items-center gap-3 border border-border bg-surface-2 p-5 text-center">
                    <div className={cn('relative', speaking && 'animate-pulse-ring rounded-full')}>
                      <Avatar name={m.user.displayName} color={m.user.avatarColor} status={presenceToUi(m.user.status)} size="xl" speaking={speaking} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-steel-100">{m.user.displayName}</p>
                      <p className="text-xs text-steel-500">{m.role === 'LEADER' ? 'Party Leader' : 'Member'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <VoiceIndicator speaking={speaking} />
                      {m.muted ? <MicOff className="size-3.5 text-steel-600" /> : <Mic className="size-3.5 text-steel-500" />}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bevel-md mt-5 flex flex-wrap items-center justify-between gap-4 border border-border bg-surface p-5">
            <div className="flex items-center gap-2">
              <Tooltip content={muted ? 'Unmute' : 'Mute'}>
                <Button variant={muted ? 'danger' : 'secondary'} size="icon" onClick={() => toggleMute()}>
                  {muted ? <MicOff className="size-[18px]" /> : <Mic className="size-[18px]" />}
                </Button>
              </Tooltip>
              <Tooltip content={deafened ? 'Undeafen' : 'Deafen'}>
                <Button variant={deafened ? 'danger' : 'secondary'} size="icon" onClick={() => toggleDeafen()}>
                  <Headphones className="size-[18px]" />
                </Button>
              </Tooltip>
              <Tooltip content="Voice settings">
                <Button variant="secondary" size="icon" onClick={() => navigate('/settings?tab=audio')}><Settings2 className="size-[18px]" /></Button>
              </Tooltip>
              <Button variant="danger" onClick={() => leaveVoice()}><PhoneOff className="size-4" /> Disconnect</Button>
            </div>

            <div className="flex min-w-[180px] items-center gap-2.5">
              <Volume2 className="size-4 text-steel-500" />
              <input
                type="range"
                min={0}
                max={100}
                value={outputVolume}
                onChange={(e) => setOutputVolume(Number(e.target.value))}
                className="h-1.5 w-full appearance-none rounded-full bg-surface-3 accent-orange-500"
                aria-label="Output volume"
              />
              <span className="w-8 text-right text-xs text-steel-500">{outputVolume}%</span>
            </div>
          </div>

          <div className="bevel-md mt-5 border border-border bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-semibold text-steel-100">Overlay Preview</h3>
                <p className="text-xs text-steel-500">Preview of the widget — see the note on the Overlay page for why a browser tab can't show this over other apps yet.</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-steel-400">
                <input type="checkbox" checked={overlayOn} onChange={(e) => setOverlayOn(e.target.checked)} className="accent-orange-500" />
                Show overlay
              </label>
            </div>
            {overlayOn && (
              <div className="carbon-weave inline-flex flex-col gap-1.5 rounded-sm border border-border-strong bg-black/70 p-2.5">
                {activeParty.members.slice(0, 4).map((m) => (
                  <div key={m.userId} className="flex items-center gap-2 rounded-sm px-1.5 py-1">
                    <Avatar name={m.user.displayName} color={m.user.avatarColor} size="xs" speaking={speakingUserIds.has(m.userId)} />
                    <span className="text-xs font-medium text-steel-200">{m.user.displayName.split(' ')[0]}</span>
                    <VoiceIndicator speaking={speakingUserIds.has(m.userId)} size="sm" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
