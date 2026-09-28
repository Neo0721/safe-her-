"use client"

import {
  ShieldAlert,
  PhoneCall,
  MapPin,
  Siren,
  Route,
  type LucideIcon,
} from "lucide-react"
import { motion } from "motion/react"
import { AppShell } from "@/components/app-shell"
import { FadeIn } from "@/components/motion"

type Step = {
  icon: LucideIcon
  title: string
  description: string
  tone: "primary" | "danger" | "success"
}

const steps: Step[] = [
  { icon: Siren, title: "Hold the SOS button", description: "Press and hold for your chosen duration (3, 5 or 10 seconds) so a stray tap never triggers it.", tone: "danger" },
  { icon: ShieldAlert, title: "SOS is recorded", description: "An SOS record is saved to your history the moment it starts, even before GPS is found.", tone: "danger" },
  { icon: MapPin, title: "Real GPS is captured", description: "Your phone's GPS position is saved as it changes and shown on the map. Nothing is estimated.", tone: "success" },
  { icon: PhoneCall, title: "Call or message from your phone", description: "One-tap buttons open your dialer or SMS app for the emergency number and each contact, with your location in the message. You press call or send.", tone: "primary" },
  { icon: Route, title: "End it when you are safe", description: "End the SOS or cancel a false alarm. The route stays in your history.", tone: "success" },
]

const toneStyles = {
  primary: "bg-primary/12 text-primary ring-primary/20",
  danger: "bg-destructive/12 text-destructive ring-destructive/20",
  success: "bg-success/12 text-success ring-success/20",
} as const

export default function HowItWorksPage() {
  return (
    <AppShell title="How It Works" showBack>
      <div className="mx-auto w-full max-w-2xl py-2">
        <FadeIn>
          <p className="mb-8 text-center text-muted-foreground text-pretty">
            What SafeHer does when you need help, and what it leaves to your phone.
          </p>
        </FadeIn>

        <div className="relative">
          {/* connecting line */}
          <div className="absolute left-[27px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-primary via-destructive to-success" />

          <ol className="space-y-4">
            {steps.map((step, i) => {
              const Icon = step.icon
              return (
                <motion.li
                  key={step.title}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ delay: i * 0.06, duration: 0.4 }}
                  className="relative flex items-center gap-4"
                >
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    className={`relative z-10 flex size-14 shrink-0 items-center justify-center rounded-2xl bg-card shadow-sm ring-1 ${toneStyles[step.tone]}`}
                  >
                    <Icon className="size-6" />
                  </motion.div>
                  <div className="flex-1 rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                        {i + 1}
                      </span>
                      <h3 className="font-semibold text-sm">{step.title}</h3>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </motion.li>
              )
            })}
          </ol>
        </div>
      </div>
    </AppShell>
  )
}
