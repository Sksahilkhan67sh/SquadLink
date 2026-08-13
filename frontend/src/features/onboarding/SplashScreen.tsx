import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import logo from '@/assets/logo.png'

export function SplashScreen() {
  const navigate = useNavigate()
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => Math.min(100, p + 4))
    }, 40)
    const timeout = setTimeout(() => navigate('/onboarding'), 1900)
    return () => { clearInterval(interval); clearTimeout(timeout) }
  }, [navigate])

  return (
    <div className="carbon-weave flex h-screen w-full flex-col items-center justify-center bg-base">
      <div className="anim-zoom-in flex flex-col items-center">
        <div className="relative">
          <div className="absolute inset-0 -z-10 animate-pulse-ring rounded-full" />
          <img src={logo} alt="SquadLink" className="size-28 rounded-xl" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-bold tracking-[0.15em] text-steel-100">SQUADLINK</h1>
        <p className="mt-1 text-xs font-medium uppercase tracking-[0.3em] text-steel-600">Connect · Play · Together</p>
      </div>
      <div className="absolute bottom-16 h-0.5 w-48 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full bg-orange-500 transition-[width] duration-100 ease-linear" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}
