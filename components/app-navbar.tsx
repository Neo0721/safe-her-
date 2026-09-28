'use client'

import { ArrowLeft, History } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Logo } from '@/components/logo'
import { ModeToggle } from '@/components/mode-toggle'
import { cn } from '@/lib/utils'

interface AppNavbarProps {
  title?: string
  showBack?: boolean
  showLogo?: boolean
  className?: string
}

export function AppNavbar({ title, showBack, showLogo, className }: AppNavbarProps) {
  const router = useRouter()

  return (
    <header
      className={cn(
        'pt-safe sticky top-0 z-30 border-b border-border/30 bg-background/95 backdrop-blur-xl',
        className,
      )}
    >
      <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {showBack && (
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Go back"
              className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-card transition-all hover:bg-muted active:scale-95"
            >
              <ArrowLeft className="size-5" strokeWidth={1.5} />
            </button>
          )}
          {showLogo ? (
            <Logo />
          ) : (
            <h1 className="truncate font-display text-lg font-semibold tracking-tight text-foreground">
              {title}
            </h1>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/history"
            aria-label="SOS history"
            className="flex size-11 items-center justify-center rounded-xl border border-border/40 bg-card transition-all hover:bg-muted active:scale-95"
          >
            <History className="size-5 text-foreground" strokeWidth={1.5} />
          </Link>
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
