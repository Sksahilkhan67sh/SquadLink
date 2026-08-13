import type { ReactNode } from 'react'
import logo from '@/assets/logo.png'

export function ErrorLayout({ code, icon, title, description, actions }: {
  code?: string
  icon: ReactNode
  title: string
  description: string
  actions: ReactNode
}) {
  return (
    <div className="carbon-weave flex h-screen w-full flex-col items-center justify-center bg-base px-6 text-center">
      <img src={logo} alt="SquadLink" className="mb-8 size-12 rounded-sm opacity-70" />
      <div className="bevel-md mb-6 flex size-20 items-center justify-center border border-orange-500/30 bg-orange-500/10 text-orange-500">
        {icon}
      </div>
      {code && <p className="font-display text-6xl font-bold tracking-widest text-steel-800">{code}</p>}
      <h1 className="mt-3 font-display text-xl font-bold text-steel-100">{title}</h1>
      <p className="mt-2 max-w-sm text-sm text-steel-500">{description}</p>
      <div className="mt-7 flex items-center gap-3">{actions}</div>
    </div>
  )
}
