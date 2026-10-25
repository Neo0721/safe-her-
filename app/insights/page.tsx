'use client'

import { BatteryMedium, BellRing, Brain, Lightbulb, TrendingDown } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { FadeIn } from '@/components/motion'
import { useAuth } from '@/contexts/AuthContext'
import { apiJson } from '@/lib/api-fetch'
import { readBatteryLog, sampleBattery } from '@/lib/battery-log'
import {
  fitBatteryDrain,
  formatDuration,
  latestDischargeRun,
  minutesUntil,
  recommendTips,
  type BatterySample,
  type Situation,
} from '@/lib/insights'
import { isSmartAlertsEnabled, setSmartAlerts } from '@/lib/smart-alerts'
import type { Contact, SosEvent, SosSettings } from '@/lib/types'

interface Loaded {
  contactCount: number
  hasBloodGroup: boolean
  hasPhone: boolean
  settings: SosSettings
  drillsDone: number
  mediaCount: number
}

export default function InsightsPage() {
  const { user } = useAuth()
  const [data, setData] = useState<Loaded | null>(null)
  const [partial, setPartial] = useState(false)
  const [log, setLog] = useState<BatterySample[]>([])
  const [reading, setReading] = useState<{ level: number; charging: boolean } | null | undefined>(undefined)
  const [alerts, setAlerts] = useState(false)

  useEffect(() => {
    setAlerts(isSmartAlertsEnabled())
  }, [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    void (async () => {
      const [profile, contacts, settings, history, media] = await Promise.allSettled([
        apiJson<{ blood_group?: string | null; phone?: string | null }>('/api/profile'),
        apiJson<Contact[]>('/api/contacts'),
        apiJson<SosSettings>('/api/settings'),
        apiJson<SosEvent[]>('/api/history?limit=50'),
        apiJson<unknown[]>('/api/media'),
      ])
      if (cancelled) return
      setPartial([profile, contacts, settings, history, media].some((r) => r.status === 'rejected'))
      const ok = <T,>(r: PromiseSettledResult<T>) => (r.status === 'fulfilled' ? r.value : null)
      const p = ok(profile)
      const s = ok(settings)
      setData({
        contactCount: ok(contacts)?.length ?? 2, // unknown: assume fine rather than nag
        hasBloodGroup: p ? Boolean(p.blood_group) : true,
        hasPhone: p ? Boolean(p.phone) : true,
        settings: s ?? { hold_duration: 3, location_sharing: 1, audio_recording: 0, notify_contacts: 1, power_trigger: 1, power_presses: 5, motion_detection: 1 },
        drillsDone: ok(history)?.filter((e) => e.is_test === 1).length ?? 1,
        mediaCount: ok(media)?.length ?? 1,
      })
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  const refreshBattery = useCallback(async (force = false) => {
    const result = await sampleBattery(force)
    setReading(result ? { level: result.level, charging: result.charging } : null)
    setLog(result?.log ?? readBatteryLog())
  }, [])

  useEffect(() => {
    void refreshBattery(true)
    const timer = setInterval(() => void refreshBattery(), 60_000)
    return () => clearInterval(timer)
  }, [refreshBattery])

  const fit = useMemo(() => fitBatteryDrain(log), [log])
  const run = useMemo(() => latestDischargeRun(log), [log])

  const tips = useMemo(() => {
    if (!data) return []
    const situation: Situation = {
      contactCount: data.contactCount,
      hasBloodGroup: data.hasBloodGroup,
      hasPhone: data.hasPhone,
      powerTrigger: data.settings.power_trigger === 1,
      motionDetection: data.settings.motion_detection === 1,
      drillsDone: data.drillsDone,
      mediaCount: data.mediaCount,
      hour: new Date().getHours(),
      batteryLevel: reading?.level ?? null,
      batteryRatePerHour: fit?.ratePerHour ?? null,
    }
    return recommendTips(situation, 4)
  }, [data, reading, fit])

  const toggleAlerts = async () => {
    const result = await setSmartAlerts(!alerts)
    setAlerts(result.enabled)
    if (result.reason) toast.error(result.reason)
    else toast.success(result.enabled ? 'Smart alerts on' : 'Smart alerts off')
  }

  const to10 = reading && fit ? minutesUntil(reading.level, 10, fit) : null
  const to0 = reading && fit ? minutesUntil(reading.level, 0, fit) : null

  return (
    <AppShell title="Insights" subtitle="Tips and battery forecast" showBack>
      <div className="mx-auto w-full max-w-2xl space-y-5 py-2">
        <FadeIn>
          <section className="surface rounded-3xl p-5">
            <h2 className="flex items-center gap-2 font-serif text-xl font-semibold">
              <Lightbulb className="size-5 text-primary" /> Recommended for you
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              A content-based recommender: your current situation and each tip are scored on the same topics and ranked by cosine similarity. It is a simple statistical method, not a neural network.
            </p>
            {partial && (
              <p className="mt-2 rounded-xl bg-warning/10 p-2 text-xs">Some of your data could not be loaded, so suggestions may be incomplete.</p>
            )}
            {!data ? (
              <p className="mt-4 text-sm text-muted-foreground">Looking at your setup…</p>
            ) : tips.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Nothing to suggest right now. Your safety setup looks complete.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {tips.map((t) => (
                  <li key={t.id} className="rounded-2xl bg-muted/60 p-3">
                    <p className="text-sm font-semibold">{t.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground text-pretty">{t.body}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Because {t.because.join(' and ')} · match {Math.round(t.score * 100)}%</p>
                    <Link href={t.href} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-primary">
                      {t.cta} →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </FadeIn>

        <FadeIn delay={0.05}>
          <section className="surface rounded-3xl p-5">
            <h2 className="flex items-center gap-2 font-serif text-xl font-semibold">
              <TrendingDown className="size-5 text-primary" /> Battery forecast
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Linear regression (least squares) on your phone&apos;s real battery readings, taken while SafeHer is open and you are not charging. Readings stay on this phone.
            </p>

            {reading === undefined ? (
              <p className="mt-4 text-sm text-muted-foreground">Reading battery…</p>
            ) : reading === null ? (
              <p className="mt-4 text-sm text-muted-foreground">This device does not report its battery level, so no forecast is possible.</p>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="flex items-center gap-2 text-sm">
                  <BatteryMedium className="size-4" />
                  <span className="font-semibold">{reading.level}%</span>
                  <span className="text-muted-foreground">{reading.charging ? 'charging' : 'on battery'}</span>
                </p>
                {reading.charging ? (
                  <p className="text-sm text-muted-foreground">Charging now. A forecast needs a few readings while unplugged.</p>
                ) : fit ? (
                  <div className="rounded-2xl bg-muted/60 p-3 text-sm">
                    <p>
                      Draining about <b>{fit.ratePerHour.toFixed(1)}% per hour</b>
                      {to10 !== null && <> · about <b>{formatDuration(to10)}</b> until 10%</>}
                      {to10 === null && to0 !== null && <> · about <b>{formatDuration(to0)}</b> until empty</>}.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Based on {fit.samples} readings over {Math.round(fit.spanMinutes)} min · fit quality R² {fit.r2.toFixed(2)}. Heavy use or GPS tracking will change the real rate.
                    </p>
                    <Sparkline samples={run} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Collecting data: {Math.min(run.length, 4)} of 4 readings, spanning at least 15 minutes while unplugged. Keep using the phone; the forecast appears by itself.
                  </p>
                )}
              </div>
            )}
          </section>
        </FadeIn>

        <FadeIn delay={0.1}>
          <section className="surface rounded-3xl p-5">
            <h2 className="flex items-center gap-2 font-serif text-xl font-semibold">
              <BellRing className="size-5 text-primary" /> Smart alerts
            </h2>
            <p className="mt-1 text-xs text-muted-foreground text-pretty">
              When on, SafeHer shows a notification on this phone if the forecast says the battery will reach 10% within about 45 minutes. It only works while the app is open, never contacts anyone, and sends nothing to a server. The fall check-in is in SOS settings.
            </p>
            <button
              type="button"
              role="switch"
              aria-checked={alerts}
              onClick={toggleAlerts}
              className="mt-3 flex min-h-12 w-full items-center justify-between rounded-2xl bg-muted/60 px-4 text-sm font-semibold"
            >
              Battery forecast alerts
              <span className={`inline-flex h-7 w-12 items-center rounded-full p-1 transition-colors ${alerts ? 'bg-primary' : 'bg-border'}`}>
                <span className={`size-5 rounded-full bg-white transition-transform ${alerts ? 'translate-x-5' : ''}`} />
              </span>
            </button>
          </section>
        </FadeIn>

        <p className="flex items-start gap-2 px-1 text-xs text-muted-foreground">
          <Brain className="mt-0.5 size-3.5 shrink-0" /> Photo labelling (a bundled neural-network model) is in the Scanner. Everything on this page runs on your phone.
        </p>
      </div>
    </AppShell>
  )
}

function Sparkline({ samples }: { samples: BatterySample[] }) {
  if (samples.length < 2) return null
  const t0 = samples[0].t
  const span = Math.max(1, samples[samples.length - 1].t - t0)
  const lo = Math.min(...samples.map((s) => s.level))
  const hi = Math.max(...samples.map((s) => s.level), lo + 1)
  const pts = samples
    .map((s) => `${(((s.t - t0) / span) * 100).toFixed(1)},${(30 - ((s.level - lo) / (hi - lo)) * 26 - 2).toFixed(1)}`)
    .join(' ')
  return (
    <svg viewBox="0 0 100 30" className="mt-2 h-12 w-full" role="img" aria-label="Battery level over the recorded period">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
