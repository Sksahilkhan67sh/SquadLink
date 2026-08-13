import { useState } from 'react'
import { Reply, Pin, Smile, MoreHorizontal, FileText, Check, CheckCheck, Pencil, Trash2 } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Dropdown } from '@/components/ui/Dropdown'
import { cn, formatClock } from '@/lib/utils'
import type { Message, User } from '@/types'

const QUICK_EMOJI = ['🔥', '😂', '👍', '❤️', '🎮']

export function MessageBubble({
  message, author, isMe, onReply, replyTo, onReact, onTogglePin, onDelete, onEdit,
}: {
  message: Message
  author: User
  isMe: boolean
  onReply: (m: Message) => void
  replyTo?: Message
  onReact: (messageId: string, emoji: string, alreadyReacted: boolean) => void
  onTogglePin: (message: Message) => void
  onDelete: (message: Message) => void
  onEdit: (message: Message, newContent: string) => void
}) {
  const [hover, setHover] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.content)

  function saveEdit() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== message.content) onEdit(message, trimmed)
    setEditing(false)
  }

  return (
    <div
      className={cn('group flex gap-3 px-4 py-1.5 hover:bg-surface-2/60', isMe && 'flex-row-reverse')}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Avatar name={author.displayName} color={author.avatarColor} size="sm" className="mt-0.5" />
      <div className={cn('flex max-w-[65%] flex-col', isMe && 'items-end')}>
        <div className={cn('mb-1 flex items-baseline gap-2', isMe && 'flex-row-reverse')}>
          <span className="text-sm font-semibold text-steel-100">{isMe ? 'You' : author.displayName}</span>
          <span className="text-[11px] text-steel-600">{formatClock(message.sentAt)}</span>
          {message.editedAt && <span className="text-[11px] text-steel-700">(edited)</span>}
          {message.pinned && <Pin className="size-3 text-orange-500" />}
        </div>

        {replyTo && (
          <div className="mb-1 flex items-center gap-1.5 rounded-sm border-l-2 border-orange-500/50 bg-surface-2 px-2.5 py-1 text-xs text-steel-500">
            <Reply className="size-3" /> {replyTo.content.slice(0, 50)}
          </div>
        )}

        {editing ? (
          <div className="flex w-full flex-col gap-1.5">
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit() }
                if (e.key === 'Escape') { setDraft(message.content); setEditing(false) }
              }}
              rows={2}
              className="bevel-sm w-full resize-none border border-orange-500/50 bg-surface-2 px-3 py-2 text-sm text-steel-100 focus:outline-none"
            />
            <div className="flex gap-2 text-xs">
              <button onClick={saveEdit} className="font-semibold text-orange-400 hover:text-orange-300">Save</button>
              <button onClick={() => { setDraft(message.content); setEditing(false) }} className="text-steel-500 hover:text-steel-300">Cancel</button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'bevel-sm px-3.5 py-2 text-sm leading-relaxed',
              isMe ? 'bg-orange-500 text-black' : 'bg-surface-2 text-steel-100',
            )}
          >
            {message.content}
          </div>
        )}

        {message.attachments?.map((a) => (
          <div key={a.id} className="mt-1.5 flex items-center gap-2 rounded-sm border border-border bg-surface-2 px-3 py-2 text-xs text-steel-300">
            <FileText className="size-4 text-steel-500" /> {a.name} {a.size && <span className="text-steel-600">· {a.size}</span>}
          </div>
        ))}

        {message.reactions && message.reactions.length > 0 && (
          <div className="mt-1 flex gap-1.5">
            {message.reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => onReact(message.id, r.emoji, Boolean(r.reacted))}
                className={cn('flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs', r.reacted ? 'border-orange-500/50 bg-orange-500/10 text-orange-300' : 'border-border bg-surface-2 text-steel-400 hover:border-border-strong')}
              >
                {r.emoji} {r.count}
              </button>
            ))}
          </div>
        )}

        {isMe && (
          <span className="mt-0.5 flex items-center gap-1 text-[10px] text-steel-600">
            {message.status === 'read' ? <CheckCheck className="size-3 text-orange-500" /> : <Check className="size-3" />}
            {message.status}
          </span>
        )}
      </div>

      {hover && !editing && (
        <div className={cn('flex items-start gap-0.5 opacity-0 transition-opacity group-hover:opacity-100', isMe && 'flex-row-reverse')}>
          <Dropdown
            trigger={
              <button className="focus-ring flex size-7 items-center justify-center rounded-sm text-steel-500 hover:bg-surface-3 hover:text-steel-100">
                <Smile className="size-4" />
              </button>
            }
            items={QUICK_EMOJI.map((e) => ({
              label: e,
              onClick: () => onReact(message.id, e, Boolean(message.reactions?.find((r) => r.emoji === e && r.reacted))),
            }))}
          />
          <button onClick={() => onReply(message)} className="focus-ring flex size-7 items-center justify-center rounded-sm text-steel-500 hover:bg-surface-3 hover:text-steel-100">
            <Reply className="size-4" />
          </button>
          <Dropdown
            trigger={
              <button className="focus-ring flex size-7 items-center justify-center rounded-sm text-steel-500 hover:bg-surface-3 hover:text-steel-100">
                <MoreHorizontal className="size-4" />
              </button>
            }
            items={[
              { label: message.pinned ? 'Unpin message' : 'Pin message', icon: <Pin className="size-4" />, onClick: () => onTogglePin(message) },
              ...(isMe
                ? [
                    { label: 'Edit', icon: <Pencil className="size-4" />, onClick: () => setEditing(true) },
                    { label: 'Delete', icon: <Trash2 className="size-4" />, danger: true, onClick: () => onDelete(message) },
                  ]
                : []),
            ]}
          />
        </div>
      )}
    </div>
  )
}
