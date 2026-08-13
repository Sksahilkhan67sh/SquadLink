import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Pin, Users, MessageSquare, ChevronUp } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Skeleton } from '@/components/shared/Skeleton'
import { Avatar } from '@/components/ui/Avatar'
import { useToast } from '@/components/ui/Toast'
import { messagesApi } from '@/lib/api/messages'
import { uploadsApi, UploadValidationError } from '@/lib/api/uploads'
import { ApiError } from '@/lib/api/http'
import { getSocket } from '@/lib/realtime/socket'
import { useAppData } from '@/lib/realtime/AppDataContext'
import { useAuth } from '@/lib/auth/AuthContext'
import { conversationToUi, messageToUi, userToUi } from '@/lib/adapters'
import type { ApiMessage } from '@/lib/api/types'
import type { Conversation, Message, User } from '@/types'
import { ConversationList } from './ConversationList'
import { MessageBubble } from './MessageBubble'
import { Composer } from './Composer'

export function MessagesPage() {
  const [params, setParams] = useSearchParams()
  const { user } = useAuth()
  const { profile } = useAppData()
  const { push } = useToast()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [convLoading, setConvLoading] = useState(true)
  const [convError, setConvError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(params.get('c'))
  const [query, setQuery] = useState('')
  const [replyTo, setReplyTo] = useState<Message | undefined>(undefined)
  const [sending, setSending] = useState(false)

  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())

  const scrollRef = useRef<HTMLDivElement>(null)
  const knownMessageIds = useRef<Set<string>>(new Set())

  const currentUserId = user?.id ?? ''
  const active = conversations.find((c) => c.id === activeId) ?? null

  const usersById = useMemo(() => {
    const map = new Map<string, User>()
    for (const c of conversations) for (const p of c.participants) map.set(p.id, p)
    if (profile) map.set(profile.id, userToUi({ ...profile }))
    return map
  }, [conversations, profile])

  const loadConversations = useCallback(async () => {
    setConvLoading(true)
    setConvError(null)
    try {
      const list = await messagesApi.listConversations()
      setConversations(list.map((c) => conversationToUi(c, currentUserId)))
      if (!activeId && list.length > 0) setActiveId(list[0].id)
    } catch {
      setConvError("Couldn't load conversations.")
    } finally {
      setConvLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId])

  useEffect(() => { loadConversations() }, [loadConversations])

  // Load message history + join the realtime room whenever the active conversation changes.
  useEffect(() => {
    if (!activeId) {
      setMessages([])
      return
    }
    let cancelled = false
    setMessagesLoading(true)
    knownMessageIds.current = new Set()
    messagesApi
      .listMessages(activeId, 1)
      .then((res) => {
        if (cancelled) return
        const ui = res.items.map((m) => messageToUi(m, currentUserId)).reverse() // newest-last for rendering
        ui.forEach((m) => knownMessageIds.current.add(m.id))
        setMessages(ui)
        setPage(1)
        setHasMore(res.page < res.totalPages)
        messagesApi.markRead(activeId).catch(() => {})
        setConversations((prev) => prev.map((c) => (c.id === activeId ? { ...c, unread: 0 } : c)))
      })
      .catch(() => {
        if (!cancelled) push({ kind: 'error', title: "Couldn't load messages" })
      })
      .finally(() => {
        if (!cancelled) setMessagesLoading(false)
      })

    const socket = getSocket()
    socket?.emit('conversation:join', { conversationId: activeId })
    return () => {
      cancelled = true
      socket?.emit('conversation:leave', { conversationId: activeId })
      setTypingUsers(new Set())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, currentUserId])

  // Realtime: new/updated messages, typing indicators, across all conversations.
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const onCreated = (m: ApiMessage) => {
      if (m.conversationId === activeId) {
        if (!knownMessageIds.current.has(m.id)) {
          knownMessageIds.current.add(m.id)
          setMessages((prev) => [...prev, messageToUi(m, currentUserId)])
          if (document.hasFocus()) messagesApi.markRead(m.conversationId).catch(() => {})
        }
      }
      setConversations((prev) =>
        prev.map((c) =>
          c.id === m.conversationId
            ? { ...c, messages: [messageToUi(m, currentUserId)], unread: m.conversationId === activeId && document.hasFocus() ? 0 : c.unread + 1 }
            : c,
        ),
      )
    }
    const onUpdated = (m: ApiMessage) => {
      if (m.conversationId === activeId) {
        setMessages((prev) => prev.map((x) => (x.id === m.id ? messageToUi(m, currentUserId) : x)))
      }
    }
    const onTyping = (data: { conversationId: string; userId: string; typing: boolean }) => {
      if (data.conversationId !== activeId || data.userId === currentUserId) return
      setTypingUsers((prev) => {
        const next = new Set(prev)
        if (data.typing) next.add(data.userId)
        else next.delete(data.userId)
        return next
      })
    }

    socket.on('message:created', onCreated)
    socket.on('message:updated', onUpdated)
    socket.on('typing:update', onTyping)
    return () => {
      socket.off('message:created', onCreated)
      socket.off('message:updated', onUpdated)
      socket.off('typing:update', onTyping)
    }
  }, [activeId, currentUserId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages.length, activeId])

  function selectConversation(id: string) {
    setActiveId(id)
    setReplyTo(undefined)
    setParams({ c: id }, { replace: true })
  }

  async function loadOlder() {
    if (!activeId || messagesLoading) return
    setMessagesLoading(true)
    try {
      const res = await messagesApi.listMessages(activeId, page + 1)
      const ui = res.items.map((m) => messageToUi(m, currentUserId)).reverse()
      ui.forEach((m) => knownMessageIds.current.add(m.id))
      setMessages((prev) => [...ui, ...prev])
      setPage(res.page)
      setHasMore(res.page < res.totalPages)
    } catch {
      push({ kind: 'error', title: "Couldn't load earlier messages" })
    } finally {
      setMessagesLoading(false)
    }
  }

  async function sendMessage(text: string) {
    if (!active) return
    setSending(true)
    try {
      const sent = await messagesApi.sendMessage(active.id, { content: text, replyToId: replyTo?.id })
      // The realtime `message:created` socket event can arrive before this
      // REST call resolves (it's emitted the instant the row is created,
      // over an already-open socket, while this response has to complete
      // the HTTP round trip) and already appended the message via
      // knownMessageIds. Without this check we'd append it a second time,
      // which is what caused every sent message to show up twice.
      if (!knownMessageIds.current.has(sent.id)) {
        knownMessageIds.current.add(sent.id)
        setMessages((prev) => [...prev, messageToUi(sent, currentUserId)])
      }
      setConversations((prev) => prev.map((c) => (c.id === active.id ? { ...c, messages: [messageToUi(sent, currentUserId)] } : c)))
      setReplyTo(undefined)
    } catch {
      push({ kind: 'error', title: "Couldn't send message", description: 'Try again.' })
    } finally {
      setSending(false)
    }
  }

  function setTyping(typing: boolean) {
    if (!activeId) return
    getSocket()?.emit(typing ? 'typing:start' : 'typing:stop', { conversationId: activeId })
  }

  async function handleAttach(file: File) {
    if (!active) return
    try {
      const uploaded = await uploadsApi.uploadAttachment(file)
      const isImage = uploaded.mimeType.startsWith('image/')
      const sent = await messagesApi.sendMessage(active.id, {
        content: '',
        attachments: [{ type: isImage ? 'IMAGE' : 'FILE', url: uploaded.url, name: file.name, size: uploaded.size }],
      })
      if (!knownMessageIds.current.has(sent.id)) {
        knownMessageIds.current.add(sent.id)
        setMessages((prev) => [...prev, messageToUi(sent, currentUserId)])
      }
    } catch (err) {
      if (err instanceof UploadValidationError) push({ kind: 'error', title: 'Invalid file', description: err.message })
      else push({ kind: 'error', title: "Couldn't upload attachment" })
    }
  }

  async function togglePin(m: Message) {
    if (!active) return
    try {
      if (m.pinned) await messagesApi.unpinMessage(active.id, m.id)
      else await messagesApi.pinMessage(active.id, m.id)
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, pinned: !x.pinned } : { ...x, pinned: false })))
    } catch {
      push({ kind: 'error', title: "Couldn't update pin" })
    }
  }

  async function deleteMessage(m: Message) {
    try {
      await messagesApi.deleteMessage(m.id)
      setMessages((prev) => prev.filter((x) => x.id !== m.id))
    } catch {
      push({ kind: 'error', title: "Couldn't delete message" })
    }
  }

  async function editMessage(m: Message, content: string) {
    try {
      const updated = await messagesApi.editMessage(m.id, content)
      setMessages((prev) => prev.map((x) => (x.id === m.id ? messageToUi(updated, currentUserId) : x)))
    } catch {
      push({ kind: 'error', title: "Couldn't edit message" })
    }
  }

  async function react(messageId: string, emoji: string, alreadyReacted: boolean) {
    try {
      if (alreadyReacted) await messagesApi.unreact(messageId, emoji)
      else await messagesApi.react(messageId, emoji)
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m
          const reactions = [...(m.reactions ?? [])]
          const idx = reactions.findIndex((r) => r.emoji === emoji)
          if (alreadyReacted && idx >= 0) {
            reactions[idx] = { ...reactions[idx], count: reactions[idx].count - 1, reacted: false }
            if (reactions[idx].count <= 0) reactions.splice(idx, 1)
          } else if (idx >= 0) {
            reactions[idx] = { ...reactions[idx], count: reactions[idx].count + 1, reacted: true }
          } else {
            reactions.push({ emoji, count: 1, reacted: true })
          }
          return { ...m, reactions }
        }),
      )
    } catch (err) {
      if (!(err instanceof ApiError)) push({ kind: 'error', title: "Couldn't react to message" })
    }
  }

  const pinnedMessage = messages.find((m) => m.pinned)
  const typingLabel =
    typingUsers.size > 0
      ? `${Array.from(typingUsers).map((id) => usersById.get(id)?.displayName ?? 'Someone').join(', ')} ${typingUsers.size === 1 ? 'is' : 'are'} typing…`
      : null

  return (
    <div className="flex h-full">
      {convLoading ? (
        <div className="flex h-full w-80 shrink-0 flex-col gap-2 border-r border-border p-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : convError ? (
        <div className="flex h-full w-80 shrink-0 items-center border-r border-border">
          <ErrorState message={convError} onRetry={loadConversations} />
        </div>
      ) : (
        <ConversationList conversations={conversations} activeId={activeId} onSelect={selectConversation} query={query} setQuery={setQuery} />
      )}

      {!active ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState icon={<MessageSquare className="size-6" />} title="No conversation selected" description="Pick a conversation from the list to start chatting." />
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5">
            <div className="flex items-center gap-3">
              {active.type === 'dm' ? (
                <Avatar name={active.participants[0]?.displayName ?? '?'} color={active.participants[0]?.avatarColor} status={active.participants[0]?.status} size="sm" />
              ) : (
                <div className="flex size-9 items-center justify-center rounded-full bg-surface-3 text-steel-400"><Users className="size-4" /></div>
              )}
              <div>
                <p className="text-sm font-semibold text-steel-100">{active.name}</p>
                <p className="text-xs text-steel-500">{active.type === 'group' ? `${active.participants.length} members` : active.participants[0]?.currentGame ?? presenceLabel(active.participants[0]?.status)}</p>
              </div>
            </div>
          </div>

          {pinnedMessage && (
            <div className="flex items-center gap-2 border-b border-border bg-orange-500/5 px-5 py-2 text-xs text-steel-400">
              <Pin className="size-3.5 text-orange-500" /> Pinned: <span className="truncate text-steel-200">{pinnedMessage.content}</span>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto py-3">
            {hasMore && (
              <button onClick={loadOlder} disabled={messagesLoading} className="focus-ring mx-auto mb-2 flex items-center gap-1 rounded-sm px-3 py-1.5 text-xs font-semibold text-steel-500 hover:bg-surface-2 hover:text-orange-400 disabled:opacity-50">
                <ChevronUp className="size-3.5" /> {messagesLoading ? 'Loading…' : 'Load earlier messages'}
              </button>
            )}
            {messagesLoading && messages.length === 0 && (
              <div className="flex flex-col gap-3 px-4">
                <Skeleton className="h-10 w-2/3" />
                <Skeleton className="h-10 w-1/2" />
              </div>
            )}
            {messages.length === 0 && !messagesLoading && (
              <EmptyState icon={<MessageSquare className="size-6" />} title="No messages yet" description="Say hello to get the conversation started." />
            )}
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                author={usersById.get(m.authorId) ?? { id: m.authorId, displayName: 'Unknown', handle: 'unknown', avatarColor: '#f2691c', status: 'offline', level: 1, bannerAccent: '#f2691c', joinDate: m.sentAt }}
                isMe={m.authorId === currentUserId}
                onReply={setReplyTo}
                replyTo={m.replyToId ? messages.find((x) => x.id === m.replyToId) : undefined}
                onReact={react}
                onTogglePin={togglePin}
                onDelete={deleteMessage}
                onEdit={editMessage}
              />
            ))}
          </div>

          <Composer onSend={sendMessage} onAttach={handleAttach} replyTo={replyTo} onCancelReply={() => setReplyTo(undefined)} onTypingChange={setTyping} typingLabel={typingLabel} sending={sending} />
        </div>
      )}
    </div>
  )
}

function presenceLabel(status?: User['status']) {
  if (!status) return ''
  return { online: 'Online', 'in-game': 'In Game', idle: 'Idle', 'do-not-disturb': 'Do Not Disturb', offline: 'Offline' }[status]
}
