'use client'

import { Home, MapPin, Siren, User, Users } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useHold } from '@/lib/hooks/use-hold'
import { getHoldSeconds } from '@/lib/sos-prefs'
import { cn } from '@/lib/utils'

const items = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/tracking', label: 'Live', icon: MapPin },
  { href: '/contacts', label: 'Circle', icon: Users },
  { href: '/profile', label: 'Me', icon: User },
]

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [seconds, setSeconds] = useState(3)
  useEffect(() => setSeconds(getHoldSeconds()), [])

  const { progress, holding, handlers } = useHold(seconds * 1000, () => router.push('/emergency?start=1'))
  const circumference = 2 * Math.PI * 33

  return (
    <nav
      aria-label="Primary navigation"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md justify-center px-4 pb-[calc(0.9rem+var(--sab))]"
    >
      <div className="surface-raised pointer-events-auto relative flex w-full items-center justify-between rounded-[1.75rem] bg-card/90 px-2 py-2 backdrop-blur-xl">
        {items.slice(0, 2).map((item) => (
          <NavItem key={item.href} {...item} active={pathname === item.href} />
        ))}

        {/* Hold-to-activate SOS: a stray tap can never start an emergency. */}
        <div className="relative -mt-11 flex size-[4.5rem] shrink-0 items-center justify-center">
          <span className="animate-ripple absolute inset-1 rounded-full bg-danger/40" aria-hidden="true" />
          <svg className="pointer-events-none absolute size-[5rem] -rotate-90" viewBox="0 0 80 80" aria-hidden="true">
            <circle cx="40" cy="40" r="33" fill="none" className="stroke-white/70" strokeWidth="5" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} />
          </svg>
          <button
            type="button"
            aria-label={`Hold for ${seconds} seconds to activate emergency SOS`}
            title="Hold to activate SOS"
            onClick={() => {
              if (!holding) toast.info(`Press and hold the SOS button for ${seconds} seconds.`)
            }}
            {...handlers}
            className={cn(
              'gradient-danger glow-danger relative flex size-[4.25rem] touch-none select-none items-center justify-center rounded-full ring-4 ring-background transition-transform',
              holding ? 'scale-95' : 'active:scale-95',
            )}
          >
            <Siren className="size-8" strokeWidth={2.2} />
          </button>
        </div>

        {items.slice(2).map((item) => (
          <NavItem key={item.href} {...item} active={pathname === item.href} />
        ))}
      </div>
    </nav>
  )
}

function NavItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Home; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex min-h-14 min-w-[3.75rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 font-semibold transition-all duration-200',
        active ? 'text-primary' : 'text-muted-foreground active:scale-95',
      )}
    >
      {active && <span className="absolute inset-x-1 inset-y-0.5 -z-0 rounded-2xl bg-primary/12" aria-hidden="true" />}
      <Icon className={cn('relative size-[1.4rem]', active && 'drop-shadow-[0_2px_6px_rgb(124_58_237/0.45)]')} strokeWidth={active ? 2.4 : 2} />
      <span className="relative text-[11px] leading-tight">{label}</span>
    </Link>
  )
}
