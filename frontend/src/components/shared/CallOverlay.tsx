import { Phone, PhoneOff, PhoneCall, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { useCall } from '@/lib/realtime/CallContext'

export function CallOverlay() {
  const { incomingCall, outgoingCall, acceptIncomingCall, declineIncomingCall, cancelOutgoingCall } = useCall()

  return (
    <>
      {incomingCall && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="anim-slide-up bevel-lg carbon-weave w-full max-w-sm border border-orange-500/30 bg-surface p-8 text-center shadow-2xl">
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-orange-500">Incoming Voice Call</p>
            <div className="mx-auto my-5 flex justify-center">
              <span className="relative flex">
                <span className="absolute inset-0 animate-ping rounded-full bg-orange-500/40" />
                <Avatar name={incomingCall.callerName} color={incomingCall.callerAvatarColor} size="xl" className="relative" />
              </span>
            </div>
            <h3 className="font-display text-lg font-semibold text-steel-100">{incomingCall.callerName}</h3>
            <p className="mt-1 text-sm text-steel-500">is calling from {incomingCall.partyName}</p>
            <div className="mt-7 flex justify-center gap-4">
              <button
                onClick={declineIncomingCall}
                className="focus-ring flex size-14 items-center justify-center rounded-full bg-danger/20 text-[#ff8570] transition-transform hover:scale-105 hover:bg-danger/30"
              >
                <PhoneOff className="size-6" />
              </button>
              <button
                onClick={acceptIncomingCall}
                className="focus-ring flex size-14 items-center justify-center rounded-full bg-success text-black transition-transform hover:scale-105"
              >
                <Phone className="size-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      {outgoingCall && (
        <div className="anim-slide-up fixed bottom-5 left-1/2 z-[100] w-full max-w-xs -translate-x-1/2">
          <div className="bevel-md flex items-center gap-3 border border-orange-500/30 bg-surface-2 p-4 shadow-2xl">
            <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-orange-500">
              <span className="absolute inset-0 animate-ping rounded-full bg-orange-500/30" />
              <PhoneCall className="relative size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-steel-100">{outgoingCall.status === 'ringing' ? 'Calling…' : 'Ringing…'}</p>
              <p className="truncate text-xs text-steel-500">{outgoingCall.partyName}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={cancelOutgoingCall} aria-label="Cancel call">
              <X className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
