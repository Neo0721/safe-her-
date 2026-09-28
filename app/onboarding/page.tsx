'use client'

import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const slides = [
  {
    title: 'Stay Safe Anywhere',
    description:
      'Quickly alert your trusted contacts during emergencies — wherever you are, day or night.',
    image: '/onboarding-safe.png',
  },
  {
    title: 'Gesture-Based SOS',
    description:
      'Turn your phone upside down and press the volume buttons in your secret pattern. Emergency mode activates automatically — no unlocking needed.',
    image: '/onboarding-gesture.png',
  },
  {
    title: 'Instant Emergency Response',
    description:
      'Once activated, SafeHer calls your emergency contact, sends SMS alerts, shares your live location continuously, and sends route updates to trusted contacts.',
    image: '/onboarding-response.png',
  },
  {
    title: "You're Protected",
    description:
      'Everything is set up to keep you safe. Start using SafeHer and carry peace of mind with you.',
    image: '/onboarding-protected.png',
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
    <main className="pt-safe mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background px-6 py-8 pb-[calc(2rem+var(--sab))]">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {slides.map((s, i) => (
            <span
              key={s.title}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === index ? 'w-6 bg-primary' : 'w-1.5 bg-muted',
              )}
            />
          ))}
        </div>
        {!last && (
          <Link
            href="/login"
            className="flex min-h-11 items-center px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
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
            <div className="relative mb-8 flex size-[min(16rem,70vw)] items-center justify-center rounded-[2.5rem] bg-secondary/50">
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{
                  duration: 4,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: 'easeInOut',
                }}
                className="relative size-52"
              >
                <Image
                  src={slide.image || '/placeholder.svg'}
                  alt={slide.title}
                  fill
                  priority
                  className="object-contain"
                />
              </motion.div>
            </div>
            <h2 className="text-balance font-display text-2xl font-bold tracking-tight">
              {slide.title}
            </h2>
            <p className="mt-3 max-w-sm text-pretty leading-relaxed text-muted-foreground">
              {slide.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="space-y-3">
        <Button
          size="lg"
          onClick={next}
          className="h-14 w-full rounded-2xl text-base"
        >
          {last ? 'Start Using SafeHer' : 'Next'}
          <ArrowRight className="size-5" />
        </Button>
        {index > 0 && !last && (
          <button
            type="button"
            onClick={() => setIndex((i) => i - 1)}
            className="min-h-11 w-full py-1 text-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Back
          </button>
        )}
      </div>
    </main>
  )
}
