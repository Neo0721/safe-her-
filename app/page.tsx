'use client'

import { ArrowRight, MapPin, ShieldCheck, Siren, Users } from 'lucide-react'
import { motion } from 'motion/react'
import Link from 'next/link'
import { DarkScreen } from '@/components/dark-screen'

const highlights = [
  { icon: Siren, label: 'Hold-to-send SOS' },
  { icon: MapPin, label: 'Real GPS tracking' },
  { icon: Users, label: 'Trusted circle' },
]

export default function SplashPage() {
  return (
    <main
      className="pt-safe relative flex min-h-dvh w-full flex-col items-center justify-between overflow-hidden px-6 pb-[calc(2rem+var(--sab))] text-white"
      style={{ backgroundImage: 'linear-gradient(160deg, #1e0a4a 0%, #4c1d95 42%, #9d174d 100%)' }}
    >
      <DarkScreen />
      {/* Decorative glow */}
      <span className="pointer-events-none absolute -left-24 top-10 size-72 rounded-full bg-fuchsia-500/25 blur-3xl" aria-hidden="true" />
      <span className="pointer-events-none absolute -right-28 bottom-24 size-80 rounded-full bg-rose-500/25 blur-3xl" aria-hidden="true" />

      <div className="relative flex w-full flex-1 flex-col items-center justify-center text-center">
        <div className="relative mb-9 flex size-44 items-center justify-center">
          <span className="animate-ripple absolute inset-0 rounded-full border border-white/40" />
          <span className="animate-ripple absolute inset-0 rounded-full border border-white/30" style={{ animationDelay: '1.4s' }} />
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 180, damping: 14 }}
            className="relative flex size-28 items-center justify-center rounded-[2rem] bg-white/15 shadow-2xl ring-1 ring-white/30 backdrop-blur-md"
          >
            <ShieldCheck className="size-14" strokeWidth={1.8} />
          </motion.div>
        </div>

        <motion.h1
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="font-display text-5xl font-extrabold tracking-tight"
        >
          Safe<span className="text-pink-300">Her</span>
        </motion.h1>
        <motion.p
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="mt-3 max-w-xs text-pretty text-lg text-white/85"
        >
          Your safety. Always within reach.
        </motion.p>

        <motion.ul
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 flex flex-wrap justify-center gap-2"
        >
          {highlights.map((h) => (
            <li key={h.label} className="flex items-center gap-1.5 rounded-full bg-white/12 px-3.5 py-2 text-xs font-semibold ring-1 ring-white/20 backdrop-blur">
              <h.icon className="size-3.5" />
              {h.label}
            </li>
          ))}
        </motion.ul>
      </div>

      <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }} className="relative w-full max-w-md space-y-3">
        <Link
          href="/onboarding"
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white font-display text-base font-bold text-[#3b0764] shadow-xl active:scale-[0.98]"
        >
          Get started
          <ArrowRight className="size-5" />
        </Link>
        <Link href="/login" className="flex min-h-12 w-full items-center justify-center rounded-2xl text-sm font-semibold text-white/90">
          I already have an account
        </Link>
      </motion.div>
    </main>
  )
}
