import { useNavigate } from 'react-router-dom'
import { Plus, UserPlus, Bell } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dropdown } from '@/components/ui/Dropdown'
import { Avatar } from '@/components/ui/Avatar'
import { useAppData } from '@/lib/realtime/AppDataContext'
import { notificationsApi } from '@/lib/api/notifications'
import { useEffect, useState } from 'react'
import type { ApiNotification } from '@/lib/api/types'

export function Topbar({ title }: { title: string }) {
  const navigate = useNavigate()
  const { unreadNotifications } = useAppData()
  const [recent, setRecent] = useState<ApiNotification[]>([])

  // Preview list is fetched lazily the first time the bell dropdown would
  // have something to show, rather than on every render of the shell.
  useEffect(() => {
    if (unreadNotifications === 0) return
    notificationsApi
      .list(1, 4)
      .then((res) => setRecent(res.items.filter((n) => !n.read)))
      .catch(() => {})
  }, [unreadNotifications])

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface/60 px-6 backdrop-blur">
      <h2 className="font-display text-lg font-semibold tracking-wide text-steel-200">{title}</h2>
      <div className="flex items-center gap-2.5">
        <Button size="sm" variant="outline" onClick={() => navigate('/friends?tab=add')}>
          <UserPlus className="size-4" /> Add Friend
        </Button>
        <Button size="sm" onClick={() => navigate('/party')}>
          <Plus className="size-4" /> Create Party
        </Button>
        <Dropdown
          align="end"
          trigger={
            <button className="focus-ring relative flex size-10 items-center justify-center rounded-sm text-steel-400 hover:bg-surface-2 hover:text-steel-100">
              <Bell className="size-[18px]" />
              {unreadNotifications > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-orange-500" />}
            </button>
          }
          items={[
            ...(recent.length > 0
              ? recent.slice(0, 4).map((n) => ({
                  label: n.body.length > 40 ? n.body.slice(0, 40) + '…' : n.body,
                  icon: n.actor ? <Avatar name={n.actor.displayName} color={n.actor.avatarColor} size="xs" /> : <Bell className="size-4 text-steel-500" />,
                  onClick: () => navigate('/notifications'),
                }))
              : [{ label: unreadNotifications > 0 ? 'Loading…' : 'No new notifications', onClick: () => navigate('/notifications') }]),
            { label: '', divider: true },
            { label: 'View all notifications', onClick: () => navigate('/notifications') },
          ]}
        />
      </div>
    </header>
  )
}
