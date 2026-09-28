'use client'

import {
  AlertTriangle,
  Battery,
  History,
  Lightbulb,
  MapPin,
  Navigation,
  Settings2,
  ShieldCheck,
  Signal,
  Users,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ActivityCard } from '@/components/activity-card'
import { AppShell } from '@/components/app-shell'
import { FadeIn, Stagger, StaggerItem } from '@/components/motion'
import { SosHoldButton } from '@/components/sos-hold-button'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { getActiveSos } from '@/lib/active-sos'
import { apiJson, errorMessage } from '@/lib/api-fetch'
import { useBattery, useNetwork } from '@/lib/hooks/use-device-status'
import { getLocationPermission, type PermissionState } from '@/lib/location'
import { setHoldSeconds } from '@/lib/sos-prefs'
import type { ActivityLog, Contact, SosSettings } from '@/lib/types'
import { cn, timeAgo } from '@/lib/utils'

const quickActions = [
  { label: 'Live Location', icon: MapPin, href: '/tracking', bg: 'bg-primary/12', color: 'text-primary' },
  { label: 'Emergency Contacts', icon: Users, href: '/contacts', bg: 'bg-secondary/12', color: 'text-secondary' },
  { label: 'SOS History', icon: History, href: '/history', bg: 'bg-accent/12', color: 'text-accent' },
  { label: 'SOS Settings', icon: Settings2, href: '/sos-settings', bg: 'bg-primary/12', color: 'text-primary' },
  { label: 'Safety Tips', icon: Lightbulb, href: '/safety-tips', bg: 'bg-success/12', color: 'text-success' },
]

const LOCATION_LABEL: Record<PermissionState, string> = {
  granted: 'Allowed',
  denied: 'Blocked',
  prompt: 'Not yet allowed',
  unsupported: 'Unsupported',
}

export default function HomePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [name, setName] = useState<string | null>(null)
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [contactCount, setContactCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [locationPermission, setLocationPermission] = useState<PermissionState | null>(null)
  const [activeSos, setActiveSosState] = useState<{ isTest: boolean } | null>(null)

  const battery = useBattery()
  const network = useNetwork()

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const [profile, logs, contacts, settings] = await Promise.all([
        apiJson<{ full_name: string }>('/api/profile'),
        apiJson<ActivityLog[]>('/api/activity?limit=5'),
        apiJson<Contact[]>('/api/contacts'),
        apiJson<SosSettings>('/api/settings'),
      ])
      setName(profile.full_name)
      setActivities(logs)
      setContactCount(contacts.length)
      setHoldSeconds(settings.hold_duration)
    } catch (error) {
      setLoadError(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    void load()
    setActiveSosState(getActiveSos(user.uid))
    void getLocationPermission().then(setLocationPermission)
  }, [user, load])

  const startDrill = () => {
    toast.info('Starting SOS drill. Your contacts will not be contacted.')
    router.push('/emergency?start=1&drill=1')
  }

  const displayName = name ? name.split(' ')[0] : ''
  const connected = network.connected

  return (
    <AppShell showLogo>
      <FadeIn className="mb-2">
        <p className="text-sm font-medium text-muted-foreground">Welcome back</p>
        <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground">
          {loading ? 'Hi…' : displayName ? `Hi ${displayName}` : 'Hi there'}
        </h1>
      </FadeIn>

      {activeSos && (
        <FadeIn className="mt-3">
          <Link
            href="/emergency"
            className="flex min-h-14 items-center gap-3 rounded-2xl bg-danger px-4 py-3 text-white shadow-lg"
          >
            <AlertTriangle className="size-6 shrink-0" />
            <span className="text-sm font-semibold">
              {activeSos.isTest ? 'A drill is in progress.' : 'An SOS is still active.'} Tap to return.
            </span>
          </Link>
        </FadeIn>
      )}

      <FadeIn delay={0.05} className="my-6 flex justify-center">
        <SosHoldButton />
      </FadeIn>

      {loadError && (
        <FadeIn className="mb-4">
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/8 p-3.5 text-sm">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">Could not load your data</p>
              <p className="text-muted-foreground">{loadError}</p>
              <button
                type="button"
                onClick={() => {
                  setLoading(true)
                  void load()
                }}
                className="mt-2 min-h-11 rounded-xl border border-border bg-card px-4 font-semibold"
              >
                Try again
              </button>
            </div>
          </div>
        </FadeIn>
      )}

      {/* Readiness: real device state only. */}
      <FadeIn delay={0.1} className="mb-6">
        <Card className="gap-3 p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <h2 className="text-sm font-semibold">Device readiness</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatusTile
              icon={Navigation}
              label="Location permission"
              value={locationPermission ? LOCATION_LABEL[locationPermission] : 'Checking…'}
              good={locationPermission === 'granted'}
              bad={locationPermission === 'denied' || locationPermission === 'unsupported'}
            />
            <StatusTile
              icon={Signal}
              label="Network"
              value={connected === null ? 'Checking…' : connected ? `Online${network.type ? ` (${network.type})` : ''}` : 'Offline'}
              good={connected === true}
              bad={connected === false}
            />
            <StatusTile
              icon={Battery}
              label="Battery"
              value={battery.level === null ? (battery.ready ? 'Not available' : 'Checking…') : `${battery.level}%${battery.charging ? ' · charging' : ''}`}
              good={battery.level !== null && battery.level >= 20}
              bad={battery.level !== null && battery.level < 20}
            />
            <StatusTile
              icon={Users}
              label="Emergency contacts"
              value={contactCount === null ? 'Checking…' : contactCount === 0 ? 'None added' : `${contactCount} saved`}
              good={!!contactCount}
              bad={contactCount === 0}
            />
          </div>
          {locationPermission && locationPermission !== 'granted' && (
            <Link href="/permissions" className="min-h-11 text-sm font-semibold text-primary">
              Allow location access →
            </Link>
          )}
        </Card>
      </FadeIn>

      <FadeIn delay={0.15} className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Quick Actions</h2>
        <Stagger className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => (
            <StaggerItem key={action.label}>
              <Link href={action.href} className="block h-full">
                <Card className="group h-full min-h-28 p-4 transition-all duration-200 active:scale-95">
                  <div className={`flex size-12 items-center justify-center rounded-xl ${action.bg}`}>
                    <action.icon className={`size-6 ${action.color}`} />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-foreground">{action.label}</p>
                </Card>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </FadeIn>

      <FadeIn delay={0.2} className="mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent Activity</h2>
          <Link href="/history" className="flex min-h-11 items-center text-xs font-semibold text-primary">
            View history →
          </Link>
        </div>
        <Stagger className="space-y-2">
          {activities.length > 0 ? (
            activities.slice(0, 3).map((a) => (
              <StaggerItem key={a.id}>
                <ActivityCard activity={{ id: a.id, type: a.type, title: a.title, detail: a.detail, time: timeAgo(a.created_at) }} />
              </StaggerItem>
            ))
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {loading ? 'Loading…' : 'No safety events logged yet.'}
            </p>
          )}
        </Stagger>
      </FadeIn>

      <FadeIn delay={0.25} className="mb-4">
        <button
          type="button"
          onClick={startDrill}
          className={cn(
            'flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
          )}
        >
          <Zap className="size-4" />
          Practice with an SOS drill (contacts are not contacted)
        </button>
      </FadeIn>
    </AppShell>
  )
}

function StatusTile({
  icon: Icon,
  label,
  value,
  good,
  bad,
}: {
  icon: typeof Navigation
  label: string
  value: string
  good?: boolean
  bad?: boolean
}) {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-xl bg-muted/40 p-3">
      <Icon className={cn('mt-0.5 size-4 shrink-0', good ? 'text-success' : bad ? 'text-danger' : 'text-muted-foreground')} />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="break-words text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  )
}
