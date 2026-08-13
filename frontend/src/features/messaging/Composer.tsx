import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Paperclip, Smile, Send, X, Image as ImageIcon, Loader2 } from 'lucide-react'
import type { Message } from '@/types'

const EMOJI = ['😀', '😂', '🔥', '👍', '❤️', '🎮', '🎉', '😢', '😮', '🙌', '💯', '⚡']
const TYPING_STOP_DELAY_MS = 2500

export function Composer({
  onSend, onAttach, replyTo, onCancelReply, onTypingChange, typingLabel, sending,
}: {
  onSend: (text: string) => void
  onAttach?: (file: File) => void
  replyTo?: Message
  onCancelReply: () => void
  onTypingChange: (typing: boolean) => void
  typingLabel?: string | null
  sending?: boolean
}) {
  const [value, setValue] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => {
    if (stopTimer.current) clearTimeout(stopTimer.current)
    onTypingChange(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function submit(e?: FormEvent) {
    e?.preventDefault()
    if (!value.trim() || sending) return
    onSend(value.trim())
    setValue('')
    if (stopTimer.current) clearTimeout(stopTimer.current)
    onTypingChange(false)
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function handleChange(text: string) {
    setValue(text)
    onTypingChange(text.length > 0)
    if (stopTimer.current) clearTimeout(stopTimer.current)
    if (text.length > 0) {
      stopTimer.current = setTimeout(() => onTypingChange(false), TYPING_STOP_DELAY_MS)
    }
  }

  return (
    <div className="border-t border-border p-4">
      {typingLabel && <p className="mb-1.5 px-1 text-xs text-steel-600">{typingLabel}</p>}
      {replyTo && (
        <div className="mb-2 flex items-center justify-between rounded-sm border-l-2 border-orange-500 bg-surface-2 px-3 py-1.5 text-xs text-steel-400">
          Replying to <span className="font-semibold text-steel-200">{replyTo.content.slice(0, 40)}</span>
          <button onClick={onCancelReply} className="text-steel-500 hover:text-steel-100"><X className="size-3.5" /></button>
        </div>
      )}
      <form onSubmit={submit} className="relative flex items-end gap-2 rounded-sm border border-border bg-surface p-2 focus-within:border-orange-500">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file && onAttach) onAttach(file)
            e.target.value = ''
          }}
        />
        <button type="button" onClick={() => fileInputRef.current?.click()} className="focus-ring flex size-9 shrink-0 items-center justify-center rounded-sm text-steel-500 hover:bg-surface-2 hover:text-steel-100">
          <Paperclip className="size-[18px]" />
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()} className="focus-ring flex size-9 shrink-0 items-center justify-center rounded-sm text-steel-500 hover:bg-surface-2 hover:text-steel-100">
          <ImageIcon className="size-[18px]" />
        </button>
        <textarea
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message…"
          rows={1}
          className="max-h-32 flex-1 resize-none bg-transparent px-1 py-1.5 text-sm text-steel-100 placeholder:text-steel-700 focus:outline-none"
        />
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowEmoji((s) => !s)}
            className="focus-ring flex size-9 shrink-0 items-center justify-center rounded-sm text-steel-500 hover:bg-surface-2 hover:text-steel-100"
          >
            <Smile className="size-[18px]" />
          </button>
          {showEmoji && (
            <div className="anim-slide-up bevel-sm absolute bottom-full right-0 mb-2 grid grid-cols-6 gap-1 border border-border-strong bg-surface-2 p-2 shadow-2xl">
              {EMOJI.map((e) => (
                <button key={e} type="button" onClick={() => { handleChange(value + e); setShowEmoji(false) }} className="rounded-sm p-1.5 text-lg hover:bg-surface-3">
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="submit" disabled={!value.trim() || sending} className="focus-ring flex size-9 shrink-0 items-center justify-center rounded-sm bg-orange-500 text-black disabled:opacity-30">
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </form>
    </div>
  )
}
