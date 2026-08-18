import { NavLink, useNavigate } from 'react-router-dom'
import type { MouseEvent } from 'react'
import {
  Home, Users, MessageSquare, Swords, Compass, Bell, Search, Settings, Plus, LogOut,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Tooltip } from '@/components/ui/Tooltip'
import { useToast } from '@/components/ui/Toast'
import { VoiceStatusBar } from './VoiceStatusBar'
import { useAppData } from '@/lib/realtime/AppDataContext'
import { useAuth } from '@/lib/auth/AuthContext'
import { cn } from '@/lib/utils'
import { presenceToUi } from '@/lib/adapters'
import { communityAccent } from '@/lib/color'
import logo from '@/assets/logo.png'

const NAV = [
  { to: '/home', label: 'Home', icon: Home, end: true },
  { to: '/friends', label: 'Friends', icon: Users },
  { to: '/messages', label: 'Messages', icon: MessageSquare },
  { to: '/party', label: 'Party', icon: Swords },
  { to: '/communities', label: 'Communities', icon: Compass },
]

export function Sidebar() {
  const navigate = useNavigate()
  const { profile, communities, unreadNotifications } = useAppData()
  const { logout } = useAuth()
  const { push } = useToast()

  async function handleLogout(e: MouseEvent) {
    e.stopPropagation()
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch {
      push({ kind: 'error', title: "Couldn't log out", description: 'Try again.' })
    }
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-4">
        <img src={logo} alt="SquadLink" className="size-8 rounded-sm" />
        <div className="leading-tight">
          <p className="font-display text-base font-bold tracking-wide text-steel-100">SQUADLINK</p>
          <p className="text-[10px] font-medium uppercase tracking-widest text-steel-600">Connect · Play · Together</p>
        </div>
      </div>

      <button
        onClick={() => navigate('/search')}
        className="focus-ring mx-3 mt-3 flex items-center gap-2 rounded-sm border border-border bg-surface-2 px-3 py-2 text-left text-sm text-steel-600 hover:border-border-strong"
      >
        <Search className="size-4" />
        Quick search…
      </button>

      <nav className="flex flex-col gap-0.5 px-3 py-3">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'focus-ring group flex items-center justify-between rounded-sm px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-orange-500/12 text-orange-400' : 'text-steel-400 hover:bg-surface-2 hover:text-steel-100',
              )
            }
          >
            {({ isActive }) => (
              <span className="flex items-center gap-3">
                <Icon className={cn('size-[18px]', isActive ? 'text-orange-500' : 'text-steel-500 group-hover:text-steel-200')} />
                {label}
              </span>
            )}
          </NavLink>
        ))}
        <NavLink
          to="/notifications"
          className={({ isActive }) =>
            cn('focus-ring flex items-center justify-between rounded-sm px-3 py-2.5 text-sm font-medium transition-colors', isActive ? 'bg-orange-500/12 text-orange-400' : 'text-steel-400 hover:bg-surface-2 hover:text-steel-100')
          }
        >
          <span className="flex items-center gap-3">
            <Bell className="size-[18px] text-steel-500" />
            Notifications
          </span>
          {unreadNotifications > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-black">{unreadNotifications}</span>
          )}
        </NavLink>
      </nav>

      <div className="mt-1 flex items-center justify-between px-6 py-2">
        <span className="text-[11px] font-bold uppercase tracking-widest text-steel-700">Communities</span>
        <Tooltip content="Browse communities">
          <button onClick={() => navigate('/communities')} className="focus-ring text-steel-600 hover:text-orange-400">
            <Plus className="size-3.5" />
          </button>
        </Tooltip>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-2">
        {communities.map((c) => (
          <NavLink
            key={c.id}
            to={`/communities/${c.id}`}
            className={({ isActive }) =>
              cn('focus-ring flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors', isActive ? 'bg-surface-2 text-steel-100' : 'text-steel-400 hover:bg-surface-2 hover:text-steel-100')
            }
          >
            <span className="bevel-sm flex size-7 shrink-0 items-center justify-center text-[10px] font-display font-bold text-black" style={{ backgroundColor: c.accentColor || communityAccent(c.id) }}>
              {c.tag.slice(0, 2)}
            </span>
            <span className="min-w-0 flex-1 truncate">{c.name}</span>
          </NavLink>
        ))}
      </div>

      <VoiceStatusBar />

      <button
        onClick={() => navigate('/profile')}
        className="focus-ring flex items-center gap-2.5 border-t border-border px-3 py-3 text-left hover:bg-surface-2"
      >
        <Avatar name={profile?.displayName ?? '…'} color={profile?.avatarColor ?? '#f2691c'} status={profile ? presenceToUi(profile.status) : 'offline'} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-steel-100">{profile?.displayName ?? 'Loading…'}</p>
          <p className="truncate text-xs text-steel-500">{profile?.statusText ?? (profile?.currentGame ?? '')}</p>
        </div>
        <Tooltip content="Settings">
          <span
            onClick={(e) => { e.stopPropagation(); navigate('/settings') }}
            className="focus-ring flex size-8 items-center justify-center rounded-sm text-steel-500 hover:bg-surface-3 hover:text-steel-100"
          >
            <Settings className="size-4" />
          </span>
        </Tooltip>
        <Tooltip content="Log out">
          <span
            onClick={handleLogout}
            className="focus-ring flex size-8 items-center justify-center rounded-sm text-steel-500 hover:bg-danger/20 hover:text-[#ff8570]"
          >
            <LogOut className="size-4" />
          </span>
        </Tooltip>
      </button>
    </aside>
  )
}
