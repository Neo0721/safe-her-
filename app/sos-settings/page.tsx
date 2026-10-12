'use client'

import {
  BatteryCharging,
  BellRing,
  Check,
  ChevronRight,
  Lock,
  Mic,
  Navigation,
  PhoneCall,
  Power,
  Rocket,
  ShieldAlert,
  Smartphone,
  Timer,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { FadeIn } from '@/components/motion'
import { SettingsToggle } from '@/components/settings-toggle'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/contexts/AuthContext'
import { apiJson, errorMessage } from '@/lib/api-fetch'
import { powerTrigger, type TriggerStatus } from '@/lib/native/sos-trigger'
import { setHoldSeconds } from '@/lib/sos-prefs'
import type { SosSettings } from '@/lib/types'
import { cn } from '@/lib/utils'

const delays = [3, 5, 10]
const pressOptions = [3, 4, 5, 6]

export default function SosSettingsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [holdDuration, setHoldDuration] = useState(3)
  const [locationSharing, setLocationSharing] = useState(true)
  const [audioRecording, setAudioRecording] = useState(false)
  const [contactShortcuts, setContactShortcuts] = useState(true)
  const [powerOn, setPowerOn] = useState(false)
  const [powerPresses, setPowerPresses] = useState(5)
  const [triggerStatus, setTriggerStatus] = useState<TriggerStatus | null>(null)
  const [saving, setSaving] = useState(false)

  const native = powerTrigger.available()

  const refreshStatus = useCallback(async () => {
    setTriggerStatus(await powerTrigger.status())
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await apiJson<SosSettings>('/api/settings')
      setHoldDuration(data.hold_duration)
      setLocationSharing(data.location_sharing === 1)
      setAudioRecording(data.audio_recording === 1)
      setContactShortcuts(data.notify_contacts === 1)
      setPowerOn(data.power_trigger === 1)
      setPowerPresses(data.power_presses)
      await refreshStatus()
    } catch (error) {
      setLoadError(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [refreshStatus])

  useEffect(() => {
    if (user) void load()
  }, [user, load])

  // Settings screens in Android open in a separate task; refresh health when the user comes back.
  useEffect(() => {
    if (!native) return
    const onVisible = () => document.visibilityState === 'visible' && void refreshStatus()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [native, refreshStatus])

  const toggleTrigger = async (next: boolean) => {
    if (next && native) {
      const granted = await powerTrigger.ensurePermission().catch(() => false)
      if (!granted) {
        toast.error('Allow notifications so Android lets SafeHer keep listening in the background.')
        return
      }
    }
    setPowerOn(next)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const saved = await apiJson<SosSettings>('/api/settings', {
        method: 'PUT',
        json: {
          hold_duration: holdDuration,
          location_sharing: locationSharing,
          audio_recording: audioRecording,
          notify_contacts: contactShortcuts,
          power_trigger: powerOn,
          power_presses: powerPresses,
        },
      })
      setHoldSeconds(saved.hold_duration)

      // Apply to the phone only after the server accepted it, so the two never disagree.
      if (native) {
        try {
          if (saved.power_trigger === 1) await powerTrigger.start(saved.power_presses)
          else await powerTrigger.stop()
        } catch (error) {
          toast.error(`Saved, but the trigger could not start: ${errorMessage(error)}`)
          await refreshStatus()
          return
        }
        await refreshStatus()
      }
      toast.success('SOS settings saved')
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to save SOS settings.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell title="SOS settings" subtitle="Triggers, timing and what happens" showBack>
      {loading ? (
        <div className="flex h-64 items-center justify-center" role="status">
          <div className="size-7 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
        </div>
      ) : loadError ? (
        <div role="alert" className="surface-raised mt-6 rounded-3xl border-danger/30 p-5 text-sm">
          <p className="font-semibold">Could not load your SOS settings</p>
          <p className="mt-1 text-muted-foreground">{loadError}</p>
          <button type="button" onClick={() => void load()} className="gradient-primary mt-4 min-h-11 rounded-2xl px-5 font-semibold">
            Try again
          </button>
        </div>
      ) : (
        <div className="space-y-6 py-1">
          {/* Quick trigger */}
          <FadeIn>
            <section className="surface overflow-hidden rounded-3xl">
              <div className="gradient-primary relative p-5">
                <Power className="pointer-events-none absolute -right-4 -top-4 size-28 opacity-15" strokeWidth={1.4} />
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/75">Quick trigger</p>
                <h2 className="mt-1 font-display text-xl font-bold leading-tight">Press the power button to start an SOS</h2>
                <p className="mt-1.5 text-sm text-white/85">
                  No need to unlock or open the app. Press the power button several times in a row; SafeHer vibrates and opens the emergency screen.
                </p>
              </div>

              <div className="space-y-4 p-4">
                {!native ? (
                  <p className="flex items-start gap-2 rounded-2xl bg-muted/60 p-3 text-sm text-muted-foreground">
                    <Smartphone className="mt-0.5 size-4 shrink-0" />
                    The power-button trigger works in the SafeHer Android app. It is not available in a web browser.
                  </p>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">Enable power-button trigger</p>
                        <p className="text-xs text-muted-foreground">Shows a small notification while it is listening.</p>
                      </div>
                      <Switch checked={powerOn} onCheckedChange={(v) => void toggleTrigger(v)} aria-label="Enable power-button trigger" />
                    </div>

                    <div className={cn('transition-opacity', !powerOn && 'pointer-events-none opacity-40')} aria-disabled={!powerOn}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Presses needed</p>
                      <div className="grid grid-cols-4 gap-2" role="group" aria-label="Presses needed">
                        {pressOptions.map((n) => {
                          const active = powerPresses === n
                          return (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setPowerPresses(n)}
                              aria-pressed={active}
                              className={cn(
                                'flex min-h-14 flex-col items-center justify-center rounded-2xl border-2 font-display text-lg font-bold transition-all',
                                active ? 'gradient-primary border-transparent shadow-md' : 'surface-raised hover:border-primary/40',
                              )}
                            >
                              {n}×
                            </button>
                          )
                        })}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Within about 5 seconds. More presses means fewer accidental triggers. 5 is a good balance.
                      </p>
                    </div>

                    {powerOn && triggerStatus && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Make sure it keeps working</p>
                        <HealthRow icon={Zap} label="Listening now" ok={triggerStatus.running} okText="Active" badText="Saves on Save" />
                        <HealthRow icon={BellRing} label="Notifications" ok={triggerStatus.notificationsGranted} okText="Allowed" badText="Blocked" />
                        <HealthRow
                          icon={BatteryCharging}
                          label="Battery restrictions"
                          ok={triggerStatus.batteryUnrestricted}
                          okText="Unrestricted"
                          badText="May be stopped"
                          fix={() => void powerTrigger.openBatterySettings()}
                          fixLabel="Fix"
                        />
                        <HealthRow
                          icon={Rocket}
                          label="Open instantly"
                          ok={triggerStatus.overlayAllowed}
                          okText="Opens automatically"
                          badText="Opens from a notification"
                          fix={() => void powerTrigger.openOverlaySettings()}
                          fixLabel="Allow"
                        />
                        <HealthRow
                          icon={Lock}
                          label="Open over lock screen"
                          ok={triggerStatus.fullScreenAllowed}
                          okText="Allowed"
                          badText="Notification only"
                          fix={() => void powerTrigger.openFullScreenSettings()}
                          fixLabel="Allow"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          </FadeIn>

          {/* Hold duration */}
          <FadeIn delay={0.05}>
            <section className="surface rounded-3xl p-4">
              <h2 className="flex items-center gap-2 font-display text-base font-bold">
                <Timer className="size-5 text-primary" /> Hold duration
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">How long you hold the red SOS button. Longer means fewer accidental alerts.</p>
              <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Hold duration">
                {delays.map((d) => {
                  const active = holdDuration === d
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setHoldDuration(d)}
                      aria-pressed={active}
                      className={cn(
                        'flex min-h-12 items-center justify-center gap-1 rounded-2xl border-2 text-sm font-bold transition-all',
                        active ? 'gradient-primary border-transparent shadow-md' : 'surface-raised hover:border-primary/40',
                      )}
                    >
                      {active && <Check className="size-4" />}
                      {d} sec
                    </button>
                  )
                })}
              </div>
            </section>
          </FadeIn>

          {/* During an SOS */}
          <FadeIn delay={0.1}>
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 px-1 font-display text-base font-bold">
                <ShieldAlert className="size-5 text-primary" /> During an SOS
              </h2>
              <SettingsToggle icon={Navigation} tone="sky" label="Save live location" description="Store your GPS position in your history while an SOS runs" checked={locationSharing} onCheckedChange={setLocationSharing} />
              <SettingsToggle icon={PhoneCall} tone="success" label="Call & SMS shortcuts" description="Show buttons that open your dialer or SMS app for each contact" checked={contactShortcuts} onCheckedChange={setContactShortcuts} />
              <SettingsToggle icon={Mic} tone="warm" label="Record audio" description="Record with the microphone during an SOS. Kept in memory only, never uploaded" checked={audioRecording} onCheckedChange={setAudioRecording} />
            </section>
          </FadeIn>

          <FadeIn delay={0.15}>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="gradient-primary glow-primary min-h-14 w-full rounded-2xl font-display text-base font-bold transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save settings'}
            </button>
          </FadeIn>
        </div>
      )}
    </AppShell>
  )
}

function HealthRow({
  icon: Icon,
  label,
  ok,
  okText,
  badText,
  fix,
  fixLabel,
}: {
  icon: LucideIcon
  label: string
  ok: boolean
  okText: string
  badText: string
  fix?: () => void
  fixLabel?: string
}) {
  return (
    <div className="surface-raised flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2">
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', ok ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning')}>
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">{label}</p>
        <p className={cn('text-xs', ok ? 'text-success' : 'text-warning')}>{ok ? okText : badText}</p>
      </div>
      {!ok && fix && (
        <button type="button" onClick={fix} className="flex min-h-11 items-center gap-0.5 rounded-xl px-3 text-sm font-semibold text-primary active:bg-primary/10">
          {fixLabel}
          <ChevronRight className="size-4" />
        </button>
      )}
    </div>
  )
}
