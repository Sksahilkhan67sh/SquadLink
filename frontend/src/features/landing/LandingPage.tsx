import { useNavigate } from 'react-router-dom'
import { Users, MessageSquare, Swords, Mic, ShieldCheck, Zap, ChevronRight, Crown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import logo from '@/assets/logo.png'

const FEATURES = [
  {
    icon: Swords,
    title: 'Party up in one tap',
    body: 'Create a party, invite friends, and drop straight into voice — no menus to dig through.',
  },
  {
    icon: Users,
    title: 'Find your squad',
    body: 'Add friends, join communities built around your favorite games, and see who\u2019s online at a glance.',
  },
  {
    icon: MessageSquare,
    title: 'Stay in the loop',
    body: 'Private chats, group threads, and community channels — all in one clean, fast inbox.',
  },
  {
    icon: Mic,
    title: 'Crystal-clear voice',
    body: 'Low-latency voice rooms with push-to-talk and noise suppression, built right in.',
  },
  {
    icon: ShieldCheck,
    title: 'Your party, your rules',
    body: 'If the host leaves, the party ends for everyone — no orphaned calls or awkward hand-offs.',
  },
  {
    icon: Zap,
    title: 'Built for speed',
    body: 'Real-time everything — invites, presence, and messages land instantly, not on a refresh.',
  },
]

const MOCK_MEMBERS = [
  { name: 'Nova', color: '#f2691c', leader: true, speaking: true },
  { name: 'Kessler', color: '#5fb87a', leader: false, speaking: false },
  { name: 'Byte', color: '#9aa0a8', leader: false, speaking: true },
  { name: 'Ari', color: '#e0a53a', leader: false, speaking: false },
]

export function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="carbon-weave min-h-screen w-full bg-base text-steel-100">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="" className="size-7 rounded-sm" />
          <span className="font-display text-sm font-bold tracking-widest text-steel-300">SQUADLINK</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/login')}>Log in</Button>
          <Button onClick={() => navigate('/register')}>Sign up free</Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6">
        {/* Hero */}
        <section className="grid items-center gap-12 py-16 md:grid-cols-2 md:py-24">
          <div className="anim-slide-up">
            <h1 className="font-display text-4xl font-bold leading-tight text-steel-100 sm:text-5xl">
              Connect. Play. <span className="text-orange-500">Together.</span>
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-steel-500">
              SquadLink is where your gaming crew lives — parties, voice, and chat in one fast,
              no-nonsense app. No clutter, no lag, no login walls between you and your squad.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={() => navigate('/register')}>
                Get started free <ChevronRight className="size-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/login')}>
                I already have an account
              </Button>
            </div>
          </div>

          {/* Product mockup — built from the app's own UI language rather than
              generic stock art, so it actually looks like what you'll get. */}
          <div className="anim-zoom-in relative">
            <div className="absolute -inset-6 -z-10 rounded-full bg-orange-500/10 blur-3xl" />
            <div className="bevel-lg border border-border bg-surface p-5 shadow-[var(--shadow-panel)]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-steel-100">Friday Night Squad</p>
                  <p className="text-xs text-steel-500">Valorant · 4/5 members</p>
                </div>
                <span className="bevel-sm bg-orange-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-400">
                  Live
                </span>
              </div>
              <div className="flex flex-col gap-2.5">
                {MOCK_MEMBERS.map((m) => (
                  <div key={m.name} className="flex items-center gap-3 bevel-sm bg-surface-2 px-3 py-2.5">
                    <Avatar name={m.name} color={m.color} size="sm" speaking={m.speaking} />
                    <span className="flex-1 text-sm font-medium text-steel-100">{m.name}</span>
                    {m.leader && <Crown className="size-3.5 text-orange-400" />}
                    {m.speaking && (
                      <div className="flex items-end gap-0.5">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="animate-speak-bar w-0.5 rounded-full bg-orange-500"
                            style={{ height: 10, animationDelay: `${i * 0.12}s` }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-border py-16 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-2xl font-bold text-steel-100 sm:text-3xl">
              Everything your squad actually uses
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-steel-500">
              No feature bloat — just the essentials for staying connected while you play.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bevel-md border border-border bg-surface p-6 transition-colors hover:border-orange-500/30">
                <div className="bevel-sm mb-4 flex size-10 items-center justify-center border border-orange-500/30 bg-orange-500/10 text-orange-500">
                  <Icon className="size-5" />
                </div>
                <h3 className="font-display text-base font-semibold text-steel-100">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-steel-500">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-border py-16 text-center md:py-24">
          <h2 className="font-display text-2xl font-bold text-steel-100 sm:text-3xl">
            Your squad is waiting.
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-sm text-steel-500">
            Create an account in under a minute — no credit card, no fuss.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" onClick={() => navigate('/register')}>
              Create free account <ChevronRight className="size-4" />
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 text-xs text-steel-700 sm:flex-row">
          <div className="flex items-center gap-2">
            <img src={logo} alt="" className="size-4 rounded-sm opacity-70" />
            <span>SquadLink</span>
          </div>
          <span>Connect · Play · Together</span>
        </div>
      </footer>
    </div>
  )
}
