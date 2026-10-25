'use client'

import { Loader2, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

interface Meta {
  kind: 'photo' | 'audio' | 'video'
  created_at: string
  expires_at: string
}

export function SharedViewer({ token }: { token: string }) {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'gone' } | { status: 'ok'; meta: Meta; src: string }>({ status: 'loading' })

  useEffect(() => {
    let url: string | null = null
    let cancelled = false
    ;(async () => {
      try {
        const metaRes = await fetch(`/api/shared/${encodeURIComponent(token)}?meta=1`, { cache: 'no-store' })
        if (!metaRes.ok) throw new Error('gone')
        const meta = (await metaRes.json()) as Meta
        const fileRes = await fetch(`/api/shared/${encodeURIComponent(token)}`, { cache: 'no-store' })
        if (!fileRes.ok) throw new Error('gone')
        url = URL.createObjectURL(await fileRes.blob())
        if (!cancelled) setState({ status: 'ok', meta, src: url })
      } catch {
        if (!cancelled) setState({ status: 'gone' })
      }
    })()
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [token])

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-5 bg-aurora px-5 py-8 text-center">
      {state.status === 'loading' && <Loader2 className="size-8 animate-spin text-muted-foreground" role="status" aria-label="Loading" />}
      {state.status === 'gone' && (
        <>
          <span className="gradient-primary flex size-16 items-center justify-center rounded-3xl">
            <ShieldAlert className="size-8" />
          </span>
          <h1 className="font-serif text-2xl font-semibold">This link is not available</h1>
          <p className="text-sm text-muted-foreground">It has expired or the person stopped sharing it. Ask them to send a new one.</p>
        </>
      )}
      {state.status === 'ok' && (
        <>
          <span className="gradient-success flex size-14 items-center justify-center rounded-3xl">
            <ShieldCheck className="size-7" />
          </span>
          <h1 className="font-serif text-2xl font-semibold">Shared with you through SafeHer</h1>
          <p className="text-xs text-muted-foreground">
            Recorded {new Date(state.meta.created_at).toLocaleString()} · link works until {new Date(state.meta.expires_at).toLocaleString()}
          </p>
          <div className="surface w-full rounded-3xl p-3">
            {state.meta.kind === 'photo' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={state.src} alt="Shared evidence photo" className="max-h-[70dvh] w-full rounded-2xl bg-muted object-contain" />
            ) : state.meta.kind === 'video' ? (
              <video src={state.src} controls playsInline className="max-h-[70dvh] w-full rounded-2xl bg-muted" />
            ) : (
              <audio src={state.src} controls className="w-full" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">Only this one item is shared. If you think this is an emergency, call your local emergency number.</p>
        </>
      )}
    </main>
  )
}
