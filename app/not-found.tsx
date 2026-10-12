import Link from 'next/link'
import { PhoneCall, ShieldQuestion } from 'lucide-react'
import { CONFIG } from '@/lib/config'

// Next.js renders this for any URL that doesn't match a route (including a stale or malformed
// deep link). It stays on-brand and keeps a way back and a way to call for help.
export default function NotFound() {
  return (
    <main className="pt-safe mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 bg-aurora px-6 pb-[calc(2rem+var(--sab))] text-center">
      <span className="gradient-primary glow-primary flex size-16 items-center justify-center rounded-3xl">
        <ShieldQuestion className="size-8" />
      </span>
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          That screen doesn&apos;t exist in SafeHer. It may be an old link.
        </p>
      </div>
      <div className="w-full space-y-3">
        <Link
          href="/home"
          className="flex min-h-14 w-full items-center justify-center gradient-primary glow-primary rounded-2xl font-bold active:scale-[0.98]"
        >
          Back to SafeHer
        </Link>
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
