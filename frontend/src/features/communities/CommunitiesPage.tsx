import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Users, Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Skeleton } from '@/components/shared/Skeleton'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { useToast } from '@/components/ui/Toast'
import { useAppData } from '@/lib/realtime/AppDataContext'
import { useApiData } from '@/lib/hooks/useApiData'
import { communitiesApi } from '@/lib/api/communities'
import { communityAccent } from '@/lib/color'
import { ApiError } from '@/lib/api/http'
import type { ApiCommunity } from '@/lib/api/types'

export function CommunitiesPage() {
  const navigate = useNavigate()
  const { push } = useToast()
  const { communities, refreshCommunities } = useAppData()
  const [tab, setTab] = useState('mine')
  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [tag, setTag] = useState('')
  const [creating, setCreating] = useState(false)
  const [joiningId, setJoiningId] = useState<string | null>(null)

  const browseState = useApiData(() => communitiesApi.browse(tab === 'browse' ? query : undefined), [tab, tab === 'browse' ? query : ''])
  const joinedIds = useMemo(() => new Set(communities.map((c) => c.id)), [communities])

  const filteredMine = communities.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
  const browseResults = (browseState.status === 'success' || browseState.status === 'empty' ? browseState.data : []).filter((c) => !joinedIds.has(c.id))

  async function createCommunity() {
    if (!name.trim() || !tag.trim()) return
    setCreating(true)
    try {
      const created = await communitiesApi.create(name.trim(), tag.trim().toUpperCase())
      await refreshCommunities()
      setCreateOpen(false)
      setName('')
      setTag('')
      navigate(`/communities/${created.id}`)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) push({ kind: 'error', title: 'Tag already taken' })
      else push({ kind: 'error', title: "Couldn't create community" })
    } finally {
      setCreating(false)
    }
  }

  async function join(c: ApiCommunity) {
    setJoiningId(c.id)
    try {
      await communitiesApi.join(c.id)
      await refreshCommunities()
      push({ kind: 'success', title: `Joined ${c.name}` })
    } catch {
      push({ kind: 'error', title: "Couldn't join community" })
    } finally {
      setJoiningId(null)
    }
  }

  function renderCard(c: ApiCommunity, joined: boolean) {
    const accent = communityAccent(c.id)
    return (
      <Card key={c.id} className="transition-colors hover:border-border-strong">
        <button onClick={() => (joined ? navigate(`/communities/${c.id}`) : undefined)} className={joined ? 'block w-full cursor-pointer text-left' : 'block w-full text-left'}>
          <div className="h-16" style={{ background: `linear-gradient(135deg, ${accent}, #0a0a0b)` }} />
          <div className="-mt-8 flex items-end gap-3 px-5">
            <span className="bevel-md flex size-14 items-center justify-center border-4 border-surface text-lg font-display font-bold text-black" style={{ backgroundColor: accent }}>
              {c.tag.slice(0, 2)}
            </span>
          </div>
        </button>
        <div className="p-5 pt-3">
          <h3 className="font-display text-base font-semibold text-steel-100">{c.name}</h3>
          <div className="mt-2 flex items-center gap-3 text-xs text-steel-500">
            <span className="flex items-center gap-1"><Users className="size-3.5" /> {c.memberCount.toLocaleString()}</span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <Badge variant="outline">#{c.tag}</Badge>
            {joined ? (
              <Badge variant="outline">Joined</Badge>
            ) : (
              <Button size="sm" loading={joiningId === c.id} onClick={() => join(c)}>Join</Button>
            )}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <PageHeader
        title="Communities"
        description="Servers built around the games you play."
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="size-4" /> Create Community</Button>}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-5">
          <TabsTrigger value="mine">My Communities</TabsTrigger>
          <TabsTrigger value="browse">Browse</TabsTrigger>
        </TabsList>

        <Input placeholder="Search communities…" icon={<Search className="size-4" />} className="mb-6 max-w-sm" value={query} onChange={(e) => setQuery(e.target.value)} />

        <TabsContent value="mine">
          {filteredMine.length === 0 ? (
            <EmptyState icon={<Users className="size-6" />} title="No communities yet" description="Browse and join a community, or create your own." action={<Button onClick={() => setTab('browse')}>Browse communities</Button>} />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{filteredMine.map((c) => renderCard(c, true))}</div>
          )}
        </TabsContent>

        <TabsContent value="browse">
          {browseState.status === 'loading' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}</div>
          )}
          {browseState.status === 'error' && <ErrorState message={browseState.error} onRetry={browseState.retry} />}
          {(browseState.status === 'success' || browseState.status === 'empty') && browseResults.length === 0 && (
            <EmptyState icon={<Search className="size-6" />} title="No communities found" description="Try a different search term." />
          )}
          {browseResults.length > 0 && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{browseResults.map((c) => renderCard(c, false))}</div>}
        </TabsContent>
      </Tabs>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Community" footer={<Button onClick={createCommunity} loading={creating} disabled={!name.trim() || !tag.trim()}>Create</Button>}>
        <div className="flex flex-col gap-3">
          <Input placeholder="Community name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Short tag, e.g. NOVA" value={tag} onChange={(e) => setTag(e.target.value.toUpperCase())} maxLength={6} />
        </div>
      </Modal>
    </div>
  )
}
