'use client'

import { AlertTriangle, Bot, Loader2, PhoneCall, RotateCcw, Send, Trash2, User as UserIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { useAuth } from '@/contexts/AuthContext'
import { ApiError, apiJson, errorMessage } from '@/lib/api-fetch'
import { CONFIG } from '@/lib/config'
import { findGuidance } from '@/lib/offline-guide'
import { cn } from '@/lib/utils'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  urgent?: boolean
}

const MAX_STORED = 40
const MAX_SENT = 20
const MAX_INPUT = 1000

const suggestions = [
  'How do I stay safe walking home at night?',
  'What should I do if someone is following me?',
  'How can I prepare a personal safety plan?',
  'How do I use the SafeHer SOS button?',
]

const storageKey = (uid: string) => `safeher.assistant.${uid}`

export default function AssistantPage() {
  const { user } = useAuth()
  const uid = user?.uid

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<{ text: string; code?: string } | null>(null)
  const [loaded, setLoaded] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<ChatMessage[]>([])

  // Conversation history is kept on this device only, per account.
  useEffect(() => {
    if (!uid) return
    try {
      const raw = localStorage.getItem(storageKey(uid))
      const parsed = raw ? (JSON.parse(raw) as ChatMessage[]) : []
      const valid = Array.isArray(parsed) ? parsed.filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') : []
      messagesRef.current = valid
      setMessages(valid)
    } catch {
      /* corrupt history: start fresh */
    }
    setLoaded(true)
  }, [uid])

  useEffect(() => {
    if (!uid || !loaded) return
    try {
      localStorage.setItem(storageKey(uid), JSON.stringify(messages.slice(-MAX_STORED)))
    } catch {
      /* storage full or unavailable */
    }
    messagesRef.current = messages
  }, [messages, uid, loaded])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, sending, error])

  const requestReply = useCallback(async (history: ChatMessage[]) => {
    setSending(true)
    setError(null)
    try {
      const data = await apiJson<{ reply: string; urgent: boolean }>('/api/assistant', {
        method: 'POST',
        json: { messages: history.slice(-MAX_SENT).map((m) => ({ role: m.role, content: m.content })) },
      })
      setMessages((list) => [...list, { id: crypto.randomUUID(), role: 'assistant', content: data.reply, urgent: data.urgent }])
    } catch (e) {
      setError({ text: errorMessage(e), code: e instanceof ApiError ? e.code : undefined })
    } finally {
      setSending(false)
    }
  }, [])

  const send = useCallback(
    (text: string) => {
      const content = text.trim()
      if (!content || sending) return
      const next = [...messagesRef.current, { id: crypto.randomUUID(), role: 'user' as const, content }]
      messagesRef.current = next
      setMessages(next)
      setInput('')
      void requestReply(next)
    },
    [requestReply, sending]
  )

  const retry = () => {
    const last = messagesRef.current[messagesRef.current.length - 1]
    if (last?.role === 'user') void requestReply(messagesRef.current)
  }

  const clear = () => {
    messagesRef.current = []
    setMessages([])
    setError(null)
    if (uid) localStorage.removeItem(storageKey(uid))
  }

  const lastIsUser = messages[messages.length - 1]?.role === 'user'

  return (
    <AppShell title="Safety Assistant" subtitle="General guidance, powered by Gemini" showBack hideBottomNav>
      <div className="flex min-h-[calc(100dvh-9rem)] flex-col gap-3 py-1">
        <div role="note" className="surface flex items-start gap-3 rounded-2xl p-3 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <p>
            I&apos;m an AI giving general safety guidance. <strong className="text-foreground">I cannot call or message anyone, or contact
            emergency services.</strong> In danger, call {CONFIG.emergencyNumber} now or use the SOS button.
          </p>
        </div>

        <div className="flex-1 space-y-3" aria-live="polite" aria-label="Conversation">
          {messages.length === 0 && loaded && (
            <div className="space-y-2 pt-2">
              <p className="px-1 text-sm font-semibold">Try asking</p>
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  disabled={sending}
                  className="surface-raised flex min-h-12 w-full items-center rounded-2xl px-4 py-2 text-left text-sm active:scale-[0.98] disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={cn('flex gap-2', m.role === 'user' && 'flex-row-reverse')}>
              <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', m.role === 'user' ? 'gradient-primary' : 'bg-muted text-primary')}>
                {m.role === 'user' ? <UserIcon className="size-4" /> : <Bot className="size-4" />}
              </span>
              <div className="max-w-[82%] space-y-2">
                <div
                  className={cn(
                    'whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                    m.role === 'user' ? 'gradient-primary rounded-tr-md' : 'surface-raised rounded-tl-md'
                  )}
                >
                  {m.content}
                </div>
                {m.role === 'assistant' && m.urgent && (
                  <a href={`tel:${CONFIG.emergencyNumber}`} className="gradient-danger glow-danger flex min-h-12 items-center justify-center gap-2 rounded-2xl text-sm font-bold">
                    <PhoneCall className="size-4" /> Call {CONFIG.emergencyNumber} now
                  </a>
                )}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <span className="flex size-8 items-center justify-center rounded-full bg-muted text-primary">
                <Bot className="size-4" />
              </span>
              <Loader2 className="size-4 animate-spin" /> Thinking…
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-2xl border border-danger/30 bg-danger/8 p-3 text-sm">
              <p>{error.text}</p>
              {error.code === 'ASSISTANT_NOT_CONFIGURED' ? (
                <p className="mt-1 text-xs text-muted-foreground">The server owner needs to set GEMINI_API_KEY in the server environment.</p>
              ) : (
                lastIsUser && (
                  <button type="button" onClick={retry} className="mt-2 flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 font-semibold">
                    <RotateCcw className="size-4" /> Try again
                  </button>
                )
              )}
              {lastIsUser && (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="text-xs font-semibold">Built-in guide (fixed text, not AI)</p>
                  {findGuidance(messages[messages.length - 1].content).map((g) => (
                    <div key={g.id} className="mt-2">
                      <p className="text-sm font-semibold">{g.title}</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                        {g.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            send(input)
          }}
          className="sticky bottom-[calc(0.5rem+var(--sab))] z-10 flex items-end gap-2 rounded-3xl bg-card/95 p-2 shadow-lg ring-1 ring-border backdrop-blur"
        >
          {messages.length > 0 && (
            <button type="button" onClick={clear} aria-label="Clear chat" className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-muted-foreground active:bg-muted">
              <Trash2 className="size-5" />
            </button>
          )}
          <label htmlFor="assistant-input" className="sr-only">
            Message the Safety Assistant
          </label>
          <textarea
            id="assistant-input"
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(input)
              }
            }}
            rows={1}
            placeholder="Ask a safety question…"
            className="max-h-32 min-h-12 min-w-0 flex-1 resize-none bg-transparent px-3 py-3 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={sending || input.trim().length === 0}
            aria-label="Send message"
            className="gradient-primary flex size-12 shrink-0 items-center justify-center rounded-2xl transition-transform active:scale-90 disabled:opacity-50"
          >
            {sending ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
          </button>
        </form>
      </div>
    </AppShell>
  )
}
