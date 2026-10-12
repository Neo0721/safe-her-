import type { ReactNode } from 'react'
import { ShieldCheck } from 'lucide-react'
import { DarkScreen } from '@/components/dark-screen'
import { Logo } from '@/components/logo'
import { ModeToggle } from '@/components/mode-toggle'

/** Shared gradient header for sign-in / sign-up. */
export function AuthHero({ title, subtitle, children }: { title: string; subtitle: string; children?: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-b-[2.5rem] px-6 pb-14 pt-[calc(1.25rem+var(--sat))] text-white" style={{ backgroundImage: 'var(--grad-primary)' }}>
      <DarkScreen />
      <ShieldCheck className="pointer-events-none absolute -right-8 -top-6 size-52 opacity-[0.12]" strokeWidth={1.2} />
      <span className="pointer-events-none absolute -left-16 top-24 size-48 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
      <div className="relative flex items-center justify-between">
        <Logo onDark textClassName="text-white" />
        <ModeToggle className="border-white/20 bg-white/15 text-white" />
      </div>
      <div className="relative mt-8">
        <h1 className="font-serif text-[2.4rem] font-semibold leading-[1.1] tracking-tight">{title}</h1>
        <p className="mt-2 max-w-xs text-sm text-white/85">{subtitle}</p>
        {children}
      </div>
    </div>
  )
}
