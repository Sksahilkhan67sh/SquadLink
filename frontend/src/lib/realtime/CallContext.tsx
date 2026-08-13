import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { getSocket } from './socket'
import { useVoiceSession } from './VoiceSessionContext'
import { useToast } from '@/components/ui/Toast'

export interface IncomingCall {
  callId: string
  partyId: string
  partyName: string
  callerId: string
  callerName: string
  callerAvatarColor: string
}

export interface OutgoingCall {
  callId: string
  partyId: string
  partyName: string
  /** 'ringing' until the server acks the invite was sent; then waiting for a response. */
  status: 'ringing' | 'waiting'
}

interface CallContextValue {
  incomingCall: IncomingCall | null
  outgoingCall: OutgoingCall | null
  startPartyCall: (partyId: string, partyName: string) => void
  acceptIncomingCall: () => Promise<void>
  declineIncomingCall: () => void
  cancelOutgoingCall: () => void
}

const CallContext = createContext<CallContextValue | null>(null)

export function CallProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const { joinPartyVoice } = useVoiceSession()
  const { push } = useToast()
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null)
  const [outgoingCall, setOutgoingCall] = useState<OutgoingCall | null>(null)
  const outgoingRef = useRef<OutgoingCall | null>(null)
  outgoingRef.current = outgoingCall

  useEffect(() => {
    if (status !== 'authenticated') {
      setIncomingCall(null)
      setOutgoingCall(null)
      return
    }
    const socket = getSocket()
    if (!socket) return

    const onIncoming = (data: IncomingCall) => setIncomingCall(data)

    const onRinging = (data: { callId: string; partyId: string }) => {
      setOutgoingCall((prev) => (prev?.callId === data.callId ? { ...prev, status: 'waiting' } : prev))
    }

    const onAccepted = () => {
      push({ kind: 'success', title: 'Call accepted', description: 'Someone joined the call.' })
    }

    const onDeclined = () => {
      push({ kind: 'info', title: 'Call declined' })
    }

    const onCancelledOrMissed = (data: { callId: string }) => {
      setIncomingCall((prev) => (prev?.callId === data.callId ? null : prev))
      if (outgoingRef.current?.callId === data.callId) {
        setOutgoingCall(null)
        push({ kind: 'info', title: 'No one answered' })
      }
    }

    socket.on('call:incoming', onIncoming)
    socket.on('call:ringing', onRinging)
    socket.on('call:accepted', onAccepted)
    socket.on('call:declined', onDeclined)
    socket.on('call:cancelled', onCancelledOrMissed)
    socket.on('call:missed', onCancelledOrMissed)

    return () => {
      socket.off('call:incoming', onIncoming)
      socket.off('call:ringing', onRinging)
      socket.off('call:accepted', onAccepted)
      socket.off('call:declined', onDeclined)
      socket.off('call:cancelled', onCancelledOrMissed)
      socket.off('call:missed', onCancelledOrMissed)
    }
  }, [status, push])

  const startPartyCall = useCallback(
    (partyId: string, partyName: string) => {
      const socket = getSocket()
      if (!socket) return
      // Ring the rest of the party while connecting the caller to voice
      // immediately — matches how "start a call" behaves elsewhere: you're
      // in the room, others get an invite to join you.
      joinPartyVoice(partyId)
      const callId = crypto.randomUUID()
      setOutgoingCall({ callId, partyId, partyName, status: 'ringing' })
      socket.emit('call:invite', { partyId })
    },
    [joinPartyVoice],
  )

  const acceptIncomingCall = useCallback(async () => {
    if (!incomingCall) return
    const socket = getSocket()
    const { callId, partyId } = incomingCall
    socket?.emit('call:respond', { callId, accept: true })
    setIncomingCall(null)
    await joinPartyVoice(partyId)
  }, [incomingCall, joinPartyVoice])

  const declineIncomingCall = useCallback(() => {
    if (!incomingCall) return
    const socket = getSocket()
    socket?.emit('call:respond', { callId: incomingCall.callId, accept: false })
    setIncomingCall(null)
  }, [incomingCall])

  const cancelOutgoingCall = useCallback(() => {
    if (!outgoingCall) return
    const socket = getSocket()
    socket?.emit('call:cancel', { callId: outgoingCall.callId })
    setOutgoingCall(null)
  }, [outgoingCall])

  const value = useMemo(
    () => ({ incomingCall, outgoingCall, startPartyCall, acceptIncomingCall, declineIncomingCall, cancelOutgoingCall }),
    [incomingCall, outgoingCall, startPartyCall, acceptIncomingCall, declineIncomingCall, cancelOutgoingCall],
  )

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>
}

export function useCall() {
  const ctx = useContext(CallContext)
  if (!ctx) throw new Error('useCall must be used within a CallProvider')
  return ctx
}
