import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Mic, User, Palette, Bell, Lock, Info, Camera, LogOut } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Input, Label, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Switch, Radio } from '@/components/ui/Toggle'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useAppData } from '@/lib/realtime/AppDataContext'
import { useAuth } from '@/lib/auth/AuthContext'
import { usersApi } from '@/lib/api/users'
import { settingsApi } from '@/lib/api/settings'
import { uploadsApi, UploadValidationError } from '@/lib/api/uploads'
import { ApiError } from '@/lib/api/http'
import { presenceToUi } from '@/lib/adapters'
import { cn } from '@/lib/utils'
import logo from '@/assets/logo.png'

const SECTIONS = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'audio', label: 'Audio', icon: Mic },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'privacy', label: 'Privacy', icon: Lock },
  { id: 'about', label: 'About', icon: Info },
]

export function SettingsPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [active, setActive] = useState(params.get('tab') ?? 'account')
  const { push } = useToast()
  const { profile, refreshProfile } = useAppData()
  const { logout } = useAuth()

  // Account fields
  const [displayName, setDisplayName] = useState('')
  const [handle, setHandle] = useState('')
  const [bio, setBio] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [savingAccount, setSavingAccount] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName)
      setHandle(profile.handle)
      setBio(profile.bio ?? '')
    }
  }, [profile])

  // Preferences — loaded once from the backend, then edited locally and
  // persisted per-field so a page refresh never loses unsaved intent for
  // longer than the debounce below.
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  const [accentTheme, setAccentTheme] = useState<'orange' | 'steel'>('orange')
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable')
  const [inputVol, setInputVol] = useState(72)
  const [outputVol, setOutputVol] = useState(85)
  const [noiseSuppress, setNoiseSuppress] = useState(true)
  const [pushToTalk, setPushToTalk] = useState(false)
  const [notifDM, setNotifDM] = useState(true)
  const [notifParty, setNotifParty] = useState(true)
  const [notifCommunity, setNotifCommunity] = useState(false)
  const [notifSound, setNotifSound] = useState(true)
  const [showActivity, setShowActivity] = useState(true)
  const [allowRequests, setAllowRequests] = useState<'everyone' | 'friends-of-friends' | 'none'>('friends-of-friends')

  useEffect(() => {
    settingsApi
      .getPreferences()
      .then((p) => {
        setAccentTheme((p.accentTheme as 'orange' | 'steel') ?? 'orange')
        setDensity((p.density as 'comfortable' | 'compact') ?? 'comfortable')
        setInputVol(p.inputVolume ?? 72)
        setOutputVol(p.outputVolume ?? 85)
        setNoiseSuppress(p.noiseSuppression ?? true)
        setPushToTalk(p.pushToTalk ?? false)
        setNotifDM(p.notifyDirectMessage ?? true)
        setNotifParty(p.notifyPartyInvite ?? true)
        setNotifCommunity(p.notifyCommunity ?? false)
        setNotifSound(p.notifySound ?? true)
        setShowActivity(p.showActivityStatus ?? true)
        setAllowRequests((p.allowFriendRequests as typeof allowRequests) ?? 'friends-of-friends')
      })
      .catch(() => push({ kind: 'error', title: "Couldn't load preferences" }))
      .finally(() => setPrefsLoaded(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function savePreferences(partial: Record<string, unknown>) {
    try {
      await settingsApi.updatePreferences(partial)
    } catch {
      push({ kind: 'error', title: "Couldn't save setting", description: 'Try again.' })
    }
  }

  async function saveAccount() {
    setSavingAccount(true)
    try {
      await usersApi.updateProfile({ displayName, handle, bio })
      await refreshProfile()
      push({ kind: 'success', title: 'Profile updated' })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) push({ kind: 'error', title: 'That handle is already taken' })
      else push({ kind: 'error', title: "Couldn't save changes" })
    } finally {
      setSavingAccount(false)
    }
  }

  async function changePassword() {
    if (!currentPassword || newPassword.length < 8) return
    setChangingPassword(true)
    try {
      await settingsApi.changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      push({ kind: 'success', title: 'Password changed' })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) push({ kind: 'error', title: 'Current password is incorrect' })
      else push({ kind: 'error', title: "Couldn't change password" })
    } finally {
      setChangingPassword(false)
    }
  }

  async function handleAvatarChange(file: File) {
    setUploadingAvatar(true)
    try {
      await uploadsApi.uploadAvatar(file)
      await refreshProfile()
      push({ kind: 'success', title: 'Avatar updated' })
    } catch (err) {
      if (err instanceof UploadValidationError) push({ kind: 'error', title: 'Invalid image', description: err.message })
      else push({ kind: 'error', title: "Couldn't upload avatar" })
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function deleteAccount() {
    setDeleting(true)
    try {
      await settingsApi.deleteAccount()
      await logout()
      navigate('/login')
    } catch {
      push({ kind: 'error', title: "Couldn't delete account" })
      setDeleting(false)
    }
  }

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch {
      push({ kind: 'error', title: "Couldn't log out", description: 'Try again.' })
      setLoggingOut(false)
    }
  }

  if (!profile || !prefsLoaded) {
    return <div className="mx-auto max-w-5xl px-6 py-6"><p className="text-sm text-steel-500">Loading settings…</p></div>
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <PageHeader title="Settings" description="Manage your account, appearance, and privacy." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={cn(
                'focus-ring flex shrink-0 items-center gap-2.5 rounded-sm px-3 py-2.5 text-left text-sm font-medium transition-colors',
                active === id ? 'bg-orange-500/12 text-orange-400' : 'text-steel-400 hover:bg-surface-2 hover:text-steel-100',
              )}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </nav>

        <div>
          {active === 'account' && (
            <div className="flex flex-col gap-5">
              <Card>
                <CardHeader><CardTitle>Account</CardTitle></CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Avatar name={profile.displayName} color={profile.avatarColor} status={presenceToUi(profile.status)} size="xl" />
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarChange(f); e.target.value = '' }}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        className="focus-ring absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full bg-orange-500 text-black disabled:opacity-50"
                      >
                        <Camera className="size-3.5" />
                      </button>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-steel-100">{profile.displayName}</p>
                      <p className="text-xs text-steel-500">@{profile.handle}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div><Label>Display name</Label><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
                    <div><Label>Handle</Label><Input value={handle} onChange={(e) => setHandle(e.target.value)} /></div>
                    <div className="sm:col-span-2"><Label>Bio</Label><Textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} /></div>
                    <div><Label>Email</Label><Input type="email" value={profile.email} readOnly disabled /></div>
                  </div>
                  <div className="flex justify-end"><Button onClick={saveAccount} loading={savingAccount}>Save Changes</Button></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Password</CardTitle></CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div><Label>Current password</Label><Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></div>
                  <div><Label>New password</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} /></div>
                  <div className="flex justify-end"><Button onClick={changePassword} loading={changingPassword} disabled={!currentPassword || newPassword.length < 8}>Change Password</Button></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Session</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-steel-500">Sign out of SquadLink on this device.</p>
                  <Button variant="outline" className="mt-3" onClick={handleLogout} loading={loggingOut}>
                    <LogOut className="size-4" /> Log Out
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Danger Zone</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-steel-500">Deleting your account is permanent and cannot be undone.</p>
                  <Button variant="danger" className="mt-3" onClick={() => setDeleteOpen(true)}>Delete Account</Button>
                </CardContent>
              </Card>
            </div>
          )}

          {active === 'appearance' && (
            <Card>
              <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-6">
                <div>
                  <Label>Accent color</Label>
                  <div className="flex gap-3">
                    {(['orange', 'steel'] as const).map((c) => (
                      <button
                        key={c}
                        onClick={() => { setAccentTheme(c); savePreferences({ accentTheme: c }) }}
                        className={cn('bevel-sm flex h-16 flex-1 items-center justify-center border-2 text-xs font-semibold uppercase', accentTheme === c ? 'border-orange-500' : 'border-border')}
                        style={{ background: c === 'orange' ? 'linear-gradient(135deg, #f2691c, #16171a)' : 'linear-gradient(135deg, #9aa0a8, #16171a)' }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Layout density</Label>
                  <div className="flex flex-col gap-2">
                    <Radio checked={density === 'comfortable'} onChange={() => { setDensity('comfortable'); savePreferences({ density: 'comfortable' }) }} label="Comfortable" />
                    <Radio checked={density === 'compact'} onChange={() => { setDensity('compact'); savePreferences({ density: 'compact' }) }} label="Compact" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {active === 'audio' && (
            <Card>
              <CardHeader><CardTitle>Audio</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-6">
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-steel-500">
                    <span>Input volume</span><span>{inputVol}%</span>
                  </div>
                  <input type="range" value={inputVol} onChange={(e) => setInputVol(Number(e.target.value))} onMouseUp={() => savePreferences({ inputVolume: inputVol })} onTouchEnd={() => savePreferences({ inputVolume: inputVol })} className="h-1.5 w-full appearance-none rounded-full bg-surface-3 accent-orange-500" />
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-steel-500">
                    <span>Output volume</span><span>{outputVol}%</span>
                  </div>
                  <input type="range" value={outputVol} onChange={(e) => setOutputVol(Number(e.target.value))} onMouseUp={() => savePreferences({ outputVolume: outputVol })} onTouchEnd={() => savePreferences({ outputVolume: outputVol })} className="h-1.5 w-full appearance-none rounded-full bg-surface-3 accent-orange-500" />
                </div>
                <div className="flex items-center justify-between"><span className="text-sm text-steel-200">Noise suppression</span><Switch checked={noiseSuppress} onChange={(v) => { setNoiseSuppress(v); savePreferences({ noiseSuppression: v }) }} /></div>
                <div className="flex items-center justify-between"><span className="text-sm text-steel-200">Push to talk</span><Switch checked={pushToTalk} onChange={(v) => { setPushToTalk(v); savePreferences({ pushToTalk: v }) }} /></div>
              </CardContent>
            </Card>
          )}

          {active === 'notifications' && (
            <Card>
              <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-5">
                <div className="flex items-center justify-between"><div><p className="text-sm text-steel-200">Direct messages</p><p className="text-xs text-steel-600">Get notified for new DMs</p></div><Switch checked={notifDM} onChange={(v) => { setNotifDM(v); savePreferences({ notifyDirectMessage: v }) }} /></div>
                <div className="flex items-center justify-between"><div><p className="text-sm text-steel-200">Party invites</p><p className="text-xs text-steel-600">Get notified when invited to a party</p></div><Switch checked={notifParty} onChange={(v) => { setNotifParty(v); savePreferences({ notifyPartyInvite: v }) }} /></div>
                <div className="flex items-center justify-between"><div><p className="text-sm text-steel-200">Community activity</p><p className="text-xs text-steel-600">Announcements and events</p></div><Switch checked={notifCommunity} onChange={(v) => { setNotifCommunity(v); savePreferences({ notifyCommunity: v }) }} /></div>
                <div className="flex items-center justify-between"><div><p className="text-sm text-steel-200">Notification sounds</p><p className="text-xs text-steel-600">Play a sound for new notifications</p></div><Switch checked={notifSound} onChange={(v) => { setNotifSound(v); savePreferences({ notifySound: v }) }} /></div>
              </CardContent>
            </Card>
          )}

          {active === 'privacy' && (
            <Card>
              <CardHeader><CardTitle>Privacy</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-6">
                <div className="flex items-center justify-between"><div><p className="text-sm text-steel-200">Show activity status</p><p className="text-xs text-steel-600">Let friends see what you're playing</p></div><Switch checked={showActivity} onChange={(v) => { setShowActivity(v); savePreferences({ showActivityStatus: v }) }} /></div>
                <div>
                  <Label>Who can send friend requests</Label>
                  <div className="flex flex-col gap-2">
                    <Radio checked={allowRequests === 'everyone'} onChange={() => { setAllowRequests('everyone'); savePreferences({ allowFriendRequests: 'everyone' }) }} label="Everyone" />
                    <Radio checked={allowRequests === 'friends-of-friends'} onChange={() => { setAllowRequests('friends-of-friends'); savePreferences({ allowFriendRequests: 'friends-of-friends' }) }} label="Friends of friends" />
                    <Radio checked={allowRequests === 'none'} onChange={() => { setAllowRequests('none'); savePreferences({ allowFriendRequests: 'none' }) }} label="No one" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {active === 'about' && (
            <Card>
              <CardHeader><CardTitle>About</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <img src={logo} alt="SquadLink" className="size-12 rounded-sm" />
                  <div>
                    <p className="font-display text-lg font-semibold text-steel-100">SquadLink</p>
                  </div>
                </div>
                <p className="text-sm text-steel-500">Connect · Play · Together. A premium desktop platform for gamers and streamers.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete Account"
        footer={<Button variant="danger" onClick={deleteAccount} loading={deleting}>Permanently Delete</Button>}
      >
        <p className="text-sm text-steel-400">This will permanently delete your account, messages, and party history. This cannot be undone.</p>
      </Modal>
    </div>
  )
}
