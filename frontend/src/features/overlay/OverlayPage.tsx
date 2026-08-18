import { useEffect, useState } from 'react'
import { Mic, MicOff, Move, Monitor } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Avatar } from '@/components/ui/Avatar'
import { Switch, Radio } from '@/components/ui/Toggle'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { VoiceIndicator } from '@/components/shared/VoiceIndicator'
import { useVoiceSession } from '@/lib/realtime/VoiceSessionContext'
import { settingsApi } from '@/lib/api/settings'
import { cn } from '@/lib/utils'

const POSITIONS = [
  { id: 'top-left', label: 'Top Left', cls: 'top-4 left-4' },
  { id: 'top-right', label: 'Top Right', cls: 'top-4 right-4' },
  { id: 'bottom-left', label: 'Bottom Left', cls: 'bottom-4 left-4' },
  { id: 'bottom-right', label: 'Bottom Right', cls: 'bottom-4 right-4' },
] as const

type Position = typeof POSITIONS[number]['id']

/**
 * Note on what this actually is: a browser tab cannot render on top of
 * other applications while you're in-game — that needs a native desktop
 * app. This page is a preview of what the overlay widget would look like
 * and lets you configure it; the settings persist (see below) so a future
 * native/desktop client can pick them straight up.
 */
export function OverlayPage() {
  const { activeParty, speakingUserIds } = useVoiceSession()
  const [enabled, setEnabled] = useState(true)
  const [position, setPosition] = useState<Position>('top-right')
  const [opacity, setOpacity] = useState(90)
  const [loaded, setLoaded] = useState(false)

  // Previously these three lived only in useState — every reload or nav
  // away silently reset them to defaults. Now they load from, and save
  // to, the same preferences record every other setting in the app uses.
  useEffect(() => {
    let cancelled = false
    settingsApi
      .getPreferences()
      .then((prefs) => {
        if (cancelled) return
        setEnabled(prefs.overlayEnabled)
        setPosition(prefs.overlayPosition)
        setOpacity(prefs.overlayOpacity)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function updateEnabled(next: boolean) {
    setEnabled(next)
    settingsApi.updatePreferences({ overlayEnabled: next }).catch(() => {})
  }

  function updatePosition(next: Position) {
    setPosition(next)
    settingsApi.updatePreferences({ overlayPosition: next }).catch(() => {})
  }

  function updateOpacity(next: number) {
    setOpacity(next)
    settingsApi.updatePreferences({ overlayOpacity: next }).catch(() => {})
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <PageHeader
        title="In-Game Overlay"
        description="Preview of the voice overlay widget — a browser tab can't actually float on top of other apps, so this is what a future desktop client would show."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <div className="carbon-weave bevel-lg relative h-96 overflow-hidden border border-border bg-[#0d1a10]">
          <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold uppercase tracking-widest text-steel-800">
            <Monitor className="mr-2 size-4" /> Preview area (stands in for your game)
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
              <Switch checked={enabled} onChange={updateEnabled} disabled={!loaded} />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-steel-500">Position</p>
              <div className="flex flex-col gap-2">
                {POSITIONS.map((p) => (
                  <Radio key={p.id} checked={position === p.id} onChange={() => updatePosition(p.id)} label={p.label} />
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-steel-500">
                <span>Opacity</span><span>{opacity}%</span>
              </div>
              <input type="range" min={30} max={100} value={opacity} onChange={(e) => updateOpacity(Number(e.target.value))} className="h-1.5 w-full appearance-none rounded-full bg-surface-3 accent-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
