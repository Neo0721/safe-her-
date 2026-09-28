'use client'

import { Check, Mic, Navigation, PhoneCall, ShieldAlert, Timer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { FadeIn } from '@/components/motion'
import { SettingsToggle } from '@/components/settings-toggle'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { apiJson, errorMessage } from '@/lib/api-fetch'
import { setHoldSeconds } from '@/lib/sos-prefs'
import type { SosSettings } from '@/lib/types'
import { cn } from '@/lib/utils'

const delays = [
  { value: 3, label: '3 sec' },
  { value: 5, label: '5 sec' },
  { value: 10, label: '10 sec' },
]

export default function SosSettingsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [holdDuration, setHoldDuration] = useState(3)
  const [locationSharing, setLocationSharing] = useState(true)
  const [audioRecording, setAudioRecording] = useState(false)
  const [contactShortcuts, setContactShortcuts] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await apiJson<SosSettings>('/api/settings')
      setHoldDuration(data.hold_duration)
      setLocationSharing(data.location_sharing === 1)
      setAudioRecording(data.audio_recording === 1)
      setContactShortcuts(data.notify_contacts === 1)
    } catch (error) {
      setLoadError(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) void load()
  }, [user])

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
        },
      })
      setHoldSeconds(saved.hold_duration)
      toast.success('SOS settings saved')
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to save SOS settings.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell title="SOS Settings" showBack>
      {loading ? (
        <div className="flex h-64 items-center justify-center" role="status">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : loadError ? (
        <div role="alert" className="mt-6 rounded-2xl border border-danger/30 bg-danger/8 p-4 text-sm">
          <p className="font-medium">Could not load your SOS settings</p>
          <p className="mt-1 text-muted-foreground">{loadError}</p>
          <button type="button" onClick={() => void load()} className="mt-3 min-h-11 rounded-xl border border-border bg-card px-4 font-semibold">
            Try again
          </button>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-2xl space-y-6 py-2">
          <FadeIn>
            <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/8 p-4">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-primary" />
              <p className="text-sm text-muted-foreground">
                SOS starts when you press and hold the red SOS button. These settings change what SafeHer does after it starts.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.05}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Timer className="size-5 text-primary" /> Hold duration
                </CardTitle>
                <CardDescription>How long you must hold the SOS button. Longer means fewer accidental alerts.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3" role="group" aria-label="Hold duration">
                  {delays.map((d) => {
                    const active = holdDuration === d.value
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => setHoldDuration(d.value)}
                        aria-pressed={active}
                        className={cn(
                          'flex min-h-12 items-center justify-center gap-1 rounded-2xl border-2 text-sm font-semibold transition-all',
                          active ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border bg-card hover:border-primary/40',
                        )}
                      >
                        {active && <Check className="size-4" />}
                        {d.label}
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </FadeIn>

          <FadeIn delay={0.1}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">During an SOS</CardTitle>
                <CardDescription>Only features that SafeHer really performs are listed.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <SettingsToggle
                  icon={Navigation}
                  label="Save live location"
                  description="Store your GPS position in your history while an SOS runs"
                  checked={locationSharing}
                  onCheckedChange={setLocationSharing}
                />
                <SettingsToggle
                  icon={PhoneCall}
                  label="Contact call & SMS shortcuts"
                  description="Show buttons that open your dialer or SMS app for each contact"
                  checked={contactShortcuts}
                  onCheckedChange={setContactShortcuts}
                />
                <SettingsToggle
                  icon={Mic}
                  label="Record audio"
                  description="Record with the microphone during an SOS. Kept in memory only, not uploaded"
                  checked={audioRecording}
                  onCheckedChange={setAudioRecording}
                />
              </CardContent>
            </Card>
          </FadeIn>

          <FadeIn delay={0.15}>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="min-h-14 w-full rounded-2xl bg-primary py-4 font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save settings'}
            </button>
          </FadeIn>
        </div>
      )}
    </AppShell>
  )
}
