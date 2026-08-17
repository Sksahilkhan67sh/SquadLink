import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import logo from '@/assets/logo.png'

interface StartAnimationProps {
  onFinish: () => void
}

const EXIT_AT_MS = 1650
const DONE_AT_MS = 2100

const FACES = ['front', 'back', 'right', 'left', 'top', 'bottom'] as const

/**
 * A one-time 3D cube intro shown over the app on first load. Runs in
 * parallel with the real page underneath (auth bootstrap, route render) —
 * it's a pure overlay, so it never delays anything; by the time it
 * finishes, whatever should be showing next is already ready and waiting
 * behind it.
 *
 * Respects prefers-reduced-motion: App.tsx skips mounting this component
 * entirely for that case rather than letting it play and clipping it, since
 * the CSS motion-reduction rule (index.css) would freeze the animation's
 * *visual* motion but not its timers, leaving a static screen for the full
 * duration for no reason.
 */
export function StartAnimation({ onFinish }: StartAnimationProps) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), EXIT_AT_MS)
    const doneTimer = setTimeout(onFinish, DONE_AT_MS)
    return () => {
      clearTimeout(exitTimer)
      clearTimeout(doneTimer)
    }
  }, [onFinish])

  return (
    <div
      className={cn(
        'carbon-weave fixed inset-0 z-[200] flex flex-col items-center justify-center bg-base',
        exiting && 'intro-exit',
      )}
    >
      <div className="intro-scene">
        <div className="intro-cube">
          {FACES.map((face) => (
            <div key={face} className={cn('intro-cube-face', `intro-face-${face}`)}>
              {face === 'front' && <img src={logo} alt="" className="size-10 rounded-sm" />}
            </div>
          ))}
        </div>
      </div>

      <div className="intro-wordmark mt-10 text-center">
        <p className="font-display text-lg font-bold tracking-[0.3em] text-steel-100">SQUADLINK</p>
        <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.35em] text-steel-600">
          Connect · Play · Together
        </p>
      </div>
    </div>
  )
}
