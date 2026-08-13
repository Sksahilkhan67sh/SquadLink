import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, MessageSquare, Swords, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import logo from '@/assets/logo.png'

const STEPS = [
  {
    icon: Users,
    title: 'Find your squad',
    body: 'Add friends, join communities built around your favorite games, and see who\u2019s online at a glance.',
  },
  {
    icon: Swords,
    title: 'Party up in one tap',
    body: 'Create a party, invite friends, and drop straight into voice — no menus to dig through.',
  },
  {
    icon: MessageSquare,
    title: 'Stay in the loop',
    body: 'Private chats, group threads, and community channels — all in one clean, fast inbox.',
  },
]

export function OnboardingPage() {
  const [step, setStep] = useState(0)
  const navigate = useNavigate()
  const isLast = step === STEPS.length - 1
  const Icon = STEPS[step].icon

  return (
    <div className="carbon-weave flex h-screen w-full flex-col items-center justify-center bg-base px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex items-center justify-center gap-2">
          <img src={logo} alt="" className="size-7 rounded-sm" />
          <span className="font-display text-sm font-bold tracking-widest text-steel-300">SQUADLINK</span>
        </div>

        <div key={step} className="anim-slide-up bevel-lg border border-border bg-surface p-8 text-center">
          <div className="bevel-md mx-auto mb-6 flex size-16 items-center justify-center border border-orange-500/30 bg-orange-500/10 text-orange-500">
            <Icon className="size-7" />
          </div>
          <h1 className="font-display text-xl font-bold text-steel-100">{STEPS[step].title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-steel-500">{STEPS[step].body}</p>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2">
          {STEPS.map((_, i) => (
            <span key={i} className={cn('h-1.5 rounded-full transition-all', i === step ? 'w-6 bg-orange-500' : 'w-1.5 bg-surface-3')} />
          ))}
        </div>

        <div className="mt-8 flex items-center gap-3">
          <Button variant="ghost" size="lg" className="flex-1" onClick={() => navigate('/login')}>
            Skip
          </Button>
          <Button
            size="lg"
            className="flex-1"
            onClick={() => (isLast ? navigate('/login') : setStep((s) => s + 1))}
          >
            {isLast ? 'Get started' : 'Next'} <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
