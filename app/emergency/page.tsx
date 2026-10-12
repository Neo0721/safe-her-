'use client'

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  MessageSquare,
  Mic,
  PhoneCall,
  RefreshCw,
  Siren,
  Square,
  Zap,
} from 'lucide-react'
import { SystemBars, SystemBarsStyle } from '@capacitor/core'
import { motion } from 'motion/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { ApiError, apiJson, errorMessage } from '@/lib/api-fetch'
import { clearActiveSos, getActiveSos, setActiveSos } from '@/lib/active-sos'
import { CONFIG } from '@/lib/config'
import {
  LOCATION_ERROR_TEXT,
  distanceMeters,
  getLocationPermission,
  requestLocationPermission,
  watchFixes,
  type Fix,
  type LocationError,
} from '@/lib/location'
import type { Contact, SosEvent, SosSettings } from '@/lib/types'
import { isNativeApp } from '@/lib/platform'
import { cn, generateUUID } from '@/lib/utils'

type RecordState = 'pending' | 'recorded' | 'failed'
type Opened = Record<string, 'call' | 'sms'>

const MAX_BUFFERED_POINTS = 500

export default function EmergencyPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#12060a]" />}>
      <EmergencyScreen />
    </Suspense>
  )
}

function EmergencyScreen() {
  const router = useRouter()
  const params = useSearchParams()
  const { user } = useAuth()
  const uid = user?.uid

  const wantsStart = params.get('start') === '1'
  const wantsDrill = params.get('drill') === '1'
  const source: 'hold' | 'power' = params.get('source') === 'power' ? 'power' : 'hold'

  const [sosId, setSosId] = useState<string | null>(null)
  const [isDrill, setIsDrill] = useState(wantsDrill)
  const [recordState, setRecordState] = useState<RecordState>('pending')
  const [recordError, setRecordError] = useState<string | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [settings, setSettings] = useState<SosSettings | null>(null)
  const [settingsNote, setSettingsNote] = useState<string | null>(null)
  const [fix, setFix] = useState<Fix | null>(null)
  const [gpsStatus, setGpsStatus] = useState('Requesting location…')
  const [gpsError, setGpsError] = useState<LocationError | null>(null)
  const [savedPoints, setSavedPoints] = useState(0)
  const [failedUploads, setFailedUploads] = useState(0)
  const [opened, setOpened] = useState<Opened>({})
  const [countdown, setCountdown] = useState(0)
  const [ending, setEnding] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [endError, setEndError] = useState<string | null>(null)

  const [recording, setRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioNote, setAudioNote] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const stopWatchRef = useRef<(() => void) | null>(null)
  const startedRef = useRef(false)
  const disposedRef = useRef(false)
  const lastSavedRef = useRef<{ at: number; lat: number; lng: number } | null>(null)
  const bufferRef = useRef<{ lat: number; lng: number; accuracy: number; at: string }[]>([])
  const sosIdRef = useRef<string | null>(null)
  const recordedRef = useRef(false) // true once the server has this SOS event
  const flushingRef = useRef(false)
  const isDrillRef = useRef(wantsDrill)
  const sourceRef = useRef<'hold' | 'power'>(source)
  const settingsRef = useRef<SosSettings | null>(null)

  // This screen is always dark: match the status-bar strip and force light status-bar icons.
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--statusbar-bg', '#0b0510')
    root.setAttribute('data-dark-screen', '1')
    if (isNativeApp()) SystemBars.setStyle({ style: SystemBarsStyle.Dark }).catch(() => {})
    return () => {
      root.style.removeProperty('--statusbar-bg')
      root.removeAttribute('data-dark-screen')
    }
  }, [])

  // Live elapsed clock.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // ---- location uploads -------------------------------------------------------------------
  const uploadPoint = useCallback(async (id: string, p: { lat: number; lng: number; accuracy: number; at: string }) => {
    await apiJson('/api/location', {
      method: 'POST',
      json: { sos_event_id: id, latitude: p.lat, longitude: p.lng, accuracy: p.accuracy, recorded_at: p.at },
    })
  }, [])

  /** Makes sure the server has this SOS event (it may have been unreachable when the SOS started). */
  const ensureRecorded = useCallback(async (): Promise<boolean> => {
    const id = sosIdRef.current
    if (!id) return false
    if (recordedRef.current) return true
    try {
      await apiJson('/api/sos', { method: 'POST', json: { id, is_test: isDrillRef.current, source: sourceRef.current } })
      recordedRef.current = true
      setRecordState('recorded')
      setRecordError(null)
      return true
    } catch (error) {
      setRecordState('failed')
      setRecordError(errorMessage(error))
      return false
    }
  }, [])

  const flushBuffer = useCallback(async () => {
    const id = sosIdRef.current
    if (!id || flushingRef.current) return
    flushingRef.current = true
    try {
      // Points are only sent once the event exists on the server; otherwise they stay buffered.
      if (bufferRef.current.length > 0 && !(await ensureRecorded())) return
      while (bufferRef.current.length > 0) {
        const next = bufferRef.current[0]
        try {
          await uploadPoint(id, next)
          bufferRef.current.shift()
          setSavedPoints((n) => n + 1)
        } catch (error) {
          // A 4xx means the server will never accept this point; drop it. Network errors stay buffered.
          if (error instanceof ApiError && !error.isNetwork && error.status < 500) bufferRef.current.shift()
          else break
        }
      }
    } finally {
      flushingRef.current = false
      setFailedUploads(bufferRef.current.length)
    }
  }, [uploadPoint, ensureRecorded])

  const handleFix = useCallback(
    (next: Fix) => {
      setFix(next)
      setGpsStatus('Live GPS')
      setGpsError(null)

      const shareLocation = settingsRef.current ? settingsRef.current.location_sharing === 1 : true
      if (!shareLocation || !sosIdRef.current) return

      const now = Date.now()
      const last = lastSavedRef.current
      const due = !last || now - last.at >= CONFIG.locationUpdateIntervalMs
      const moved = !last || distanceMeters(last.lat, last.lng, next.lat, next.lng) >= CONFIG.locationMinDistanceMeters
      if (!due || !moved) return

      lastSavedRef.current = { at: now, lat: next.lat, lng: next.lng }
      if (bufferRef.current.length >= MAX_BUFFERED_POINTS) bufferRef.current.shift()
      bufferRef.current.push({ lat: next.lat, lng: next.lng, accuracy: next.accuracy, at: new Date(next.timestamp || now).toISOString() })
      void flushBuffer()
    },
    [flushBuffer],
  )

  const startGps = useCallback(async () => {
    stopWatchRef.current?.()
    stopWatchRef.current = null
    setGpsError(null)
    setGpsStatus('Requesting location…')

    let permission = await getLocationPermission()
    if (permission !== 'granted') permission = await requestLocationPermission()
    if (disposedRef.current) return
    if (permission === 'denied') {
      setGpsStatus(LOCATION_ERROR_TEXT.denied)
      setGpsError({ code: 'denied', message: LOCATION_ERROR_TEXT.denied, name: 'LocationError' })
      return
    }
    setGpsStatus('Acquiring GPS…')
    const stop = await watchFixes(handleFix, (error) => {
      setGpsError(error)
      setGpsStatus(LOCATION_ERROR_TEXT[error.code])
    })
    if (disposedRef.current) {
      stop() // the screen was left while the watcher was being registered
      return
    }
    stopWatchRef.current = stop
  }, [handleFix])

  // ---- audio ------------------------------------------------------------------------------
  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    recorder?.stream.getTracks().forEach((t) => t.stop())
    recorderRef.current = null
    setRecording(false)
  }, [])

  const startRecording = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setAudioNote('Audio recording is not available here (the page must be served over HTTPS).')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data)
      recorder.onstop = () => {
        if (chunksRef.current.length > 0) {
          setAudioUrl(URL.createObjectURL(new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })))
        }
      }
      recorder.start()
      recorderRef.current = recorder
      setRecording(true)
    } catch {
      setAudioNote('Microphone permission was denied or the microphone is unavailable.')
    }
  }, [])

  // ---- start / resume ---------------------------------------------------------------------
  const begin = useCallback(async () => {
    if (!uid) return

    // Contacts and settings load in parallel with the SOS record; the emergency actions never wait on the server.
    const contactsPromise = apiJson<Contact[]>('/api/contacts').then(setContacts).catch(() => {
      toast.error('Could not load your contacts. You can still call the emergency number.')
    })
    const settingsPromise = apiJson<SosSettings>('/api/settings')
      .then((s) => {
        settingsRef.current = s
        setSettings(s)
      })
      .catch(() => setSettingsNote('Could not load your SOS preferences; using safe defaults.'))

    // Resume an SOS already running on this device rather than creating a duplicate.
    const existing = getActiveSos(uid)
    let id: string | null = null
    let resumed: { startedAt: number; isTest: boolean } | null = null
    if (existing) {
      try {
        const event = await apiJson<SosEvent>(`/api/sos?id=${encodeURIComponent(existing.id)}`)
        if (event.status === 'Active') {
          id = event.id
          resumed = { startedAt: existing.startedAt, isTest: event.is_test === 1 }
          recordedRef.current = true
          setRecordState('recorded')
        } else {
          clearActiveSos()
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          clearActiveSos()
        } else {
          // Server unreachable: keep going with the local id; the record is re-sent when it is back.
          id = existing.id
          resumed = { startedAt: existing.startedAt, isTest: existing.isTest }
          setRecordState('failed')
          setRecordError(errorMessage(error))
        }
      }
    }

    const drill = resumed ? resumed.isTest : wantsDrill
    isDrillRef.current = drill
    setIsDrill(drill)

    if (!id) {
      if (!wantsStart) {
        router.replace('/home')
        return
      }
      id = generateUUID()
      setActiveSos({ id, uid, isTest: drill, startedAt: Date.now() })
      sosIdRef.current = id
      setSosId(id)
      void ensureRecorded() // never block GPS or the call buttons on the network
    } else {
      sosIdRef.current = id
      setSosId(id)
    }

    // The end-delay counts from the real start time, also when resuming.
    const startedAt = resumed ? resumed.startedAt : Date.now()
    setStartedAt(startedAt)
    if (!drill) {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000)
      setCountdown(Math.max(CONFIG.sosCancelDelaySeconds - elapsed, 0))
    }

    // GPS must never wait on the server: start it right away, then apply preferences once loaded.
    void startGps()
    await Promise.all([contactsPromise, settingsPromise])
    if (settingsRef.current?.audio_recording === 1) void startRecording()
    void flushBuffer()
  }, [uid, wantsStart, wantsDrill, router, startGps, startRecording, flushBuffer, ensureRecorded])

  useEffect(() => {
    if (!uid || startedRef.current) return
    startedRef.current = true
    void begin()
  }, [uid, begin])

  useEffect(() => {
    disposedRef.current = false
    return () => {
      disposedRef.current = true
      stopWatchRef.current?.()
      stopWatchRef.current = null
      stopRecording()
    }
  }, [stopRecording])

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown((c) => Math.max(c - 1, 0)), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  // While anything is unsynced (record missing or points buffered), keep retrying in the background.
  useEffect(() => {
    if (!sosId) return
    const timer = setInterval(() => {
      if (!recordedRef.current || bufferRef.current.length > 0) void flushBuffer().then(() => ensureRecorded())
    }, 10000)
    return () => clearInterval(timer)
  }, [sosId, flushBuffer, ensureRecorded])

  // ---- actions ----------------------------------------------------------------------------
  const retryRecord = async () => {
    setRecordError(null)
    if (await ensureRecorded()) void flushBuffer()
  }

  const logAction = (kind: 'call_contact' | 'sms_contact' | 'call_emergency', contactId?: string) => {
    if (!sosId || isDrill) return
    apiJson('/api/sos/actions', { method: 'POST', json: { sos_event_id: sosId, contact_id: contactId, kind } }).catch(() => {})
  }

  const endSos = async (status: 'Completed' | 'Cancelled') => {
    if (!sosId) return
    setEnding(true)
    setEndError(null)
    try {
      if (!(await ensureRecorded())) throw new Error('The server is unreachable, so this SOS could not be saved.')
      await apiJson('/api/sos', { method: 'PUT', json: { id: sosId, status } })
    } catch (error) {
      // Do not pretend it ended: the server may still list this SOS as active.
      setEnding(false)
      setEndError(`Could not reach the server to end this ${isDrill ? 'drill' : 'SOS'}: ${errorMessage(error)}`)
      return
    }
    stopWatchRef.current?.()
    stopRecording()
    clearActiveSos()
    toast.success(isDrill ? 'Drill ended.' : status === 'Completed' ? 'SOS ended. Glad you are safe.' : 'SOS cancelled as a false alarm.')
    router.replace('/home')
  }

  const leaveWithoutSyncing = () => {
    stopWatchRef.current?.()
    stopRecording()
    clearActiveSos()
    router.replace('/home')
  }

  const lockedByDelay = countdown > 0
  const notifyContacts = settings ? settings.notify_contacts === 1 : true
  const mapsUrl = fix ? `https://www.google.com/maps?q=${fix.lat.toFixed(6)},${fix.lng.toFixed(6)}` : null
  const smsBody = mapsUrl
    ? `EMERGENCY: I may need help. My current location: ${mapsUrl}`
    : 'EMERGENCY: I may need help. My GPS location is not available right now.'

  const elapsedSec = startedAt ? Math.max(Math.floor((now - startedAt) / 1000), 0) : 0
  const elapsedLabel = `${String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:${String(elapsedSec % 60).padStart(2, '0')}`
  const accent = isDrill ? 'gradient-warm' : 'gradient-danger'

  return (
    <main className="bg-aurora-danger relative mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 pb-[calc(1.5rem+var(--sab))] pt-[calc(1rem+var(--sat))] text-white">
      {/* Header chips */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span
          className={cn(
            'flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest',
            isDrill ? 'bg-amber-400/20 text-amber-200' : 'bg-white/10 text-rose-100',
          )}
        >
          <span className={cn('size-2 animate-pulse rounded-full', isDrill ? 'bg-amber-300' : 'bg-rose-400')} />
          {isDrill ? 'Drill · practice mode' : 'Live · emergency active'}
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold tabular-nums text-white/90">
          <Clock className="size-3.5" />
          {elapsedLabel}
        </span>
        {source === 'power' && !isDrill && (
          <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white/90">
            <Zap className="size-3.5" />
            Power-button trigger
          </span>
        )}
      </div>

      {/* Hero */}
      <div className="flex flex-col items-center py-2 text-center">
        <div className="relative mb-5 flex size-40 items-center justify-center">
          <span className="animate-ripple absolute inset-0 rounded-full bg-rose-500/30" />
          <span className="animate-ripple absolute inset-0 rounded-full bg-rose-500/20" style={{ animationDelay: '1.2s' }} />
          <motion.div
            animate={{ scale: [1, 1.07, 1] }}
            transition={{ duration: 1.1, repeat: Number.POSITIVE_INFINITY }}
            className={cn('glow-danger relative flex size-28 items-center justify-center rounded-full ring-4 ring-white/15', accent)}
          >
            <Siren className="size-14" strokeWidth={1.8} />
          </motion.div>
        </div>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">{isDrill ? 'SOS drill' : 'Emergency activated'}</h1>
        <p className="mt-1.5 max-w-xs text-sm text-white/70">
          {isDrill
            ? 'This is a practice run. Your contacts and the emergency number are not contacted.'
            : 'Your location is being recorded. Call for help below.'}
        </p>
      </div>

      {/* Honest status tiles */}
      <section className="grid grid-cols-3 gap-2" aria-live="polite">
        <StatusTile
          icon={<MapPin className="size-4" />}
          label="GPS"
          value={fix ? `±${Math.round(fix.accuracy)} m` : gpsStatus}
          tone={fix ? 'ok' : gpsError ? 'bad' : 'wait'}
        />
        <StatusTile
          icon={<CheckCircle2 className="size-4" />}
          label="Record"
          value={recordState === 'recorded' ? 'Saved' : recordState === 'failed' ? 'Not saved' : 'Saving…'}
          tone={recordState === 'recorded' ? 'ok' : recordState === 'failed' ? 'bad' : 'wait'}
        />
        <StatusTile
          icon={<RefreshCw className="size-4" />}
          label="Updates"
          value={
            settings && settings.location_sharing !== 1
              ? 'Off'
              : `${savedPoints}${failedUploads > 0 ? ` · ${failedUploads} queued` : ''}`
          }
          tone={failedUploads > 0 ? 'bad' : 'ok'}
        />
      </section>
      {fix && (
        <p className="-mt-2 text-center text-xs tabular-nums text-white/60">
          {fix.lat.toFixed(5)}, {fix.lng.toFixed(5)}
        </p>
      )}

      {recordError && (
        <div className="flex items-start gap-2 rounded-2xl bg-rose-950/70 p-3 text-xs text-rose-100 ring-1 ring-rose-400/20">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p>{recordError}</p>
            <p className="mt-1 text-rose-200/80">You can still call for help below. GPS points are kept and uploaded when the server is reachable.</p>
            <button type="button" onClick={retryRecord} className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-white/10 px-4 font-semibold">
              Retry saving
            </button>
          </div>
        </div>
      )}

      {gpsError && (
        <div className="rounded-2xl bg-rose-950/70 p-3 text-xs text-rose-100 ring-1 ring-rose-400/20">
          <p>
            {gpsError.code === 'denied'
              ? 'Location permission is off. Enable it for SafeHer in your phone settings so contacts can be sent your position.'
              : 'No GPS fix yet. Move to an open area if possible.'}
          </p>
          <button type="button" onClick={() => void startGps()} className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-white/10 px-4 font-semibold">
            Retry GPS
          </button>
        </div>
      )}
      {settingsNote && <p className="text-xs text-amber-200/90">{settingsNote}</p>}

      {/* Call / SMS actions: these open the phone's dialer and SMS composer only. */}
      {!isDrill && (
        <section className="space-y-3">
          <a
            href={`tel:${CONFIG.emergencyNumber}`}
            onClick={() => {
              setOpened((o) => ({ ...o, emergency: 'call' }))
              logAction('call_emergency')
            }}
            className="gradient-danger glow-danger flex min-h-16 items-center justify-center gap-3 rounded-3xl px-5 font-display text-lg font-extrabold active:scale-[0.98]"
          >
            <PhoneCall className="size-6" />
            {opened.emergency ? 'Dialer opened' : `Call ${CONFIG.emergencyNumber} now`}
          </a>

          {notifyContacts ? (
            contacts.length > 0 ? (
              <div className="space-y-2">
                <p className="px-1 text-[11px] font-bold uppercase tracking-widest text-white/50">Your circle</p>
                {contacts.map((c) => (
                  <div key={c.id} className="rounded-3xl bg-white/[0.07] p-3 ring-1 ring-white/10">
                    <div className="flex items-center gap-3">
                      <span className="gradient-primary flex size-11 shrink-0 items-center justify-center rounded-2xl font-display font-bold">
                        {c.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{c.name}</p>
                        <p className="truncate text-xs text-white/60">
                          {c.relationship} · {c.phone}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <a
                        href={`tel:${c.phone}`}
                        onClick={() => {
                          setOpened((o) => ({ ...o, [`call-${c.id}`]: 'call' }))
                          logAction('call_contact', c.id)
                        }}
                        className="flex min-h-12 items-center justify-center gap-1.5 rounded-2xl bg-white/10 text-sm font-semibold active:scale-95"
                      >
                        <PhoneCall className="size-4" />
                        {opened[`call-${c.id}`] ? 'Dialer opened' : 'Call'}
                      </a>
                      <a
                        href={`sms:${c.phone}?body=${encodeURIComponent(smsBody)}`}
                        onClick={() => {
                          setOpened((o) => ({ ...o, [`sms-${c.id}`]: 'sms' }))
                          logAction('sms_contact', c.id)
                        }}
                        className="gradient-primary flex min-h-12 items-center justify-center gap-1.5 rounded-2xl text-sm font-semibold active:scale-95"
                      >
                        <MessageSquare className="size-4" />
                        {opened[`sms-${c.id}`] ? 'Composer opened' : 'Share location'}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-white/[0.06] py-3 text-center text-xs text-white/60">No contacts yet. Add them from the Circle tab.</p>
            )
          ) : (
            <p className="text-center text-xs text-white/60">Contact shortcuts are turned off in your SOS settings.</p>
          )}

          <p className="px-1 text-[11px] leading-snug text-white/45">
            SafeHer opens your phone&apos;s dialer or SMS app. You press call or send there; SafeHer cannot tell whether a call connected or a message was sent.
          </p>
        </section>
      )}

      {settings?.audio_recording === 1 && (
        <section className="rounded-3xl bg-white/[0.07] p-4 text-sm ring-1 ring-white/10">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-semibold">
              <Mic className={cn('size-4', recording ? 'animate-pulse text-rose-400' : 'text-white/60')} />
              {recording ? 'Recording audio…' : audioUrl ? 'Recording stopped' : 'Audio not recording'}
            </span>
            {recording && (
              <button type="button" onClick={stopRecording} className="flex min-h-11 items-center gap-1 rounded-xl bg-rose-600/30 px-3 text-xs font-bold">
                <Square className="size-3" /> Stop
              </button>
            )}
          </div>
          {audioNote && <p className="mt-2 text-xs text-amber-200/90">{audioNote}</p>}
          {audioUrl && <audio src={audioUrl} controls className="mt-2 w-full" />}
          <p className="mt-2 text-[11px] leading-snug text-white/45">
            The recording exists only in this app&apos;s memory. It is not uploaded or saved, and is lost when you leave this screen.
          </p>
        </section>
      )}

      {endError && (
        <div className="rounded-2xl bg-rose-950/80 p-3 text-xs text-rose-100 ring-1 ring-rose-400/20" role="alert">
          <p>{endError}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => void endSos('Completed')} className="min-h-11 rounded-xl bg-white/10 px-4 font-semibold">
              Try again
            </button>
            <button type="button" onClick={leaveWithoutSyncing} className="min-h-11 rounded-xl bg-white/10 px-4 font-semibold">
              Leave anyway
            </button>
          </div>
        </div>
      )}

      <div className="mt-auto space-y-2 pt-2">
        <button
          type="button"
          disabled={lockedByDelay || ending || !sosId}
          onClick={() => void endSos('Completed')}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-3xl bg-white font-display text-base font-bold text-[#12060a] transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/50"
        >
          {ending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Ending…
            </>
          ) : lockedByDelay ? (
            `Can be ended in ${countdown}s`
          ) : isDrill ? (
            'End drill'
          ) : (
            "I'm safe, end SOS"
          )}
        </button>
        {!isDrill && (
          <button
            type="button"
            disabled={lockedByDelay || ending || !sosId}
            onClick={() => void endSos('Cancelled')}
            className="min-h-12 w-full rounded-3xl text-sm font-semibold text-white/75 ring-1 ring-white/20 disabled:opacity-40"
          >
            Accidental trigger, cancel
          </button>
        )}
      </div>
    </main>
  )
}

function StatusTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone: 'ok' | 'wait' | 'bad'
}) {
  const color = tone === 'ok' ? 'text-emerald-300' : tone === 'bad' ? 'text-rose-300' : 'text-amber-200'
  return (
    <div className="min-w-0 rounded-2xl bg-white/[0.07] p-3 ring-1 ring-white/10">
      <span className={cn('flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide', color)}>
        {icon}
        {label}
      </span>
      <p className="mt-1.5 break-words text-sm font-bold leading-tight">{value}</p>
    </div>
  )
}
