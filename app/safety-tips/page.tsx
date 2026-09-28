"use client"

import Image from "next/image"
import { motion } from "motion/react"
import { AppShell } from "@/components/app-shell"
import { FadeIn } from "@/components/motion"
import { safetyTips } from "@/lib/data"

export default function SafetyTipsPage() {
  return (
    <AppShell title="Safety Tips" showBack>
      <div className="mx-auto w-full max-w-2xl py-2">
        <FadeIn>
          <p className="mb-6 text-muted-foreground text-pretty">
            Simple habits that keep you safer every day. Swipe through and put them into practice.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {safetyTips.map((tip, i) => (
            <motion.article
              key={tip.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.06 }}
              whileHover={{ y: -4 }}
              className="group overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition-shadow hover:shadow-lg"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-secondary/50">
                <Image
                  src={tip.image || "/placeholder.svg"}
                  alt={tip.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, 320px"
                />
              </div>
              <div className="p-4">
                <h3 className="font-serif text-base font-bold text-balance">{tip.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground text-pretty">{tip.description}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
