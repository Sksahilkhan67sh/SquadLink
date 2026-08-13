import { useState } from 'react'
import { Mic, MicOff, Move, Monitor } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Avatar } from '@/components/ui/Avatar'
import { Switch, Radio } from '@/components/ui/Toggle'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { VoiceIndicator } from '@/components/shared/VoiceIndicator'
import { useVoiceSession } from '@/lib/realtime/VoiceSessionContext'
import { cn } from '@/lib/utils'

const POSITIONS = [
  { id: 'top-left', label: 'Top Left', cls: 'top-4 left-4' },
  { id: 'top-right', label: 'Top Right', cls: 'top-4 right-4' },
  { id: 'bottom-left', label: 'Bottom Left', cls: 'bottom-4 left-4' },
  { id: 'bottom-right', label: 'Bottom Right', cls: 'bottom-4 right-4' },
] as const

export function OverlayPage() {
  const { activeParty, speakingUserIds } = useVoiceSession()
  const [enabled, setEnabled] = useState(true)
  const [position, setPosition] = useState<typeof POSITIONS[number]['id']>('top-right')
  const [opacity, setOpacity] = useState(90)

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <PageHeader title="In-Game Overlay" description="A small, always-on-top overlay for voice while you play." />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <div className="carbon-weave bevel-lg relative h-96 overflow-hidden border border-border bg-[#0d1a10]">
          <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold uppercase tracking-widest text-steel-800">
            <Monitor className="mr-2 size-4" /> Your game, running here
          </div>
          {enabled && activeParty ? (
            <div
              className={cn('absolute flex w-56 flex-col gap-1.5 rounded-sm border border-border-strong bg-black/75 p-2.5 backdrop-blur-sm', POSITIONS.find((p) => p.id === position)?.cls)}
              style={{ opacity: opacity / 100 }}
            >
              <div className="mb-1 flex items-center justify-between px-0.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-steel-500">{activeParty.name}</span>
                <Move className="size-3 text-steel-700" />
              </div>
              {activeParty.members.map((m) => (
                <div key={m.userId} className="flex items-center gap-2 rounded-sm px-1.5 py-1">
                  <Avatar name={m.user.displayName} color={m.user.avatarColor} size="xs" speaking={speakingUserIds.has(m.userId)} />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-steel-200">{m.user.displayName.split(' ')[0]}</span>
                  <VoiceIndicator speaking={speakingUserIds.has(m.userId)} size="sm" />
                  {m.muted ? <MicOff className="size-3 text-steel-600" /> : <Mic className="size-3 text-steel-500" />}
                </div>
              ))}
            </div>
          ) : enabled && !activeParty ? (
            <div className={cn('absolute w-56', POSITIONS.find((p) => p.id === position)?.cls)}>
              <EmptyState icon={<Mic className="size-5" />} title="No active party" description="Join a party to preview the overlay." />
            </div>
          ) : null}
        </div>

        <Card>
          <CardHeader><CardTitle>Overlay Settings</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-steel-200">Enable overlay</span>
              <Switch checked={enabled} onChange={setEnabled} />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-steel-500">Position</p>
              <div className="flex flex-col gap-2">
                {POSITIONS.map((p) => (
                  <Radio key={p.id} checked={position === p.id} onChange={() => setPosition(p.id)} label={p.label} />
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-steel-500">
                <span>Opacity</span><span>{opacity}%</span>
              </div>
              <input type="range" min={30} max={100} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="h-1.5 w-full appearance-none rounded-full bg-surface-3 accent-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
