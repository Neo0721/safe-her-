'use client'

import { Home, MapPin, Siren, User, Users } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useHold } from '@/lib/hooks/use-hold'
import { getHoldSeconds } from '@/lib/sos-prefs'
import { cn } from '@/lib/utils'

const items = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/tracking', label: 'Live', icon: MapPin },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/profile', label: 'Profile', icon: User },
]

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [seconds, setSeconds] = useState(3)
  useEffect(() => setSeconds(getHoldSeconds()), [])

  const { progress, holding, handlers } = useHold(seconds * 1000, () => router.push('/emergency?start=1'))
  const circumference = 2 * Math.PI * 30

  return (
    <nav
      aria-label="Primary navigation"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md justify-center px-4 pb-[calc(1rem+var(--sab))]"
    >
      <div className="pointer-events-auto relative flex w-full items-center justify-around rounded-2xl border border-border/40 bg-card/95 px-2 py-2 shadow-2xl backdrop-blur-xl">
        {items.slice(0, 2).map((item) => (
          <NavItem key={item.href} {...item} active={pathname === item.href} />
        ))}

        {/* Hold-to-activate SOS: a stray tap can never start an emergency. */}
        <div className="relative -mt-10 flex size-16 shrink-0 items-center justify-center">
          <svg className="pointer-events-none absolute size-[72px] -rotate-90" viewBox="0 0 72 72" aria-hidden="true">
            <circle
              cx="36"
              cy="36"
              r="30"
              fill="none"
              className="stroke-danger"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
            />
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
              'flex size-16 touch-none select-none items-center justify-center rounded-full bg-danger text-white shadow-xl shadow-danger/40 transition-transform',
              holding ? 'scale-95' : 'active:scale-95',
            )}
          >
            <Siren className="size-7" />
          </button>
        </div>

        {items.slice(2).map((item) => (
          <NavItem key={item.href} {...item} active={pathname === item.href} />
        ))}
      </div>
    </nav>
  )
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string
  label: string
  icon: typeof Home
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'relative flex min-h-12 min-w-14 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 font-semibold transition-all duration-200',
        active ? 'text-primary' : 'text-muted-foreground hover:text-foreground active:scale-95',
      )}
      aria-current={active ? 'page' : undefined}
    >
      {active && (
        <motion.span
          className="absolute inset-0 rounded-xl bg-primary/10"
          layoutId="nav-active"
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      )}
      <Icon className="relative size-5" />
      <span className="relative text-[11px] leading-tight">{label}</span>
    </Link>
  )
}
