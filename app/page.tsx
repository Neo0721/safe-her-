'use client'

import { ArrowRight, ShieldCheck } from 'lucide-react'
import { motion } from 'motion/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/mode-toggle'

export default function SplashPage() {
  return (
    <main className="pt-safe relative mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-between overflow-hidden bg-background px-6 py-10">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute bottom-10 right-0 size-56 rounded-full bg-secondary/60 blur-3xl" />
      </div>

      <div className="flex w-full justify-end">
        <ModeToggle />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 16 }}
          className="relative mb-8"
        >
          <span className="absolute inset-0 -z-10 animate-sos-pulse rounded-[2rem] bg-primary/20" />
          <div className="flex size-28 items-center justify-center rounded-[2rem] bg-primary text-primary-foreground shadow-xl shadow-primary/30">
            <motion.div
              animate={{ rotate: [0, -6, 6, 0] }}
              transition={{
                duration: 3,
                repeat: Number.POSITIVE_INFINITY,
                ease: 'easeInOut',
              }}
            >
              <ShieldCheck className="size-14" />
            </motion.div>
          </div>
        </motion.div>

        <motion.h1
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="font-display text-4xl font-bold tracking-tight"
        >
          Safe<span className="text-primary">Her</span>
        </motion.h1>
        <motion.p
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-3 text-pretty text-base text-muted-foreground"
        >
          Your Safety. Always Within Reach.
        </motion.p>
      </div>

      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.55 }}
        className="w-full"
      >
        <Button
          size="lg"
          className="h-14 w-full rounded-2xl text-base"
          render={<Link href="/onboarding" />}
          nativeButton={false}
        >
          Get Started
          <ArrowRight className="size-5" />
        </Button>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Trusted safety companion for women, everywhere.
        </p>
      </motion.div>
    </main>
  )
}
