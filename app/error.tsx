'use client'

import { useEffect } from 'react'
import { AlertTriangle, PhoneCall, RotateCcw } from 'lucide-react'
import { CONFIG } from '@/lib/config'

// Next.js renders this in place of any screen whose render throws. Nothing here depends on
// whatever broke elsewhere in the app, so the emergency call button is always reachable.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[error boundary]', error)
  }, [error])

  return (
    <main className="pt-safe mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 bg-aurora px-6 pb-[calc(2rem+var(--sab))] text-center">
      <span className="gradient-danger glow-danger flex size-16 items-center justify-center rounded-3xl">
        <AlertTriangle className="size-8" />
      </span>
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          SafeHer hit an unexpected error on this screen. Your account and data are safe.
        </p>
      </div>
      <div className="w-full space-y-3">
        <button
          type="button"
          onClick={reset}
          className="flex min-h-14 w-full items-center justify-center gap-2 gradient-primary glow-primary rounded-2xl font-bold active:scale-[0.98]"
        >
          <RotateCcw className="size-5" />
          Try again
        </button>
        <a
          href={`tel:${CONFIG.emergencyNumber}`}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-destructive/30 font-semibold text-destructive active:scale-[0.98]"
        >
          <PhoneCall className="size-5" />
          Call {CONFIG.emergencyNumber}
        </a>
      </div>
    </main>
  )
}
