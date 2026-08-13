import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ToastProvider } from '@/components/ui/Toast'
import { AuthProvider } from '@/lib/auth/AuthContext'
import { AppDataProvider } from '@/lib/realtime/AppDataContext'
import { VoiceSessionProvider } from '@/lib/realtime/VoiceSessionContext'
import { CallProvider } from '@/lib/realtime/CallContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <AuthProvider>
        <AppDataProvider>
          <VoiceSessionProvider>
            <CallProvider>
              <App />
            </CallProvider>
          </VoiceSessionProvider>
        </AppDataProvider>
      </AuthProvider>
    </ToastProvider>
  </StrictMode>,
)
