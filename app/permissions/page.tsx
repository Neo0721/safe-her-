'use client'

import { Check, Info, MapPin, Mic, PhoneCall, type LucideIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { FadeIn } from '@/components/motion'
import { getLocationPermission, requestLocationPermission, type PermissionState } from '@/lib/location'
import { cn } from '@/lib/utils'

export default function PermissionsPage() {
  const router = useRouter()
  const [location, setLocation] = useState<PermissionState | 'checking'>('checking')
  const [microphone, setMicrophone] = useState<'unknown' | 'granted' | 'denied' | 'unsupported'>('unknown')

  const refresh = useCallback(async () => {
    setLocation(await getLocationPermission())
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      try {
        const status = await navigator.permissions.query({ name: 'microphone' as PermissionName })
        if (status.state === 'granted') setMicrophone('granted')
        else if (status.state === 'denied') setMicrophone('denied')
      } catch {
        /* permission name not supported: stays unknown */
      }
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const allowLocation = async () => {
    const result = await requestLocationPermission()
    setLocation(result)
    if (result === 'granted') toast.success('Location access allowed')
    else toast.error('Location access was not granted. You can enable it in your phone settings.')
  }

  const allowMicrophone = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicrophone('unsupported')
      toast.error('Microphone access is not available here (the page must be served over HTTPS).')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
      setMicrophone('granted')
      toast.success('Microphone access allowed')
    } catch {
      setMicrophone('denied')
      toast.error('Microphone access was not granted.')
    }
  }

  const locationGranted = location === 'granted'

  return (
    <AppShell title="Permissions" subtitle="Only what SafeHer really uses" showBack hideBottomNav>
      <div className="mx-auto w-full max-w-2xl space-y-5 py-2">
        <FadeIn>
          <div className="gradient-primary glow-primary rounded-[2rem] p-5">
            <h2 className="font-display text-xl font-extrabold text-balance">Allow what SafeHer needs</h2>
            <p className="mt-1 text-sm text-white/85 text-pretty">
              Your phone will ask for each permission. SafeHer only asks for what it actually uses.
            </p>
          </div>
        </FadeIn>

        <PermissionCard
          icon={MapPin}
          title="Location"
          description="Records your real GPS position during an SOS and live tracking, and puts it in the SMS you can send to contacts."
          required
          state={location === 'checking' ? 'checking' : locationGranted ? 'granted' : location === 'denied' ? 'denied' : 'prompt'}
          onAllow={allowLocation}
          deniedHint="Blocked. Open your phone Settings → Apps → SafeHer → Permissions to allow location."
        />

        <PermissionCard
          icon={Mic}
          title="Microphone (optional)"
          description="Only used if you turn on “Record audio” in SOS settings."
          state={microphone === 'granted' ? 'granted' : microphone === 'denied' ? 'denied' : microphone === 'unsupported' ? 'unsupported' : 'prompt'}
          onAllow={allowMicrophone}
          deniedHint="Blocked. Allow the microphone for SafeHer in your phone settings."
        />

        <div className="surface flex items-start gap-3 rounded-3xl p-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
            <PhoneCall className="size-6" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Calls and SMS</h3>
            <p className="mt-0.5 flex items-start gap-1.5 text-xs text-muted-foreground text-pretty">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              No permission needed. SafeHer opens your phone&apos;s dialer or SMS app with the number and message filled in; you press call or send.
            </p>
          </div>
        </div>

        <FadeIn delay={0.1}>
          <button
            type="button"
            onClick={() => router.replace('/home')}
            className="surface-raised min-h-14 w-full rounded-2xl py-4 font-display font-bold transition-all active:scale-[0.98]"
          >
            {locationGranted ? 'Continue to SafeHer' : 'Continue without location'}
          </button>
          {!locationGranted && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Without location, SOS still works but cannot record or share where you are.
            </p>
          )}
        </FadeIn>
      </div>
    </AppShell>
  )
}

function PermissionCard({
  icon: Icon,
  title,
  description,
  required,
  state,
  onAllow,
  deniedHint,
}: {
  icon: LucideIcon
  title: string
  description: string
  required?: boolean
  state: 'checking' | 'granted' | 'denied' | 'prompt' | 'unsupported'
  onAllow: () => void
  deniedHint: string
}) {
  return (
    <div className="surface rounded-3xl p-4">
      <div className="flex items-center gap-4">
        <span
          className={cn(
            'flex size-12 shrink-0 items-center justify-center rounded-2xl transition-colors',
            state === 'granted' ? 'gradient-success' : 'gradient-primary',
          )}
        >
          <Icon className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{title}</h3>
            {required && (
              <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-destructive">
                Recommended
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground text-pretty">{description}</p>
        </div>
      </div>
      <div className="mt-3">
        {state === 'granted' ? (
          <span className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-success/15 text-sm font-semibold text-success">
            <Check className="size-4" /> Allowed
          </span>
        ) : state === 'checking' ? (
          <span className="flex min-h-11 items-center justify-center text-sm text-muted-foreground">Checking…</span>
        ) : state === 'unsupported' ? (
          <p className="text-xs text-muted-foreground">Not available in this context.</p>
        ) : (
          <>
            <button
              type="button"
              onClick={onAllow}
              className="gradient-primary min-h-12 w-full rounded-2xl text-sm font-bold active:scale-[0.98]"
            >
              {state === 'denied' ? 'Try again' : 'Allow'}
            </button>
            {state === 'denied' && <p className="mt-2 text-xs text-danger">{deniedHint}</p>}
          </>
        )}
      </div>
    </div>
  )
}
