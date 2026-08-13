import { MessageSquare, Swords, UserMinus, Gamepad2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { Friend } from '@/types'
import { timeAgo } from '@/lib/utils'

const STATUS_LABEL: Record<string, string> = {
  online: 'Online', 'in-game': 'In Game', idle: 'Idle', 'do-not-disturb': 'Do Not Disturb', offline: 'Offline',
}

export function FriendProfileModal({ friend, onClose, onMessage, onRemove }: {
  friend: Friend | null
  onClose: () => void
  onMessage: (f: Friend) => void
  onRemove: (f: Friend) => void
}) {
  return (
    <Modal open={!!friend} onClose={onClose}>
      {friend && (
        <div>
          <div className="-m-5 mb-4 h-20" style={{ background: `linear-gradient(135deg, ${friend.bannerAccent}, #0a0a0b)` }} />
          <div className="-mt-14 mb-3 flex items-end gap-4 px-1">
            <Avatar name={friend.displayName} color={friend.avatarColor} status={friend.status} size="xl" className="ring-4 ring-surface-2 rounded-full" />
            <div className="mb-1">
              <Badge variant="orange">Lv. {friend.level}</Badge>
            </div>
          </div>
          <h2 className="font-display text-xl font-bold text-steel-100">{friend.displayName}</h2>
          <p className="text-sm text-steel-500">@{friend.handle} · {STATUS_LABEL[friend.status]}</p>
          {friend.bio && <p className="mt-3 text-sm leading-relaxed text-steel-400">{friend.bio}</p>}

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="bevel-sm border border-border bg-surface-2 p-3">
              <p className="text-xs text-steel-600">Last played</p>
              <p className="mt-1 flex items-center gap-1.5 font-medium text-steel-200"><Gamepad2 className="size-3.5" /> {friend.lastPlayed?.game ?? '—'}</p>
              {friend.lastPlayed && <p className="text-xs text-steel-600">{timeAgo(friend.lastPlayed.date)} ago</p>}
            </div>
            <div className="bevel-sm border border-border bg-surface-2 p-3">
              <p className="text-xs text-steel-600">Mutual communities</p>
              <p className="mt-1 font-medium text-steel-200">{friend.mutualCommunities}</p>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <Button className="flex-1" onClick={() => onMessage(friend)}>
              <MessageSquare className="size-4" /> Message
            </Button>
            <Button variant="secondary" className="flex-1">
              <Swords className="size-4" /> Invite to Party
            </Button>
            <Button variant="danger" size="icon" onClick={() => onRemove(friend)} aria-label="Remove friend">
              <UserMinus className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
