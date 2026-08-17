import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import logo from '@/assets/logo.png'

interface StartAnimationProps {
  onFinish: () => void
}

const EXIT_AT_MS = 2200
const DONE_AT_MS = 2750

const FACES = ['front', 'back', 'right', 'left', 'top', 'bottom'] as const

/**
 * A one-time 3D intro shown over the app on first load. Runs in parallel
 * with the real page underneath (auth bootstrap, route render) — it's a
 * pure overlay, so it never delays anything; by the time it finishes,
 * whatever should be showing next is already ready and waiting behind it.
 *
 * Design intent: one deliberate settle rather than a spin gimmick — the
 * cube eases into a fixed 3/4 angle, a light sweep crosses the front face
 * once like a glass reflection, the wordmark resolves from a blur (a
 * "focus pull"), and the exit defocuses out rather than zooming/exploding.
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
      <div className="intro-glow" />

      <div className="intro-scene">
        <div className="intro-cube">
          {FACES.map((face) => (
            <div key={face} className={cn('intro-cube-face', `intro-face-${face}`)}>
              {face === 'front' && (
                <>
                  <img src={logo} alt="" className="size-9 rounded-sm" />
                  <div className="intro-sheen" />
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 flex flex-col items-center">
        <p className="intro-wordmark font-display text-lg font-bold text-steel-100">SQUADLINK</p>
        <div className="intro-rule mt-3" />
        <p className="intro-tagline mt-3 text-[10px] font-medium uppercase tracking-[0.35em] text-steel-600">
          Connect · Play · Together
        </p>
      </div>
    </div>
  )
}
