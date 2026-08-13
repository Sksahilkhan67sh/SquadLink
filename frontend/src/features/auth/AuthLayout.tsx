import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import logo from '@/assets/logo.png'

export function AuthLayout({ title, subtitle, children, footer }: {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="carbon-weave grid h-screen w-full grid-cols-1 bg-base lg:grid-cols-2">
      <div className="hidden flex-col justify-between border-r border-border bg-surface p-10 lg:flex">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={logo} alt="SquadLink" className="size-9 rounded-sm" />
          <span className="font-display text-lg font-bold tracking-widest text-steel-100">SQUADLINK</span>
        </Link>
        <div className="max-w-md">
          <h2 className="font-display text-3xl font-bold leading-tight text-steel-100">
            Your squad is already <span className="text-orange-500">online.</span>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-steel-500">
            Voice, chat, and parties built for people who play together. No clutter, no noise — just your crew.
          </p>
        </div>
        <p className="text-xs text-steel-700">© 2026 SquadLink. All rights reserved.</p>
      </div>

      <div className="flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <img src={logo} alt="SquadLink" className="size-8 rounded-sm" />
            <span className="font-display text-base font-bold tracking-widest text-steel-100">SQUADLINK</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-steel-100">{title}</h1>
          <p className="mt-1.5 mb-8 text-sm text-steel-500">{subtitle}</p>
          {children}
          {footer && <div className="mt-6 text-center text-sm text-steel-500">{footer}</div>}
        </div>
      </div>
    </div>
  )
}
