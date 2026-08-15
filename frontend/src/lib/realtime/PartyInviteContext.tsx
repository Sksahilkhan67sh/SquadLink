import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { getSocket, type PartyInviteEvent } from './socket'
import { useVoiceSession } from './VoiceSessionContext'
import { partyApi } from '../api/party'
import { useToast } from '@/components/ui/Toast'

interface PartyInviteContextValue {
  /** Oldest pending invite — shown as a popup until accepted/declined. */
  incomingInvite: PartyInviteEvent | null
  /** Count of invites queued behind the one currently shown. */
  queuedCount: number
  responding: boolean
  acceptInvite: () => Promise<void>
  declineInvite: () => Promise<void>
}

const PartyInviteContext = createContext<PartyInviteContextValue | null>(null)

export function PartyInviteProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const { refreshActiveParty } = useVoiceSession()
  const { push } = useToast()
  const [queue, setQueue] = useState<PartyInviteEvent[]>([])
  const [responding, setResponding] = useState(false)

  useEffect(() => {
    if (status !== 'authenticated') {
      setQueue([])
      return
    }
    const socket = getSocket()
    if (!socket) return

    const onInvite = (data: PartyInviteEvent) => {
      setQueue((prev) => (prev.some((i) => i.id === data.id) ? prev : [...prev, data]))
    }

    socket.on('party:invite', onInvite)
    return () => {
      socket.off('party:invite', onInvite)
    }
  }, [status])

  const incomingInvite = queue[0] ?? null

  const acceptInvite = useCallback(async () => {
    if (!incomingInvite) return
    setResponding(true)
    try {
      await partyApi.acceptInvite(incomingInvite.id)
      await refreshActiveParty()
      push({ kind: 'success', title: 'Joined party', description: incomingInvite.partyName })
      setQueue((prev) => prev.filter((i) => i.id !== incomingInvite.id))
    } catch {
      push({ kind: 'error', title: "Couldn't join party" })
    } finally {
      setResponding(false)
    }
  }, [incomingInvite, refreshActiveParty, push])

  const declineInvite = useCallback(async () => {
    if (!incomingInvite) return
    setResponding(true)
    try {
      await partyApi.declineInvite(incomingInvite.id)
    } catch {
      // Already responded to or expired — either way it shouldn't keep showing.
    } finally {
      setQueue((prev) => prev.filter((i) => i.id !== incomingInvite.id))
      setResponding(false)
    }
  }, [incomingInvite])

  const value = useMemo(
    () => ({ incomingInvite, queuedCount: Math.max(0, queue.length - 1), responding, acceptInvite, declineInvite }),
    [incomingInvite, queue.length, responding, acceptInvite, declineInvite],
  )

  return <PartyInviteContext.Provider value={value}>{children}</PartyInviteContext.Provider>
}

export function usePartyInvite() {
  const ctx = useContext(PartyInviteContext)
  if (!ctx) throw new Error('usePartyInvite must be used within a PartyInviteProvider')
  return ctx
}
