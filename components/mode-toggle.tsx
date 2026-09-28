'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export function ModeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      type="button"
      aria-label="Toggle dark mode"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn(
        'flex size-11 items-center justify-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-muted',
        className,
      )}
    >
      {mounted && isDark ? (
        <Sun className="size-4.5" />
      ) : (
        <Moon className="size-4.5" />
      )}
    </button>
  )
}
