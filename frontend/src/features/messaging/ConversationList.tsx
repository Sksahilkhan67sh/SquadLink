import { Search, Users } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Input } from '@/components/ui/Input'
import { cn, timeAgo } from '@/lib/utils'
import type { Conversation } from '@/types'

export function ConversationList({ conversations, activeId, onSelect, query, setQuery }: {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  query: string
  setQuery: (v: string) => void
}) {
  const filtered = conversations.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-r border-border">
      <div className="p-4">
        <Input placeholder="Find a conversation" icon={<Search className="size-4" />} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {filtered.map((c) => {
          const last = c.messages.at(-1)
          const other = c.participants[0]
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={cn(
                'focus-ring flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left transition-colors',
                activeId === c.id ? 'bg-orange-500/12' : 'hover:bg-surface-2',
              )}
            >
              {c.type === 'dm' ? (
                <Avatar name={other.displayName} color={other.avatarColor} status={other.status} size="md" />
              ) : (
                <div className="flex size-10 items-center justify-center rounded-full bg-surface-3 text-steel-400">
                  <Users className="size-[18px]" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={cn('truncate text-sm font-semibold', activeId === c.id ? 'text-orange-300' : 'text-steel-100')}>{c.name}</p>
                  {last && <span className="shrink-0 text-[11px] text-steel-600">{timeAgo(last.sentAt)}</span>}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-steel-500">{last?.content}</p>
                  {c.unread > 0 && <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-black">{c.unread}</span>}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
