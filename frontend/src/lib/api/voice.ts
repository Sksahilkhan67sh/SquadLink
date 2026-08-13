import { http } from './http'
import type { ApiVoiceToken } from './types'

export const voiceApi = {
  joinChannel: (channelId: string) => http.post<ApiVoiceToken>(`/voice/channels/${channelId}/join`),

  reconnect: (roomName: string) => http.post<ApiVoiceToken>('/voice/reconnect', { roomName }),
}
