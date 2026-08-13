import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { usersApi } from '../api/users'
import { communitiesApi } from '../api/communities'
import { notificationsApi } from '../api/notifications'
import type { ApiCommunity, ApiUserPrivate } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { getSocket } from './socket'

interface AppDataContextValue {
  profile: ApiUserPrivate | null
  communities: ApiCommunity[]
  unreadNotifications: number
  refreshProfile: () => Promise<void>
  refreshCommunities: () => Promise<void>
  refreshUnreadCount: () => Promise<void>
}

const AppDataContext = createContext<AppDataContextValue | null>(null)

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const [profile, setProfile] = useState<ApiUserPrivate | null>(null)
  const [communities, setCommunities] = useState<ApiCommunity[]>([])
  const [unreadNotifications, setUnreadNotifications] = useState(0)

  const refreshProfile = useCallback(async () => {
    const me = await usersApi.me()
    setProfile(me)
  }, [])

  const refreshCommunities = useCallback(async () => {
    const list = await communitiesApi.listMine()
    setCommunities(list)
  }, [])

  const refreshUnreadCount = useCallback(async () => {
    const { count } = await notificationsApi.unreadCount()
    setUnreadNotifications(count)
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') {
      setProfile(null)
      setCommunities([])
      setUnreadNotifications(0)
      return
    }
    refreshProfile().catch(() => {})
    refreshCommunities().catch(() => {})
    refreshUnreadCount().catch(() => {})
  }, [status, refreshProfile, refreshCommunities, refreshUnreadCount])

  // Keep presence and unread counts live without polling.
  useEffect(() => {
    if (status !== 'authenticated') return
    const socket = getSocket()
    if (!socket) return

    const onNotificationCreated = () => setUnreadNotifications((n) => n + 1)
    socket.on('notification:created', onNotificationCreated)
    return () => {
      socket.off('notification:created', onNotificationCreated)
    }
  }, [status])

  const value = useMemo(
    () => ({ profile, communities, unreadNotifications, refreshProfile, refreshCommunities, refreshUnreadCount }),
    [profile, communities, unreadNotifications, refreshProfile, refreshCommunities, refreshUnreadCount],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData() {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData must be used within an AppDataProvider')
  return ctx
}
