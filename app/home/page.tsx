'use client'

import {
  AlertTriangle,
  Battery,
  ChevronRight,
  History,
  MapPin,
  Navigation,
  Settings2,
  ShieldCheck,
  Signal,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ActivityCard } from '@/components/activity-card'
import { AppShell } from '@/components/app-shell'
import { FadeIn, Stagger, StaggerItem } from '@/components/motion'
import { SosHoldButton } from '@/components/sos-hold-button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { getActiveSos } from '@/lib/active-sos'
import { ApiError, apiJson, errorMessage } from '@/lib/api-fetch'
import { ensureProfile } from '@/lib/auth-actions'
import { safetyTips } from '@/lib/data'
import { useBattery, useNetwork } from '@/lib/hooks/use-device-status'
import { getLocationPermission, type PermissionState } from '@/lib/location'
import { powerTrigger, type TriggerStatus } from '@/lib/native/sos-trigger'
import { setHoldSeconds } from '@/lib/sos-prefs'
import type { ActivityLog, Contact, SosSettings } from '@/lib/types'
import { cn, timeAgo } from '@/lib/utils'

const quickActions = [
  { label: 'Live location', hint: 'Track on the map', icon: MapPin, href: '/tracking', tone: 'gradient-sky' },
  { label: 'My circle', hint: 'Trusted contacts', icon: Users, href: '/contacts', tone: 'gradient-primary' },
  { label: 'SOS settings', hint: 'Triggers & timing', icon: Settings2, href: '/sos-settings', tone: 'gradient-warm' },
  { label: 'History', hint: 'Past SOS & drills', icon: History, href: '/history', tone: 'gradient-success' },
] as const

function greetingFor(date = new Date()) {
  const h = date.getHours()
  if (h < 5) return 'Stay safe tonight'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function HomePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [name, setName] = useState<string | null>(null)
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [contactCount, setContactCount] = useState<number | null>(null)
  const [settings, setSettings] = useState<SosSettings | null>(null)
  const [triggerStatus, setTriggerStatus] = useState<TriggerStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [locationPermission, setLocationPermission] = useState<PermissionState | null>(null)
  const [activeSos, setActiveSosState] = useState<{ isTest: boolean } | null>(null)

  const battery = useBattery()
  const network = useNetwork()

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      // A signed-in account whose profile row is missing (e.g. the server database was reset) is re-created.
      if (user) {
        try {
          await apiJson('/api/profile')
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) await ensureProfile(user)
          else throw error
        }
      }
      const [profile, logs, contacts, saved] = await Promise.all([
        apiJson<{ full_name: string }>('/api/profile'),
        apiJson<ActivityLog[]>('/api/activity?limit=5'),
        apiJson<Contact[]>('/api/contacts'),
        apiJson<SosSettings>('/api/settings'),
      ])
      setName(profile.full_name)
      setActivities(logs)
      setContactCount(contacts.length)
      setSettings(saved)
      setHoldSeconds(saved.hold_duration)
    } catch (error) {
      setLoadError(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    void load()
    setActiveSosState(getActiveSos(user.uid))
    void getLocationPermission().then(setLocationPermission)
    void powerTrigger.status().then(setTriggerStatus)
  }, [user, load])

  const startDrill = () => {
    toast.info('Starting SOS drill. Your contacts will not be contacted.')
    router.push('/emergency?start=1&drill=1')
  }

  // Readiness is computed only from real device and account state.
  const checks = useMemo(() => {
    const online = network.connected
    const level = battery.level
    return [
      {
        key: 'location',
        label: 'Location',
        icon: Navigation,
        ok: locationPermission === null ? null : locationPermission === 'granted',
        detail: locationPermission === 'granted' ? 'Allowed' : locationPermission === 'denied' ? 'Blocked' : 'Not allowed yet',
        href: '/permissions',
      },
      {
        key: 'circle',
        label: 'Circle',
        icon: Users,
        ok: contactCount === null ? null : contactCount > 0,
        detail: contactCount ? `${contactCount} saved` : 'None added',
        href: '/contacts',
      },
      {
        key: 'network',
        label: 'Network',
        icon: Signal,
        ok: online,
        detail: online === null ? 'Checking' : online ? `Online${network.type ? ` · ${network.type}` : ''}` : 'Offline',
        href: null,
      },
      {
        key: 'battery',
        label: 'Battery',
        icon: Battery,
        ok: level === null ? null : level >= 20,
        detail: level === null ? 'Not available' : `${level}%${battery.charging ? ' · charging' : ''}`,
        href: null,
      },
    ] satisfies { key: string; label: string; icon: LucideIcon; ok: boolean | null; detail: string; href: string | null }[]
  }, [locationPermission, contactCount, network.connected, network.type, battery.level, battery.charging])

  const known = checks.filter((c) => c.ok !== null)
  const okCount = known.filter((c) => c.ok).length
  const percent = known.length ? Math.round((okCount / known.length) * 100) : 0
  const needs = known.filter((c) => !c.ok)
  const ready = known.length > 0 && needs.length === 0

  const displayName = name ? name.split(' ')[0] : ''
  const tip = safetyTips[new Date().getDate() % safetyTips.length]
  const triggerArmed = settings?.power_trigger === 1 && triggerStatus?.running === true

  const ringRadius = 30
  const ringLength = 2 * Math.PI * ringRadius

  return (
    <AppShell showLogo>
      {/* Greeting */}
      <FadeIn className="mb-1 mt-1 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{greetingFor()}</p>
          <h1 className="truncate font-display text-3xl font-extrabold tracking-tight">
            {loading ? <Skeleton className="mt-1 h-9 w-40 rounded-xl" /> : displayName || 'there'}
          </h1>
        </div>
        <Link
          href="/profile"
          aria-label="Open profile"
          className="gradient-primary glow-primary flex size-12 shrink-0 items-center justify-center rounded-2xl font-display text-lg font-bold"
        >
          {(displayName || user?.email || 'U').charAt(0).toUpperCase()}
        </Link>
      </FadeIn>

      {activeSos && (
        <FadeIn className="mt-3">
          <Link href="/emergency" className="gradient-danger glow-danger flex min-h-14 items-center gap-3 rounded-3xl px-4 py-3">
            <AlertTriangle className="size-6 shrink-0" />
            <span className="flex-1 text-sm font-semibold">
              {activeSos.isTest ? 'A drill is in progress.' : 'An SOS is still active.'} Tap to return.
            </span>
            <ChevronRight className="size-5" />
          </Link>
        </FadeIn>
      )}

      {/* SOS */}
      <FadeIn delay={0.05} className="my-5 flex justify-center">
        <SosHoldButton />
      </FadeIn>

      {/* Power-button trigger status */}
      {powerTrigger.available() && settings && (
        <FadeIn delay={0.08} className="mb-4">
          <Link
            href="/sos-settings"
            className={cn(
              'surface flex items-center gap-3 rounded-3xl p-4',
              triggerArmed ? 'border-success/40' : '',
            )}
          >
            <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-2xl', triggerArmed ? 'gradient-success' : 'gradient-warm')}>
              <Zap className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {triggerArmed ? `Power-button trigger is on (${settings.power_presses}×)` : 'Add a hidden emergency trigger'}
              </p>
              <p className="text-xs text-muted-foreground">
                {triggerArmed
                  ? `Press the power button ${settings.power_presses} times quickly to start an SOS, even from the lock screen.`
                  : 'Press the power button several times quickly to start an SOS without opening the app.'}
              </p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
          </Link>
        </FadeIn>
      )}

      {loadError && (
        <FadeIn className="mb-4">
          <div role="alert" className="surface-raised flex items-start gap-3 rounded-3xl border-danger/30 p-4 text-sm">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Could not load your data</p>
              <p className="text-muted-foreground">{loadError}</p>
              <button
                type="button"
                onClick={() => {
                  setLoading(true)
                  void load()
                }}
                className="gradient-primary mt-3 min-h-11 rounded-2xl px-5 font-semibold"
              >
                Try again
              </button>
            </div>
          </div>
        </FadeIn>
      )}

      {/* Readiness */}
      <FadeIn delay={0.1} className="mb-6">
        <div className="surface rounded-3xl p-4">
          <div className="flex items-center gap-4">
            <div className="relative size-[4.5rem] shrink-0">
              <svg viewBox="0 0 72 72" className="size-full -rotate-90" aria-hidden="true">
                <defs>
                  <linearGradient id="readyGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={ready ? '#34d399' : '#fbbf24'} />
                    <stop offset="100%" stopColor={ready ? '#059669' : '#f97316'} />
                  </linearGradient>
                </defs>
                <circle cx="36" cy="36" r={ringRadius} fill="none" className="stroke-muted" strokeWidth="7" />
                <circle
                  cx="36"
                  cy="36"
                  r={ringRadius}
                  fill="none"
                  stroke="url(#readyGrad)"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={ringLength}
                  strokeDashoffset={ringLength * (1 - percent / 100)}
                  style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-display text-lg font-bold">{percent}%</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 font-display text-lg font-bold leading-tight">
                <ShieldCheck className={cn('size-5 shrink-0', ready ? 'text-success' : 'text-warning')} />
                {known.length === 0 ? 'Checking…' : ready ? "You're ready" : `${needs.length} thing${needs.length === 1 ? '' : 's'} to fix`}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {ready ? 'Location, circle, network and battery all look good.' : 'Fix these so SOS works the moment you need it.'}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2">
            {checks.map((c) => {
              const state = c.ok === null ? 'unknown' : c.ok ? 'ok' : 'bad'
              const body = (
                <>
                  <span
                    className={cn(
                      'flex size-10 items-center justify-center rounded-2xl',
                      state === 'ok' && 'bg-success/15 text-success',
                      state === 'bad' && 'bg-danger/15 text-danger',
                      state === 'unknown' && 'bg-muted text-muted-foreground',
                    )}
                  >
                    <c.icon className="size-5" />
                  </span>
                  <span className="text-[11px] font-semibold leading-tight">{c.label}</span>
                  <span className="line-clamp-2 text-center text-[10px] leading-tight text-muted-foreground">{c.detail}</span>
                </>
              )
              const cls = 'flex min-w-0 flex-col items-center gap-1 rounded-2xl p-1.5 text-center'
              return c.href && !c.ok ? (
                <Link key={c.key} href={c.href} className={cn(cls, 'active:bg-muted')}>
                  {body}
                </Link>
              ) : (
                <div key={c.key} className={cls}>
                  {body}
                </div>
              )
            })}
          </div>
        </div>
      </FadeIn>

      {/* Quick actions */}
      <FadeIn delay={0.15} className="mb-6">
        <h2 className="mb-3 px-1 font-display text-base font-bold">Quick actions</h2>
        <Stagger className="grid grid-cols-2 gap-3">
          {quickActions.map((a) => (
            <StaggerItem key={a.label}>
              <Link
                href={a.href}
                className={cn('relative flex min-h-[7.5rem] flex-col justify-between overflow-hidden rounded-3xl p-4 shadow-lg active:scale-[0.97] transition-transform', a.tone)}
              >
                <a.icon className="pointer-events-none absolute -bottom-3 -right-3 size-20 opacity-20" strokeWidth={1.5} />
                <span className="flex size-10 items-center justify-center rounded-2xl bg-white/20">
                  <a.icon className="size-5" />
                </span>
                <span>
                  <span className="block font-display text-[15px] font-bold leading-tight">{a.label}</span>
                  <span className="block text-xs text-white/80">{a.hint}</span>
                </span>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </FadeIn>

      {/* Safety tip of the day */}
      <FadeIn delay={0.2} className="mb-6">
        <Link href="/safety-tips" className="surface group relative flex items-stretch overflow-hidden rounded-3xl">
          <div className="relative w-28 shrink-0">
            <Image src={tip.image} alt="" fill sizes="112px" className="object-cover" />
          </div>
          <div className="min-w-0 flex-1 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Safety tip · {tip.category}</p>
            <p className="mt-1 font-display text-[15px] font-bold leading-snug">{tip.title}</p>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{tip.description}</p>
          </div>
        </Link>
      </FadeIn>

      {/* Recent activity */}
      <FadeIn delay={0.25} className="mb-6">
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="font-display text-base font-bold">Recent activity</h2>
          <Link href="/history" className="flex min-h-11 items-center gap-0.5 text-xs font-semibold text-primary">
            View all <ChevronRight className="size-4" />
          </Link>
        </div>
        <Stagger className="space-y-2">
          {loading ? (
            <>
              <Skeleton className="h-16 rounded-2xl" />
              <Skeleton className="h-16 rounded-2xl" />
            </>
          ) : activities.length > 0 ? (
            activities.slice(0, 3).map((a) => (
              <StaggerItem key={a.id}>
                <ActivityCard activity={{ id: a.id, type: a.type, title: a.title, detail: a.detail, time: timeAgo(a.created_at) }} />
              </StaggerItem>
            ))
          ) : (
            <p className="surface rounded-2xl py-6 text-center text-sm text-muted-foreground">No safety events logged yet.</p>
          )}
        </Stagger>
      </FadeIn>

      {/* Drill */}
      <FadeIn delay={0.3} className="mb-2">
        <button
          type="button"
          onClick={startDrill}
          className="surface flex min-h-16 w-full items-center gap-3 rounded-3xl border-dashed px-4 text-left transition-transform active:scale-[0.98]"
        >
          <span className="gradient-warm flex size-11 shrink-0 items-center justify-center rounded-2xl">
            <Zap className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Practice with an SOS drill</span>
            <span className="block text-xs text-muted-foreground">Safe to try: nobody is contacted.</span>
          </span>
          <ChevronRight className="size-5 text-muted-foreground" />
        </button>
      </FadeIn>
    </AppShell>
  )
}
