import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { AuthGate, RequireAuth, RequireGuest, RootRoute } from '@/lib/auth/guards'

import { SplashScreen } from '@/features/onboarding/SplashScreen'
import { OnboardingPage } from '@/features/onboarding/OnboardingPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { VerifyEmailPage } from '@/features/auth/VerifyEmailPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { OAuthCallbackPage } from '@/features/auth/OAuthCallbackPage'

import { HomePage } from '@/features/home/HomePage'
import { FriendsPage } from '@/features/friends/FriendsPage'
import { MessagesPage } from '@/features/messaging/MessagesPage'
import { PartyPage } from '@/features/party/PartyPage'
import { VoiceRoomPage } from '@/features/voice/VoiceRoomPage'
import { CommunitiesPage } from '@/features/communities/CommunitiesPage'
import { CommunityDetailPage } from '@/features/communities/CommunityDetailPage'
import { NotificationsPage } from '@/features/notifications/NotificationsPage'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { SearchPage } from '@/features/search/SearchPage'
import { OverlayPage } from '@/features/overlay/OverlayPage'

import { NotFoundPage } from '@/features/errors/NotFoundPage'
import { ServerErrorPage } from '@/features/errors/ServerErrorPage'
import { NetworkErrorPage } from '@/features/errors/NetworkErrorPage'
import { OfflinePage } from '@/features/errors/OfflinePage'
import { CallOverlay } from '@/components/shared/CallOverlay'
import { PartyInviteOverlay } from '@/components/shared/PartyInviteOverlay'
import { StartAnimation } from '@/components/shared/StartAnimation'

const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function App() {
  // Overlay only — it renders on top of AuthGate/Routes below, which mount
  // and start their real work (session bootstrap, route render) immediately
  // and in parallel, so the intro never adds to actual load time.
  const [showIntro, setShowIntro] = useState(!prefersReducedMotion)

  return (
    <BrowserRouter>
      <AuthGate>
        <Routes>
          {/* Public landing page for logged-out visitors; redirects to /home when authenticated */}
          <Route path="/" element={<RootRoute />} />

          {/* Onboarding — public, no shell */}
          <Route path="/splash" element={<SplashScreen />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/oauth/callback" element={<OAuthCallbackPage />} />

          {/* Auth — guest-only, no shell */}
          <Route element={<RequireGuest />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>

          {/* Error / status pages — no app shell */}
          <Route path="/error/500" element={<ServerErrorPage />} />
          <Route path="/error/network" element={<NetworkErrorPage />} />
          <Route path="/error/offline" element={<OfflinePage />} />

          {/* Main app — requires an authenticated session, behind shell (sidebar + topbar) */}
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route path="/home" element={<HomePage />} />
              <Route path="/friends" element={<FriendsPage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/party" element={<PartyPage />} />
              <Route path="/voice" element={<VoiceRoomPage />} />
              <Route path="/communities" element={<CommunitiesPage />} />
              <Route path="/communities/:id" element={<CommunityDetailPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/overlay" element={<OverlayPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <CallOverlay />
        <PartyInviteOverlay />
      </AuthGate>
      {showIntro && <StartAnimation onFinish={() => setShowIntro(false)} />}
    </BrowserRouter>
  )
}
