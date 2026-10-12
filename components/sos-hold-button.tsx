'use client'

import { Siren } from 'lucide-react'
import { motion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useState } from 'react'
import { useHold } from '@/lib/hooks/use-hold'
import { getHoldSeconds } from '@/lib/sos-prefs'
import { cn } from '@/lib/utils'

/** The main SOS control: hold for the configured duration to start an emergency. */
export function SosHoldButton() {
  const router = useRouter()
  const gradientId = useId()
  const [seconds, setSeconds] = useState(3)

  useEffect(() => setSeconds(getHoldSeconds()), [])

  const { progress, holding, handlers } = useHold(seconds * 1000, () => router.push('/emergency?start=1'))

  const radius = 144
  const circumference = 2 * Math.PI * radius
  const pct = Math.round(progress * 100)

  return (
    <div className="flex w-full flex-col items-center gap-5">
      {/* Scales with the screen: never wider than the viewport, never taller than ~half of it. */}
      <div className="relative aspect-square w-[min(21rem,100%,50dvh)]">
        {/* Ambient glow */}
        <div
          className="absolute inset-[6%] rounded-full opacity-70 blur-2xl"
          style={{ background: 'radial-gradient(closest-side, rgb(244 63 94 / 0.55), transparent)' }}
          aria-hidden="true"
        />

        {/* Expanding ripples while idle */}
        {!holding && (
          <>
            <span className="animate-ripple absolute inset-[12%] rounded-full border-2 border-danger/50" aria-hidden="true" />
            <span
              className="animate-ripple absolute inset-[12%] rounded-full border border-danger/40"
              style={{ animationDelay: '1.4s' }}
              aria-hidden="true"
            />
          </>
        )}

        {/* Progress ring */}
        <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 320 320" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fb7185" />
              <stop offset="100%" stopColor="#e11d48" />
            </linearGradient>
          </defs>
          <circle cx="160" cy="160" r={radius} fill="none" className="stroke-danger/15" strokeWidth="8" />
          <circle
            cx="160"
            cy="160"
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
          />
        </svg>

        <motion.button
          type="button"
          aria-label={`Hold for ${seconds} seconds to activate emergency SOS`}
          {...handlers}
          animate={holding ? { scale: [1, 1.035, 1] } : { scale: 1 }}
          transition={holding ? { duration: 0.9, repeat: Number.POSITIVE_INFINITY } : { duration: 0.2 }}
          className="gradient-danger glow-danger absolute inset-[11%] flex touch-none select-none flex-col items-center justify-center gap-1 rounded-full text-white ring-4 ring-white/15 [-webkit-touch-callout:none]"
        >
          {/* Glossy highlight */}
          <span
            className="pointer-events-none absolute inset-x-[16%] top-[7%] h-[34%] rounded-full opacity-30"
            style={{ background: 'linear-gradient(to bottom, rgb(255 255 255 / 0.9), transparent)' }}
            aria-hidden="true"
          />
          <Siren className="relative size-[26%]" strokeWidth={1.8} />
          <span className="relative font-display text-4xl font-extrabold tracking-[0.18em]">SOS</span>
          <span className="relative text-[11px] font-semibold uppercase tracking-widest text-white/80">
            {holding ? `${pct}%` : `Hold ${seconds}s`}
          </span>
        </motion.button>
      </div>

      <p
        className={cn(
          'rounded-full px-4 py-1.5 text-center text-sm font-semibold transition-colors duration-300',
          holding ? 'bg-danger/15 text-danger' : 'bg-muted/70 text-muted-foreground',
        )}
        aria-live="polite"
      >
        {holding ? 'Keep holding… release to cancel' : 'Press and hold to send an SOS'}
      </p>
    </div>
  )
}
