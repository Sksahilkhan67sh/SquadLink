import { io, type Socket } from 'socket.io-client'
import { env } from '../env'
import { getAccessToken } from '../api/http'
import type { ApiMessage, ApiNotification, PresenceStatusApi } from '../api/types'

export interface ServerToClientEvents {
  'message:created': (message: ApiMessage) => void
  'message:updated': (message: ApiMessage) => void
  'message:notify': (message: ApiMessage) => void
  'typing:update': (data: { conversationId: string; userId: string; typing: boolean }) => void
  'presence:update': (data: { userId: string; status: PresenceStatusApi }) => void
  'notification:created': (notification: ApiNotification) => void
  'party:updated': (data: unknown) => void
  'call:incoming': (data: { callId: string; partyId: string; partyName: string; callerId: string; callerName: string; callerAvatarColor: string }) => void
  'call:ringing': (data: { callId: string; partyId: string }) => void
  'call:accepted': (data: { callId: string; partyId: string; userId: string }) => void
  'call:declined': (data: { callId: string; partyId: string; userId: string }) => void
  'call:cancelled': (data: { callId: string; partyId: string }) => void
  'call:missed': (data: { callId: string; partyId: string }) => void
  error: (data: { message: string }) => void
}

export interface ClientToServerEvents {
  'conversation:join': (data: { conversationId: string }) => void
  'conversation:leave': (data: { conversationId: string }) => void
  'typing:start': (data: { conversationId: string }) => void
  'typing:stop': (data: { conversationId: string }) => void
  'party:join': (data: { partyId: string }) => void
  'party:leave': (data: { partyId: string }) => void
  'call:invite': (data: { partyId: string }) => void
  'call:respond': (data: { callId: string; accept: boolean }) => void
  'call:cancel': (data: { callId: string }) => void
}

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null

/**
 * Connects the realtime socket using the current in-memory access token.
 * Call after a successful login/session bootstrap; call `disconnectSocket()`
 * on logout. Reconnection re-reads the token each attempt so a refreshed
 * token is picked up automatically.
 */
export function connectSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (socket?.connected) return socket

  socket = io(`${env.socketUrl}/realtime`, {
    autoConnect: true,
    withCredentials: true,
    auth: (cb) => cb({ token: getAccessToken() }),
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
  })

  return socket
}

export function getSocket() {
  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}
