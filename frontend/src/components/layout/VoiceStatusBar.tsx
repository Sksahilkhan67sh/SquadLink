import { Mic, MicOff, Headphones, PhoneOff, ChevronUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { Tooltip } from '@/components/ui/Tooltip'
import { useVoiceSession } from '@/lib/realtime/VoiceSessionContext'
import { cn } from '@/lib/utils'

export function VoiceStatusBar() {
  const { activeParty, connected, muted, deafened, speakingUserIds, toggleMute, toggleDeafen, leaveVoice } = useVoiceSession()
  const navigate = useNavigate()

  if (!connected || !activeParty) return null

  return (
    <div className="anim-slide-up border-t border-border bg-surface-2 px-3 py-2.5">
      <button onClick={() => navigate('/voice')} className="focus-ring mb-2 flex w-full items-center justify-between rounded-sm px-1 py-1 hover:bg-surface-3">
        <div className="flex items-center gap-2 text-left">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          <div>
            <p className="text-xs font-semibold text-steel-100">{activeParty.name}</p>
            <p className="text-[11px] text-steel-500">Voice connected{activeParty.region ? ` · ${activeParty.region}` : ''}</p>
          </div>
        </div>
        <ChevronUp className="size-4 text-steel-500" />
      </button>
      <div className="flex items-center justify-between">
        <div className="flex -space-x-2">
          {activeParty.members.slice(0, 4).map((m) => (
            <Avatar
              key={m.userId}
              name={m.user.displayName}
              color={m.user.avatarColor}
              size="xs"
              speaking={speakingUserIds.has(m.userId)}
              className="ring-2 ring-surface-2 rounded-full"
            />
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Tooltip content={muted ? 'Unmute' : 'Mute'}>
            <button
              onClick={() => toggleMute()}
              className={cn('focus-ring flex size-8 items-center justify-center rounded-sm transition-colors', muted ? 'bg-danger/20 text-[#ff8570]' : 'text-steel-300 hover:bg-surface-3')}
            >
              {muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            </button>
          </Tooltip>
          <Tooltip content={deafened ? 'Undeafen' : 'Deafen'}>
            <button
              onClick={() => toggleDeafen()}
              className={cn('focus-ring flex size-8 items-center justify-center rounded-sm transition-colors', deafened ? 'bg-danger/20 text-[#ff8570]' : 'text-steel-300 hover:bg-surface-3')}
            >
              <Headphones className="size-4" />
            </button>
          </Tooltip>
          <Tooltip content="Disconnect">
            <button onClick={() => leaveVoice()} className="focus-ring flex size-8 items-center justify-center rounded-sm text-[#ff8570] hover:bg-danger/20">
              <PhoneOff className="size-4" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
