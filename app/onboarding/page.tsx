'use client'

import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const slides = [
  {
    title: 'Stay Safe Anywhere',
    description: 'Keep a one-touch SOS in your pocket, with your emergency contacts and your real GPS location ready when you need them.',
    image: '/onboarding-safe.png',
    tone: 'from-violet-500/30 to-fuchsia-500/20',
  },
  {
    title: 'Press-and-Hold SOS',
    description:
      'Hold the red SOS button for a few seconds to start an emergency. The hold time prevents accidental alerts, and you choose how long it is.',
    image: '/onboarding-gesture.png',
    tone: 'from-rose-500/30 to-orange-400/20',
  },
  {
    title: 'Help in One Tap',
    description:
      'SafeHer records your live location and puts call and SMS buttons for the emergency number and your contacts on one screen. Your phone’s dialer and SMS app place the call and send the message.',
    image: '/onboarding-response.png',
    tone: 'from-sky-500/30 to-indigo-500/20',
  },
  {
    title: "You're in Control",
    description: 'Practice with a drill any time, review every SOS in your history, and end an alert the moment you are safe.',
    image: '/onboarding-protected.png',
    tone: 'from-emerald-500/30 to-teal-400/20',
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const last = index === slides.length - 1
  const slide = slides[index]

  const next = () => {
    if (last) router.replace('/login')
    else setIndex((i) => i + 1)
  }

  return (
    <main className="bg-aurora min-h-dvh">
      <div className="pt-safe mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-[calc(2rem+var(--sab))] pt-4">
        <div className="flex min-h-11 items-center justify-between">
          <div className="flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={slides.length} aria-valuenow={index + 1}>
            {slides.map((s, i) => (
              <span
                key={s.title}
                className={cn('h-1.5 rounded-full transition-all duration-300', i === index ? 'gradient-primary w-8' : i < index ? 'w-3 bg-primary/50' : 'w-3 bg-muted-foreground/25')}
              />
            ))}
          </div>
          {!last && (
            <Link href="/login" className="flex min-h-11 items-center px-2 text-sm font-semibold text-muted-foreground">
              Skip
            </Link>
          )}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center text-center"
            >
              <div className={cn('relative mb-8 flex size-[min(17rem,72vw)] items-center justify-center rounded-[2.75rem] bg-gradient-to-br shadow-xl ring-1 ring-border', slide.tone)}>
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
                  className="relative size-[78%] overflow-hidden rounded-[2rem] bg-white shadow-lg"
                >
                  <Image src={slide.image} alt="" fill priority sizes="260px" className="object-contain" />
                </motion.div>
              </div>
              <h2 className="text-balance font-serif text-[2rem] font-semibold leading-tight tracking-tight">{slide.title}</h2>
              <p className="mt-3 max-w-sm text-pretty leading-relaxed text-muted-foreground">{slide.description}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={next}
            className="gradient-primary glow-primary flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl font-display text-base font-bold active:scale-[0.98]"
          >
            {last ? 'Start using SafeHer' : 'Next'}
            <ArrowRight className="size-5" />
          </button>
          {index > 0 && !last ? (
            <button type="button" onClick={() => setIndex((i) => i - 1)} className="min-h-12 w-full text-sm font-semibold text-muted-foreground">
              Back
            </button>
          ) : (
            <div className="min-h-12" />
          )}
        </div>
      </div>
    </main>
  )
}
