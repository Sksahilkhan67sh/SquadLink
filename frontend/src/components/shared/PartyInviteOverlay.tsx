import { UserPlus, Check, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { usePartyInvite } from '@/lib/realtime/PartyInviteContext'

export function PartyInviteOverlay() {
  const { incomingInvite, queuedCount, responding, acceptInvite, declineInvite } = usePartyInvite()

  if (!incomingInvite) return null

  return (
    <div className="anim-slide-up fixed bottom-5 right-5 z-[100] w-full max-w-sm">
      <div className="bevel-lg carbon-weave border border-orange-500/30 bg-surface p-5 shadow-2xl">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-orange-500">Party Invite</p>
        <div className="flex items-center gap-3">
          <Avatar name={incomingInvite.inviterName} color={incomingInvite.inviterAvatarColor} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-steel-100">{incomingInvite.inviterName}</p>
            <p className="truncate text-xs text-steel-500">
              invited you to <span className="text-steel-300">{incomingInvite.partyName}</span>
              {incomingInvite.partyGame ? ` · ${incomingInvite.partyGame}` : ''}
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={declineInvite}
            disabled={responding}
            className="focus-ring flex flex-1 items-center justify-center gap-1.5 rounded-sm bg-danger/20 py-2 text-sm font-semibold text-[#ff8570] transition-colors hover:bg-danger/30 disabled:opacity-50"
          >
            <X className="size-4" /> Reject
          </button>
          <button
            onClick={acceptInvite}
            disabled={responding}
            className="focus-ring flex flex-1 items-center justify-center gap-1.5 rounded-sm bg-orange-500 py-2 text-sm font-semibold text-black transition-colors hover:bg-orange-400 disabled:opacity-50"
          >
            <Check className="size-4" /> Accept
          </button>
        </div>
        {queuedCount > 0 && (
          <p className="mt-3 flex items-center gap-1 text-xs text-steel-600">
            <UserPlus className="size-3" /> +{queuedCount} more invite{queuedCount === 1 ? '' : 's'} waiting
          </p>
        )}
      </div>
    </div>
  )
}
