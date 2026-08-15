import logo from '@/assets/logo.png'

interface LoadingScreenProps {
  /** Small status line under the tagline, e.g. "Reconnecting…" */
  message?: string
}

/**
 * Full-screen branded loading state. Used while the app is bootstrapping
 * a session (silent refresh on page load) or anywhere else we're blocking
 * on something with no known duration — so the spinner is indeterminate,
 * unlike SplashScreen's timed progress bar during onboarding.
 */
export function LoadingScreen({ message }: LoadingScreenProps) {
  return (
    <div className="carbon-weave flex h-screen w-full flex-col items-center justify-center bg-base">
      <div className="anim-zoom-in flex flex-col items-center">
        <div className="relative">
          <div className="absolute inset-0 -z-10 animate-pulse-ring rounded-full" />
          <img src={logo} alt="SquadLink" className="size-24 rounded-xl" />
        </div>
        <h1 className="mt-6 font-display text-2xl font-bold tracking-[0.15em] text-steel-100">
          SQUADLINK
        </h1>
        <p className="mt-1 text-xs font-medium uppercase tracking-[0.3em] text-steel-600">
          Connect · Play · Together
        </p>
      </div>

      <div className="absolute bottom-16 flex flex-col items-center gap-3">
        <div className="flex gap-1.5">
          <span className="size-1.5 animate-bounce rounded-full bg-orange-500 [animation-delay:-0.3s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-orange-500 [animation-delay:-0.15s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-orange-500" />
        </div>
        {message && (
          <p className="text-xs font-medium text-steel-600">{message}</p>
        )}
      </div>
    </div>
  )
}
