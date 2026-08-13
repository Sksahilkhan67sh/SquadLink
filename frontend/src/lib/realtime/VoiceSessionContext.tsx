import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Room, RoomEvent, Track, type RemoteTrack, type RemoteTrackPublication, type RemoteParticipant } from 'livekit-client'
import { partyApi } from '../api/party'
import type { ApiParty } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { getSocket } from './socket'
import { env } from '../env'

interface VoiceSessionValue {
  activeParty: ApiParty | null
  connected: boolean
  connecting: boolean
  muted: boolean
  deafened: boolean
  outputVolume: number
  speakingUserIds: Set<string>
  error: string | null
  refreshActiveParty: () => Promise<void>
  joinPartyVoice: (partyId: string) => Promise<void>
  leaveVoice: () => Promise<void>
  toggleMute: () => Promise<void>
  toggleDeafen: () => void
  setOutputVolume: (volume: number) => void
}

const VoiceSessionContext = createContext<VoiceSessionValue | null>(null)

export function VoiceSessionProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const [activeParty, setActiveParty] = useState<ApiParty | null>(null)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [muted, setMuted] = useState(false)
  const [deafened, setDeafened] = useState(false)
  const [outputVolumeState, setOutputVolumeState] = useState(80)
  const [speakingUserIds, setSpeakingUserIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const roomRef = useRef<Room | null>(null)
  // Remote LiveKit audio tracks are only *received* by the SDK — nothing plays
  // them until we attach() each subscribed track to a real <audio> element.
  // This container holds those elements (hidden; audio doesn't need to be
  // visible to play) so participants can actually hear each other.
  const audioContainerRef = useRef<HTMLDivElement | null>(null)
  const attachedElsRef = useRef<Map<string, HTMLMediaElement>>(new Map())

  const detachAllAudio = useCallback(() => {
    attachedElsRef.current.forEach((el) => el.remove())
    attachedElsRef.current.clear()
  }, [])

  const refreshActiveParty = useCallback(async () => {
    try {
      const party = await partyApi.getActive()
      setActiveParty(party)
    } catch {
      setActiveParty(null)
    }
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') {
      setActiveParty(null)
      return
    }
    refreshActiveParty()
  }, [status, refreshActiveParty])

  useEffect(() => {
    const socket = getSocket()
    if (!socket || status !== 'authenticated') return
    const onPartyUpdated = () => refreshActiveParty()
    socket.on('party:updated', onPartyUpdated)
    return () => {
      socket.off('party:updated', onPartyUpdated)
    }
  }, [status, refreshActiveParty])
  
  useEffect(() => {
  const socket = getSocket()
  const partyId = activeParty?.id
  if (!socket || status !== 'authenticated' || !partyId) return

  socket.emit('party:join', { partyId })
  return () => {
    socket.emit('party:leave', { partyId })
  }
}, [status, activeParty?.id])

  

  const teardownRoom = useCallback(() => {
    roomRef.current?.disconnect()
    roomRef.current = null
    detachAllAudio()
    setConnected(false)
    setSpeakingUserIds(new Set())
  }, [detachAllAudio])

  const leaveVoice = useCallback(async () => {
    teardownRoom()
  }, [teardownRoom])

  const joinPartyVoice = useCallback(
    async (partyId: string) => {
      setError(null)
      setConnecting(true)
      try {
        const grant = await partyApi.voiceToken(partyId)
        const room = new Room({ adaptiveStream: true, dynacast: true })

        room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          setSpeakingUserIds(new Set(speakers.map((s) => s.identity)))
        })
        room.on(RoomEvent.Disconnected, () => {
          detachAllAudio()
          setConnected(false)
          roomRef.current = null
        })

        // Without this, remote mic tracks are subscribed but never played —
        // this is what actually lets participants hear each other.
        room.on(
          RoomEvent.TrackSubscribed,
          (track: RemoteTrack, publication: RemoteTrackPublication, _participant: RemoteParticipant) => {
            if (track.kind !== Track.Kind.Audio) return
            const el = track.attach() as HTMLMediaElement
            el.autoplay = true
            attachedElsRef.current.set(publication.trackSid, el)
            audioContainerRef.current?.appendChild(el)
          },
        )
        room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, publication: RemoteTrackPublication) => {
          if (track.kind !== Track.Kind.Audio) return
          track.detach().forEach((el) => el.remove())
          attachedElsRef.current.delete(publication.trackSid)
        })

        await room.connect(grant.url || env.livekitUrl, grant.token)
        await room.localParticipant.setMicrophoneEnabled(!muted)

        roomRef.current = room
        setConnected(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect to voice.')
        teardownRoom()
      } finally {
        setConnecting(false)
      }
    },
    [muted, teardownRoom],
  )

  const setOutputVolume = useCallback((volume: number) => {
    setOutputVolumeState(volume)
    roomRef.current?.remoteParticipants.forEach((p) => p.setVolume(volume / 100))
  }, [])

  // The public `toggleMute`/`toggleDeafen` need this to be defined above, but
  // `joinPartyVoice` also needs to apply the current output volume to a
  // freshly connected room's participants as they subscribe.
  useEffect(() => {
    const room = roomRef.current
    if (!room || !connected) return
    const applyVolume = () => room.remoteParticipants.forEach((p) => p.setVolume(deafened ? 0 : outputVolumeState / 100))
    applyVolume()
    room.on(RoomEvent.TrackSubscribed, applyVolume)
    return () => {
      room.off(RoomEvent.TrackSubscribed, applyVolume)
    }
  }, [connected, outputVolumeState, deafened])

  const toggleMute = useCallback(async () => {
    const next = !muted
    setMuted(next)
    await roomRef.current?.localParticipant.setMicrophoneEnabled(!next)
    if (activeParty) {
      partyApi.setVoiceState(activeParty.id, { muted: next }).catch(() => {})
    }
  }, [muted, activeParty])

  const toggleDeafen = useCallback(() => {
    const next = !deafened
    setDeafened(next)
    // Deafening sets remote playback volume to 0 via LiveKit's participant
    // API (same mechanism as the output-volume slider) rather than reaching
    // into the DOM; also force-mutes the mic, since if you can't hear the
    // party you shouldn't be broadcasting to it either.
    roomRef.current?.remoteParticipants.forEach((p) => p.setVolume(next ? 0 : outputVolumeState / 100))
    if (next && !muted) {
      setMuted(true)
      roomRef.current?.localParticipant.setMicrophoneEnabled(false)
      if (activeParty) partyApi.setVoiceState(activeParty.id, { muted: true, deafened: true }).catch(() => {})
    } else if (activeParty) {
      partyApi.setVoiceState(activeParty.id, { deafened: next }).catch(() => {})
    }
  }, [deafened, muted, activeParty, outputVolumeState])

  // Clean up the LiveKit connection on logout so we don't leak a live mic.
  useEffect(() => {
    if (status !== 'authenticated') teardownRoom()
  }, [status, teardownRoom])

  const value = useMemo(
    () => ({
      activeParty,
      connected,
      connecting,
      muted,
      deafened,
      outputVolume: outputVolumeState,
      speakingUserIds,
      error,
      refreshActiveParty,
      joinPartyVoice,
      leaveVoice,
      toggleMute,
      toggleDeafen,
      setOutputVolume,
    }),
    [activeParty, connected, connecting, muted, deafened, outputVolumeState, speakingUserIds, error, refreshActiveParty, joinPartyVoice, leaveVoice, toggleMute, toggleDeafen, setOutputVolume],
  )

  return (
    <VoiceSessionContext.Provider value={value}>
      {children}
      {/* Hidden mount point for remote participants' <audio> elements — see TrackSubscribed above. */}
      <div ref={audioContainerRef} style={{ display: 'none' }} aria-hidden="true" />
    </VoiceSessionContext.Provider>
  )
}

export function useVoiceSession() {
  const ctx = useContext(VoiceSessionContext)
  if (!ctx) throw new Error('useVoiceSession must be used within a VoiceSessionProvider')
  return ctx
}
