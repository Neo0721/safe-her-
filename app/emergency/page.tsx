'use client'

import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MapPin,
  MessageSquare,
  Mic,
  PhoneCall,
  RefreshCw,
  Siren,
  Square,
} from 'lucide-react'
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
import { generateUUID } from '@/lib/utils'

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
  const [endError, setEndError] = useState<string | null>(null)

  const [recording, setRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioNote, setAudioNote] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const stopWatchRef = useRef<(() => void) | null>(null)
  const startedRef = useRef(false)
  const lastSavedRef = useRef<{ at: number; lat: number; lng: number } | null>(null)
  const bufferRef = useRef<{ lat: number; lng: number; accuracy: number; at: string }[]>([])
  const sosIdRef = useRef<string | null>(null)
  const settingsRef = useRef<SosSettings | null>(null)

  // ---- location uploads -------------------------------------------------------------------
  const uploadPoint = useCallback(async (id: string, p: { lat: number; lng: number; accuracy: number; at: string }) => {
    await apiJson('/api/location', {
      method: 'POST',
      json: { sos_event_id: id, latitude: p.lat, longitude: p.lng, accuracy: p.accuracy, recorded_at: p.at },
    })
  }, [])

  const flushBuffer = useCallback(async () => {
    const id = sosIdRef.current
    while (id && bufferRef.current.length > 0) {
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
    setFailedUploads(bufferRef.current.length)
  }, [uploadPoint])

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
    if (permission === 'denied') {
      setGpsStatus(LOCATION_ERROR_TEXT.denied)
      setGpsError({ code: 'denied', message: LOCATION_ERROR_TEXT.denied, name: 'LocationError' })
      return
    }
    setGpsStatus('Acquiring GPS…')
    stopWatchRef.current = await watchFixes(handleFix, (error) => {
      setGpsError(error)
      setGpsStatus(LOCATION_ERROR_TEXT[error.code])
    })
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
    if (existing) {
      try {
        const event = await apiJson<SosEvent>(`/api/sos?id=${encodeURIComponent(existing.id)}`)
        if (event.status === 'Active') {
          id = event.id
          setIsDrill(event.is_test === 1)
          setRecordState('recorded')
        } else {
          clearActiveSos()
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) clearActiveSos()
        else {
          // Server unreachable: keep going with the local id; uploads are buffered.
          id = existing.id
          setIsDrill(existing.isTest)
          setRecordState('failed')
          setRecordError(errorMessage(error))
        }
      }
    }

    if (!id) {
      if (!wantsStart) {
        router.replace('/home')
        return
      }
      id = generateUUID()
      try {
        await apiJson('/api/sos', { method: 'POST', json: { id, is_test: wantsDrill } })
        setRecordState('recorded')
      } catch (error) {
        setRecordState('failed')
        setRecordError(errorMessage(error))
      }
      setActiveSos({ id, uid, isTest: wantsDrill, startedAt: Date.now() })
    }

    sosIdRef.current = id
    setSosId(id)
    if (!wantsDrill && !existing) setCountdown(CONFIG.sosCancelDelaySeconds)
    else if (existing && !existing.isTest) {
      const elapsed = Math.floor((Date.now() - existing.startedAt) / 1000)
      setCountdown(Math.max(CONFIG.sosCancelDelaySeconds - elapsed, 0))
    }

    await Promise.all([contactsPromise, settingsPromise])
    void startGps()
    if (settingsRef.current?.audio_recording === 1) void startRecording()
    void flushBuffer()
  }, [uid, wantsStart, wantsDrill, router, startGps, startRecording, flushBuffer])

  useEffect(() => {
    if (!uid || startedRef.current) return
    startedRef.current = true
    void begin()
  }, [uid, begin])

  useEffect(
    () => () => {
      stopWatchRef.current?.()
      stopRecording()
    },
    [stopRecording],
  )

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown((c) => Math.max(c - 1, 0)), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  // ---- actions ----------------------------------------------------------------------------
  const retryRecord = async () => {
    if (!sosId) return
    setRecordError(null)
    try {
      await apiJson('/api/sos', { method: 'POST', json: { id: sosId, is_test: isDrill } })
      setRecordState('recorded')
      void flushBuffer()
    } catch (error) {
      setRecordState('failed')
      setRecordError(errorMessage(error))
    }
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

  return (
    <main className="animate-emergency-flash relative mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 bg-[#12060a] px-4 pb-[calc(1.5rem+var(--sab))] pt-[calc(1rem+var(--sat))] text-white">
      <div
        className={`mx-auto flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
          isDrill ? 'bg-amber-500/20 text-amber-200' : 'bg-white/10 text-red-200'
        }`}
      >
        <span className={`size-2 animate-pulse rounded-full ${isDrill ? 'bg-amber-400' : 'bg-red-500'}`} />
        {isDrill ? 'DRILL · Practice mode' : 'Live · Emergency active'}
      </div>

      <div className="flex flex-col items-center text-center">
        <div className="relative mb-4 flex items-center justify-center">
          <span className="absolute size-36 animate-ping rounded-full bg-red-500/20" />
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY }}
            className={`flex size-24 items-center justify-center rounded-full shadow-2xl ${isDrill ? 'bg-amber-600' : 'bg-red-600'}`}
          >
            <Siren className="size-12" />
          </motion.div>
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          {isDrill ? 'SOS Drill' : 'Emergency Activated'}
        </h1>
        {isDrill && (
          <p className="mt-1 text-sm text-amber-100/80">
            This is a practice run. Your contacts and the emergency number are not contacted.
          </p>
        )}
      </div>

      {/* Honest status panel */}
      <section className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm" aria-live="polite">
        <StatusRow
          icon={<MapPin className="size-4" />}
          label="GPS"
          value={
            fix
              ? `${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)} (±${Math.round(fix.accuracy)} m)`
              : gpsStatus
          }
          tone={fix ? 'ok' : gpsError ? 'bad' : 'wait'}
        />
        <StatusRow
          icon={<CheckCircle2 className="size-4" />}
          label="SOS record"
          value={
            recordState === 'recorded'
              ? 'Saved to your history'
              : recordState === 'failed'
                ? 'Not saved yet (server unreachable)'
                : 'Saving…'
          }
          tone={recordState === 'recorded' ? 'ok' : recordState === 'failed' ? 'bad' : 'wait'}
        />
        <StatusRow
          icon={<RefreshCw className="size-4" />}
          label="Location updates"
          value={
            settings && settings.location_sharing !== 1
              ? 'Not stored (turned off in SOS settings)'
              : `${savedPoints} saved${failedUploads > 0 ? ` · ${failedUploads} waiting to upload` : ''}`
          }
          tone={failedUploads > 0 ? 'bad' : 'ok'}
        />

        {recordError && (
          <div className="flex items-start gap-2 rounded-xl bg-red-950/60 p-3 text-xs text-red-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p>{recordError}</p>
              <p className="mt-1 text-red-300/80">You can still call for help below. GPS points are kept and uploaded when the server is reachable.</p>
              <button type="button" onClick={retryRecord} className="mt-2 inline-flex min-h-11 items-center rounded-lg bg-white/10 px-3 font-semibold">
                Retry saving
              </button>
            </div>
          </div>
        )}

        {gpsError && (
          <div className="rounded-xl bg-red-950/60 p-3 text-xs text-red-200">
            <p>
              {gpsError.code === 'denied'
                ? 'Location permission is off. Enable it for SafeHer in your phone settings so contacts can be sent your position.'
                : 'No GPS fix yet. Move to an open area if possible.'}
            </p>
            <button type="button" onClick={() => void startGps()} className="mt-2 inline-flex min-h-11 items-center rounded-lg bg-white/10 px-3 font-semibold">
              Retry GPS
            </button>
          </div>
        )}
        {settingsNote && <p className="text-xs text-amber-200/90">{settingsNote}</p>}
      </section>

      {/* Call / SMS actions: these open the phone's dialer and SMS composer only. */}
      {!isDrill && (
        <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-red-300">Get help now</p>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-950/30 p-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-red-100">Emergency number</p>
              <p className="text-xs text-red-300/80">{CONFIG.emergencyNumber}</p>
            </div>
            <a
              href={`tel:${CONFIG.emergencyNumber}`}
              onClick={() => {
                setOpened((o) => ({ ...o, emergency: 'call' }))
                logAction('call_emergency')
              }}
              className="flex min-h-12 shrink-0 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white active:scale-95"
            >
              <PhoneCall className="size-4" />
              {opened.emergency ? 'Dialer opened' : `Call ${CONFIG.emergencyNumber}`}
            </a>
          </div>

          {notifyContacts ? (
            contacts.length > 0 ? (
              contacts.map((c) => (
                <div key={c.id} className="rounded-xl border border-white/5 bg-white/5 p-3">
                  <p className="truncate text-sm font-bold">
                    {c.name} <span className="font-normal text-white/60">({c.relationship})</span>
                  </p>
                  <p className="text-xs text-white/60">{c.phone}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <a
                      href={`tel:${c.phone}`}
                      onClick={() => {
                        setOpened((o) => ({ ...o, [`call-${c.id}`]: 'call' }))
                        logAction('call_contact', c.id)
                      }}
                      className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-white/10 text-sm font-semibold active:scale-95"
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
                      className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-semibold text-white active:scale-95"
                    >
                      <MessageSquare className="size-4" />
                      {opened[`sms-${c.id}`] ? 'Composer opened' : 'SMS'}
                    </a>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-2 text-center text-xs text-white/60">No emergency contacts yet. Add them from the Contacts tab.</p>
            )
          ) : (
            <p className="text-xs text-white/60">Contact shortcuts are turned off in your SOS settings.</p>
          )}

          <p className="text-[11px] leading-snug text-white/50">
            SafeHer opens your phone&apos;s dialer or SMS app. You must press call or send there; SafeHer cannot tell whether a call connected or a message was sent.
          </p>
        </section>
      )}

      {settings?.audio_recording === 1 && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-semibold">
              <Mic className={`size-4 ${recording ? 'animate-pulse text-red-400' : 'text-white/60'}`} />
              {recording ? 'Recording audio…' : audioUrl ? 'Recording stopped' : 'Audio not recording'}
            </span>
            {recording && (
              <button type="button" onClick={stopRecording} className="flex min-h-11 items-center gap-1 rounded-lg bg-red-600/30 px-3 text-xs font-bold">
                <Square className="size-3" /> Stop
              </button>
            )}
          </div>
          {audioNote && <p className="mt-2 text-xs text-amber-200/90">{audioNote}</p>}
          {audioUrl && <audio src={audioUrl} controls className="mt-2 w-full" />}
          <p className="mt-2 text-[11px] leading-snug text-white/50">
            The recording exists only in this app&apos;s memory. It is not uploaded or saved, and is lost when you leave this screen.
          </p>
        </section>
      )}

      {endError && (
        <div className="rounded-xl bg-red-950/70 p-3 text-xs text-red-200" role="alert">
          <p>{endError}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => void endSos('Completed')} className="min-h-11 rounded-lg bg-white/10 px-3 font-semibold">
              Try again
            </button>
            <button type="button" onClick={leaveWithoutSyncing} className="min-h-11 rounded-lg bg-white/10 px-3 font-semibold">
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
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-semibold text-[#12060a] transition-all disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/60"
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
            "I'm safe — end SOS"
          )}
        </button>
        {!isDrill && (
          <button
            type="button"
            disabled={lockedByDelay || ending || !sosId}
            onClick={() => void endSos('Cancelled')}
            className="min-h-12 w-full rounded-2xl border border-white/20 text-sm font-medium text-white/80 disabled:opacity-40"
          >
            Accidental trigger — cancel
          </button>
        )}
      </div>
    </main>
  )
}

function StatusRow({
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
  const color = tone === 'ok' ? 'text-emerald-300' : tone === 'bad' ? 'text-red-300' : 'text-amber-200'
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex shrink-0 items-center gap-2 text-white/60">
        {icon}
        {label}
      </span>
      <span className={`min-w-0 break-words text-right font-medium ${color}`}>{value}</span>
    </div>
  )
}
