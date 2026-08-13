import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, User, AtSign } from 'lucide-react'
import { AuthLayout } from './AuthLayout'
import { Input, Label } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Toggle'
import { useAuth } from '@/lib/auth/AuthContext'
import { ApiError } from '@/lib/api/http'

export function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [loading, setLoading] = useState(false)
  const [agree, setAgree] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [handle, setHandle] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await register({ handle, displayName, email, password })
      navigate('/verify-email')
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('That email or handle is already taken.')
      } else if (err instanceof ApiError && err.status === 400) {
        setError(err.message)
      } else {
        setError("Couldn't create your account — check your connection and try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="It takes less than a minute."
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-orange-400 hover:text-orange-300">Log in</Link></>}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="displayName">Display name</Label>
          <Input id="displayName" placeholder="Your gamer tag" icon={<User className="size-4" />} required minLength={2} maxLength={48} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="handle">Handle</Label>
          <Input id="handle" placeholder="letters, numbers, underscores" icon={<AtSign className="size-4" />} required minLength={3} maxLength={24} pattern="^[a-zA-Z0-9_]+$" value={handle} onChange={(e) => setHandle(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="reg-email">Email</Label>
          <Input id="reg-email" type="email" placeholder="you@example.com" icon={<Mail className="size-4" />} required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="reg-password">Password</Label>
          <Input
            id="reg-password"
            type="password"
            placeholder="At least 8 characters"
            icon={<Lock className="size-4" />}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error ?? undefined}
          />
        </div>
        <Checkbox checked={agree} onChange={setAgree} label="I agree to the Terms of Service and Privacy Policy" />
        <Button type="submit" size="lg" className="mt-2 w-full" loading={loading} disabled={!agree}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  )
}
