import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search as SearchIcon, MessageSquare, Users, Compass } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Skeleton } from '@/components/shared/Skeleton'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { searchApi } from '@/lib/api/search'
import { messagesApi } from '@/lib/api/messages'
import { presenceToUi } from '@/lib/adapters'
import { communityAccent } from '@/lib/color'
import type { ApiSearchResults } from '@/lib/api/types'

const DEBOUNCE_MS = 300

export function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ApiSearchResults>({ users: [], communities: [], messages: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults({ users: [], communities: [], messages: [] })
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      searchApi
        .all(query, controller.signal)
        .then((res) => setResults(res))
        .catch((err) => {
          if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Search failed.')
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  async function openMessage() {
    // Search results are individual messages; jump to their conversation.
    // The search endpoint doesn't return a conversationId directly on the
    // message object in all cases, so we resolve via listConversations as
    // a fallback rather than guessing a URL.
    const conversations = await messagesApi.listConversations().catch(() => [])
    return conversations
  }

  const totalResults = results.users.length + results.communities.length + results.messages.length

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <PageHeader title="Search" description="Find friends, communities, and messages across SquadLink." />
      <Input
        autoFocus
        placeholder="Search everything…"
        icon={<SearchIcon className="size-4" />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-6"
      />

      {!query.trim() ? (
        <EmptyState icon={<SearchIcon className="size-6" />} title="Search SquadLink" description="Start typing to find friends, communities, or messages." />
      ) : loading ? (
        <div className="flex flex-col gap-2"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
      ) : error ? (
        <ErrorState message={error} />
      ) : totalResults === 0 ? (
        <EmptyState icon={<SearchIcon className="size-6" />} title="No results" description={`Nothing found for "${query}"`} />
      ) : (
        <Tabs defaultValue="all">
          <TabsList className="mb-5">
            <TabsTrigger value="all">All ({totalResults})</TabsTrigger>
            <TabsTrigger value="friends">People ({results.users.length})</TabsTrigger>
            <TabsTrigger value="communities">Communities ({results.communities.length})</TabsTrigger>
            <TabsTrigger value="messages">Messages ({results.messages.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="flex flex-col gap-2">
            {results.users.map((u) => (
              <button key={u.id} onClick={() => navigate('/friends')} className="focus-ring flex items-center gap-3 rounded-sm border border-border bg-surface p-3.5 text-left hover:bg-surface-2">
                <Avatar name={u.displayName} color={u.avatarColor} status={presenceToUi(u.status)} size="sm" />
                <span className="text-sm font-medium text-steel-100">{u.displayName}</span>
                <Users className="ml-auto size-4 text-steel-600" />
              </button>
            ))}
            {results.communities.map((c) => (
              <button key={c.id} onClick={() => navigate(`/communities/${c.id}`)} className="focus-ring flex items-center gap-3 rounded-sm border border-border bg-surface p-3.5 text-left hover:bg-surface-2">
                <span className="bevel-sm flex size-8 items-center justify-center text-[10px] font-display font-bold text-black" style={{ backgroundColor: communityAccent(c.id) }}>{c.tag.slice(0, 2)}</span>
                <span className="text-sm font-medium text-steel-100">{c.name}</span>
                <Compass className="ml-auto size-4 text-steel-600" />
              </button>
            ))}
            {results.messages.map((m) => (
              <button key={m.id} onClick={() => openMessage().then((cs) => { const c = cs.find((x) => x.id === m.conversationId); navigate(c ? `/messages?c=${c.id}` : '/messages') })} className="focus-ring flex items-center gap-3 rounded-sm border border-border bg-surface p-3.5 text-left hover:bg-surface-2">
                <Avatar name={m.author?.displayName ?? '?'} color={m.author?.avatarColor} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-steel-100">{m.content}</span>
                <MessageSquare className="ml-auto size-4 shrink-0 text-steel-600" />
              </button>
            ))}
          </TabsContent>
          <TabsContent value="friends" className="flex flex-col gap-2">
            {results.users.map((u) => (
              <button key={u.id} onClick={() => navigate('/friends')} className="focus-ring flex items-center gap-3 rounded-sm border border-border bg-surface p-3.5 text-left hover:bg-surface-2">
                <Avatar name={u.displayName} color={u.avatarColor} status={presenceToUi(u.status)} size="sm" />
                <span className="text-sm font-medium text-steel-100">{u.displayName}</span>
              </button>
            ))}
          </TabsContent>
          <TabsContent value="communities" className="flex flex-col gap-2">
            {results.communities.map((c) => (
              <button key={c.id} onClick={() => navigate(`/communities/${c.id}`)} className="focus-ring flex items-center gap-3 rounded-sm border border-border bg-surface p-3.5 text-left hover:bg-surface-2">
                <span className="bevel-sm flex size-8 items-center justify-center text-[10px] font-display font-bold text-black" style={{ backgroundColor: communityAccent(c.id) }}>{c.tag.slice(0, 2)}</span>
                <span className="text-sm font-medium text-steel-100">{c.name}</span>
              </button>
            ))}
          </TabsContent>
          <TabsContent value="messages" className="flex flex-col gap-2">
            {results.messages.map((m) => (
              <button key={m.id} onClick={() => openMessage().then((cs) => { const c = cs.find((x) => x.id === m.conversationId); navigate(c ? `/messages?c=${c.id}` : '/messages') })} className="focus-ring flex items-center gap-3 rounded-sm border border-border bg-surface p-3.5 text-left hover:bg-surface-2">
                <span className="text-sm font-medium text-steel-100">{m.content}</span>
              </button>
            ))}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
