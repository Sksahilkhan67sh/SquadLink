# SquadLink — Frontend (Phase 1)

A premium, desktop-first communication platform for gamers and streamers.
Frontend only — mock data throughout, ready to wire up to a backend in Phase 2.

## Stack

- Vite + React 19 + TypeScript (strict)
- Tailwind CSS v4
- React Router v7
- Lucide React icons
- Feature-based folder structure

## Getting started

```bash
npm install
npm run dev
```

Open the printed local URL (usually http://localhost:5173).

```bash
npm run build     # type-check + production build -> dist/
npm run preview   # preview the production build locally
npm run lint       # oxlint
```

## Structure

```
src/
  assets/            brand logo
  components/
    ui/              design system primitives (Button, Card, Modal, Tabs, Toast, ...)
    layout/           Sidebar, Topbar, AppShell, VoiceStatusBar
    shared/           EmptyState, Skeleton, VoiceIndicator, PageHeader
  features/
    onboarding/       Splash screen, onboarding carousel
    auth/             Login, Register, Forgot/Reset password, Verify email
    home/             Dashboard
    friends/          Friend list, requests, add friend, profile modal
    messaging/        Conversations, chat, composer
    party/            Party creation, members, invites
    voice/            Voice room
    communities/       Browse + community detail (channels, members, events, roles)
    notifications/    Notification center
    profile/          User profile
    settings/         Account, Appearance, Audio, Notifications, Privacy, About
    search/           Global search
    overlay/          In-game overlay designer
    errors/           404, 500, network error, offline
  data/mock.ts        all mock data (users, friends, messages, parties, communities...)
  types/               shared TypeScript types
  lib/utils.ts         cn(), formatting helpers
```

## Design system

Colors, type, and the signature "beveled corner" motif (echoing the cut edges in the
SquadLink mark) are defined as CSS variables in `src/index.css` under `@theme`, and used
as Tailwind utilities (`bg-orange-500`, `text-steel-300`, `bevel-md`, etc.) throughout.

- **Palette:** matte black base, charcoal surfaces, orange accent, steel grays only.
- **Type:** Rajdhani (display/headings), Inter (body), JetBrains Mono (stats/ids).
- **Motion:** subtle -- fade, scale, slide. Respects `prefers-reduced-motion`.

## Notes for Phase 2

- All data lives in `src/data/mock.ts` -- swap for real API calls / a data-fetching layer.
- Auth pages simulate network delay with `setTimeout`; replace with real auth calls.
- The persistent voice bar in the sidebar and the Voice Room page currently drive local
  component state -- wire to your real-time voice/signaling layer.
