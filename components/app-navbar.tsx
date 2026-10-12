'use client'

import { ArrowLeft, History } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Logo } from '@/components/logo'
import { ModeToggle } from '@/components/mode-toggle'
import { cn } from '@/lib/utils'

interface AppNavbarProps {
  title?: string
  subtitle?: string
  showBack?: boolean
  showLogo?: boolean
  className?: string
}

export function AppNavbar({ title, subtitle, showBack, showLogo, className }: AppNavbarProps) {
  const router = useRouter()

  return (
    <header className={cn('nav-glass pt-safe sticky top-0 z-30', className)}>
      <div className="flex min-h-[4.25rem] items-center justify-between gap-3 px-4 py-2">
        <div className="flex min-w-0 items-center gap-3">
          {showBack && (
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Go back"
              className="surface-raised flex size-11 shrink-0 items-center justify-center rounded-2xl transition-transform active:scale-90"
            >
              <ArrowLeft className="size-5" strokeWidth={2} />
            </button>
          )}
          {showLogo ? (
            <Logo />
          ) : (
            <div className="min-w-0">
              <h1 className="truncate font-serif text-[1.65rem] font-semibold leading-tight tracking-tight">{title}</h1>
              {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/history"
            aria-label="SOS history"
            className="surface-raised flex size-11 items-center justify-center rounded-2xl transition-transform active:scale-90"
          >
            <History className="size-5" strokeWidth={2} />
          </Link>
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
