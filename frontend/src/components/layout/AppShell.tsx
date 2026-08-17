import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

const TITLES: Record<string, string> = {
  '/home': 'Home',
  '/friends': 'Friends',
  '/messages': 'Messages',
  '/party': 'Party',
  '/communities': 'Communities',
  '/notifications': 'Notifications',
  '/profile': 'Profile',
  '/settings': 'Settings',
  '/search': 'Search',
  '/voice': 'Voice Room',
}

function resolveTitle(pathname: string) {
  if (TITLES[pathname]) return TITLES[pathname]
  const base = '/' + pathname.split('/')[1]
  return TITLES[base] ?? 'SquadLink'
}

export function AppShell() {
  const location = useLocation()
  return (
    <div className="flex h-screen w-full overflow-hidden bg-base">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={resolveTitle(location.pathname)} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
