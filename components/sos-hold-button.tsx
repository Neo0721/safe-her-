'use client'

import { Siren } from 'lucide-react'
import { motion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useHold } from '@/lib/hooks/use-hold'
import { getHoldSeconds } from '@/lib/sos-prefs'
import { cn } from '@/lib/utils'

/** The main SOS control: hold for the configured duration to start an emergency. */
export function SosHoldButton() {
  const router = useRouter()
  const [seconds, setSeconds] = useState(3)

  useEffect(() => setSeconds(getHoldSeconds()), [])

  const { progress, holding, handlers } = useHold(seconds * 1000, () => router.push('/emergency?start=1'))

  const radius = 140
  const circumference = 2 * Math.PI * radius

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {/* Scales with the screen: never wider than the viewport, never taller than ~half of it. */}
      <div className="relative aspect-square w-[min(20rem,100%,52dvh)]">
        {!holding && (
          <>
            <motion.span
              className="absolute inset-0 rounded-full border-2 border-danger/20"
              animate={{ scale: [1, 1.06], opacity: [0.5, 0] }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
            />
            <motion.span
              className="absolute inset-[6%] rounded-full border border-danger/30"
              animate={{ scale: [1, 1.1], opacity: [0.3, 0] }}
              transition={{ duration: 2.5, repeat: Number.POSITIVE_INFINITY, delay: 0.2 }}
            />
          </>
        )}

        <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 320 320" aria-hidden="true">
          <circle cx="160" cy="160" r={radius} fill="none" className="stroke-danger/15" strokeWidth="6" />
          <circle
            cx="160"
            cy="160"
            r={radius}
            fill="none"
            className="stroke-danger"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
          />
        </svg>

        <motion.button
          type="button"
          aria-label={`Hold for ${seconds} seconds to activate emergency SOS`}
          {...handlers}
          animate={
            holding
              ? { scale: [1, 1.04, 1], boxShadow: '0 0 60px rgba(239, 68, 68, 0.6)' }
              : { scale: 1, boxShadow: '0 0 40px rgba(239, 68, 68, 0.3)' }
          }
          transition={holding ? { duration: 1, repeat: Number.POSITIVE_INFINITY } : { duration: 0.2 }}
          className="absolute inset-[13%] flex touch-none select-none flex-col items-center justify-center gap-2 rounded-full bg-danger text-white shadow-xl [-webkit-touch-callout:none]"
        >
          <Siren className="size-1/4" strokeWidth={1.5} />
          <span className="font-display text-3xl font-bold tracking-wider">SOS</span>
        </motion.button>
      </div>

      <p
        className={cn(
          'text-center text-sm font-medium transition-colors duration-300',
          holding ? 'font-semibold text-danger' : 'text-muted-foreground',
        )}
        aria-live="polite"
      >
        {holding ? `Keep holding… ${Math.round(progress * 100)}%` : `Hold for ${seconds} seconds`}
      </p>
    </div>
  )
}
