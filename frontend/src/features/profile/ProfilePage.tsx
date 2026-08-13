import { useNavigate } from 'react-router-dom'
import { Settings2, Lock, Calendar, Gamepad2, Users, Compass } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/shared/Skeleton'
import { useAppData } from '@/lib/realtime/AppDataContext'
import { useApiData } from '@/lib/hooks/useApiData'
import { friendsApi } from '@/lib/api/friends'
import { presenceToUi } from '@/lib/adapters'

export function ProfilePage() {
  const navigate = useNavigate()
  const { profile, communities } = useAppData()
  const friendsState = useApiData(() => friendsApi.list(), [])
  const friendsList = friendsState.status === 'success' || friendsState.status === 'empty' ? friendsState.data : []
  const onlineFriends = friendsList.filter((entry) => entry.friend.status !== 'OFFLINE').length

  if (!profile) {
    return <div className="mx-auto max-w-4xl px-6 py-6"><Skeleton className="h-28 w-full" /><Skeleton className="mt-4 h-40 w-full" /></div>
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <div className="bevel-lg overflow-hidden border border-border bg-surface">
        <div className="h-28" style={{ background: `linear-gradient(135deg, ${profile.bannerAccent}, #0a0a0b)` }} />
        <div className="px-6 pb-6">
          <div className="-mt-12 flex items-end justify-between">
            <Avatar name={profile.displayName} color={profile.avatarColor} status={presenceToUi(profile.status)} size="xl" className="ring-4 ring-surface rounded-full" />
            <div className="flex gap-2 pb-1">
              <Button variant="outline" onClick={() => navigate('/settings')}><Settings2 className="size-4" /> Edit Profile</Button>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-steel-100">{profile.displayName}</h1>
            <Badge variant="orange">Lv. {profile.level}</Badge>
          </div>
          <p className="text-sm text-steel-500">@{profile.handle}{profile.statusText ? ` · ${profile.statusText}` : ''}</p>
          {profile.bio && <p className="mt-3 max-w-xl text-sm leading-relaxed text-steel-400">{profile.bio}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-steel-500">
            <span className="flex items-center gap-1.5"><Calendar className="size-3.5" /> Joined {new Date(profile.joinedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
            {profile.currentGame && <span className="flex items-center gap-1.5"><Gamepad2 className="size-3.5" /> Playing {profile.currentGame}</span>}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Communities</CardTitle><Compass className="size-4 text-orange-500" /></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {communities.length === 0 ? (
                <p className="text-sm text-steel-600">You haven't joined any communities yet.</p>
              ) : (
                communities.map((c) => (
                  <button key={c.id} onClick={() => navigate(`/communities/${c.id}`)} className="focus-ring flex items-center justify-between rounded-sm px-1 py-1.5 text-left hover:bg-surface-2">
                    <span className="text-sm font-medium text-steel-200">{c.name}</span>
                    <span className="text-xs text-steel-500">{c.memberCount.toLocaleString()} members</span>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader><CardTitle>Stats</CardTitle><Users className="size-4 text-steel-500" /></CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between"><span className="text-steel-500">Friends</span><span className="font-semibold text-steel-100">{friendsList.length}</span></div>
              <div className="flex justify-between"><span className="text-steel-500">Online now</span><span className="font-semibold text-success">{onlineFriends}</span></div>
              <div className="flex justify-between"><span className="text-steel-500">Communities</span><span className="font-semibold text-steel-100">{communities.length}</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Privacy</CardTitle>
              <Lock className="size-4 text-steel-500" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-steel-500">Control who can see your activity and send you requests.</p>
              <Button variant="outline" className="mt-3 w-full justify-center" onClick={() => navigate('/settings?tab=privacy')}>Manage Privacy</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
