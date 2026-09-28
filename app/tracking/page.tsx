'use client'

import { ArrowLeft, BatteryMedium, Crosshair, Info, MapPin, PhoneCall, RefreshCw, Signal, Square } from 'lucide-react'
import { motion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { MapView } from '@/components/map-view'
import { ModeToggle } from '@/components/mode-toggle'
import { useAuth } from '@/contexts/AuthContext'
import { apiJson, errorMessage } from '@/lib/api-fetch'
import { CONFIG } from '@/lib/config'
import { useBattery, useNetwork } from '@/lib/hooks/use-device-status'
import {
  LOCATION_ERROR_TEXT,
  distanceMeters,
  getLocationPermission,
  requestLocationPermission,
  watchFixes,
  type Fix,
  type LocationError,
} from '@/lib/location'
import type { Contact } from '@/lib/types'
import { generateUUID } from '@/lib/utils'

function formatCoords(lat: number, lng: number) {
  return `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(5)}° ${lng >= 0 ? 'E' : 'W'}`
}

export default function TrackingPage() {
  const router = useRouter()
  const { user } = useAuth()

  const [fix, setFix] = useState<Fix | null>(null)
  const [status, setStatus] = useState('Requesting location…')
  const [gpsError, setGpsError] = useState<LocationError | null>(null)
  const [contactCount, setContactCount] = useState<number | null>(null)
  const [saved, setSaved] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [stopping, setStopping] = useState(false)
  const [sheetHeight, setSheetHeight] = useState(0)
  const sheetRef = useRef<HTMLElement>(null)

  const battery = useBattery()
  const network = useNetwork()

  const tripIdRef = useRef<string | null>(null)
  const stopWatchRef = useRef<(() => void) | null>(null)
  const lastSavedRef = useRef<{ at: number; lat: number; lng: number } | null>(null)
  const tripStartedRef = useRef(false)
  const disposedRef = useRef(false) // true once the screen has unmounted: late async results must clean up after themselves

  const onFix = useCallback((next: Fix) => {
    setFix(next)
    setStatus('Live GPS')
    setGpsError(null)

    const tripId = tripIdRef.current
    if (!tripId) return
    const now = Date.now()
    const last = lastSavedRef.current
    const due = !last || now - last.at >= CONFIG.locationUpdateIntervalMs
    const moved = !last || distanceMeters(last.lat, last.lng, next.lat, next.lng) >= CONFIG.locationMinDistanceMeters
    if (!due || !moved) return
    lastSavedRef.current = { at: now, lat: next.lat, lng: next.lng }

    apiJson('/api/location', {
      method: 'POST',
      json: { trip_id: tripId, latitude: next.lat, longitude: next.lng, accuracy: next.accuracy },
    })
      .then(() => {
        setSaved((n) => n + 1)
        setUploadError(null)
      })
      .catch((error) => setUploadError(errorMessage(error)))
  }, [])

  const startGps = useCallback(async () => {
    stopWatchRef.current?.()
    stopWatchRef.current = null
    setGpsError(null)
    setStatus('Requesting location…')

    let permission = await getLocationPermission()
    if (permission !== 'granted') permission = await requestLocationPermission()
    if (disposedRef.current) return
    if (permission === 'denied' || permission === 'unsupported') {
      const error = { code: permission === 'denied' ? 'denied' : 'unsupported', message: '', name: 'LocationError' } as LocationError
      setGpsError(error)
      setStatus(LOCATION_ERROR_TEXT[error.code])
      return
    }
    setStatus('Acquiring GPS…')
    const stop = await watchFixes(onFix, (error) => {
      setGpsError(error)
      setStatus(LOCATION_ERROR_TEXT[error.code])
    })
    if (disposedRef.current) {
      stop() // the screen was left while the watcher was being registered
      return
    }
    stopWatchRef.current = stop
  }, [onFix])

  useEffect(() => {
    if (!user) return
    disposedRef.current = false

    if (!tripStartedRef.current) {
      tripStartedRef.current = true
      const tripId = generateUUID()
      apiJson('/api/trips', { method: 'POST', json: { id: tripId } })
        .then(() => {
          if (disposedRef.current) {
            // Left the screen before the session was created: close it right away.
            apiJson('/api/trips', { method: 'PUT', json: { id: tripId } }).catch(() => {})
          } else {
            tripIdRef.current = tripId
          }
        })
        .catch((error) => {
          setUploadError(`Tracking session was not saved: ${errorMessage(error)}`)
        })
      apiJson<Contact[]>('/api/contacts')
        .then((c) => setContactCount(c.length))
        .catch(() => setContactCount(null))
    }
    void startGps()

    return () => {
      disposedRef.current = true
      stopWatchRef.current?.()
      stopWatchRef.current = null
      const id = tripIdRef.current
      tripIdRef.current = null
      if (id) apiJson('/api/trips', { method: 'PUT', json: { id } }).catch(() => {})
      // React Strict Mode (dev) remounts immediately; a fresh session is created for the remount.
      tripStartedRef.current = false
    }
  }, [user, startGps])

  const stopSharing = async () => {
    setStopping(true)
    stopWatchRef.current?.()
    stopWatchRef.current = null
    const id = tripIdRef.current
    tripIdRef.current = null
    try {
      if (id) await apiJson('/api/trips', { method: 'PUT', json: { id } })
      toast.success('Location tracking stopped')
    } catch (error) {
      toast.error(`Tracking stopped on this device, but the session could not be closed: ${errorMessage(error)}`)
    }
    router.replace('/home')
  }

  // Keep the map's marker in the visible area above the bottom sheet.
  useEffect(() => {
    const el = sheetRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setSheetHeight(el.offsetHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const online = network.connected

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-background">
      <div className="absolute inset-0">
        <MapView
          latitude={fix?.lat ?? null}
          longitude={fix?.lng ?? null}
          accuracy={fix?.accuracy ?? null}
          bottomInset={sheetHeight}
          showZoom={false}
        />
      </div>

      <header className="pt-safe relative z-[1000] flex items-center justify-between gap-2 p-4">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card text-foreground shadow-lg ring-1 ring-border"
        >
          <ArrowLeft className="size-5" />
        </button>
        <span className="flex min-w-0 items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-semibold shadow-lg ring-1 ring-border">
          <span className="relative flex size-2.5 shrink-0">
            {fix && <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />}
            <span className={`relative inline-flex size-2.5 rounded-full ${fix ? 'bg-success' : gpsError ? 'bg-danger' : 'bg-amber-500'}`} />
          </span>
          <span className="truncate">{status}</span>
        </span>
        <ModeToggle />
      </header>

      <div className="flex-1" />

      <motion.section
        ref={sheetRef}
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className="relative z-[1000] max-h-[62dvh] overflow-y-auto rounded-t-3xl border-t border-border bg-card p-5 pb-[calc(1.25rem+var(--sab))] shadow-2xl"
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border" />
        <h1 className="font-display text-lg font-bold">Live Location</h1>
        <p className="text-sm text-muted-foreground">
          {fix ? 'Your real GPS position is being recorded to your SafeHer history.' : 'Waiting for a real GPS fix…'}
        </p>

        {gpsError && (
          <div role="alert" className="mt-3 rounded-xl border border-danger/30 bg-danger/8 p-3 text-sm">
            <p className="text-foreground">
              {gpsError.code === 'denied'
                ? 'Location permission is off. Allow it for SafeHer in your phone settings.'
                : gpsError.code === 'unsupported'
                  ? 'This device does not provide location.'
                  : 'No GPS fix yet. Try moving to an open area.'}
            </p>
            <button
              type="button"
              onClick={() => void startGps()}
              className="mt-2 flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 font-semibold"
            >
              <RefreshCw className="size-4" /> Try again
            </button>
          </div>
        )}
        {uploadError && (
          <p role="alert" className="mt-3 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            {uploadError}
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Tile icon={MapPin} label="Coordinates" value={fix ? formatCoords(fix.lat, fix.lng) : 'Unavailable'} wide />
          <Tile icon={Crosshair} label="Accuracy" value={fix ? `±${Math.round(fix.accuracy)} m` : 'Unavailable'} />
          <Tile
            icon={BatteryMedium}
            label="Battery"
            value={battery.level === null ? (battery.ready ? 'Not available' : '…') : `${battery.level}%${battery.charging ? ' · charging' : ''}`}
          />
          <Tile
            icon={Signal}
            label="Network"
            value={online === null ? '…' : online ? `Online${network.type ? ` (${network.type})` : ''}` : 'Offline'}
          />
          <Tile icon={MapPin} label="Points saved" value={String(saved)} />
        </div>

        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>
            Tracking runs only while this screen is open. Your location is saved to your own history
            {contactCount ? `; it is not sent to your ${contactCount} emergency contact${contactCount === 1 ? '' : 's'} automatically` : ''}.
          </span>
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => void stopSharing()}
            disabled={stopping}
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-border text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-50"
          >
            <Square className="size-5 text-muted-foreground" />
            Stop tracking
          </button>
          <a
            href={`tel:${CONFIG.emergencyNumber}`}
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-destructive text-sm font-semibold text-primary-foreground shadow-md shadow-destructive/25 active:scale-95"
          >
            <PhoneCall className="size-5" />
            Call {CONFIG.emergencyNumber}
          </a>
        </div>
      </motion.section>
    </div>
  )
}

function Tile({
  icon: Icon,
  label,
  value,
  wide,
}: {
  icon: typeof MapPin
  label: string
  value: string
  wide?: boolean
}) {
  return (
    <div className={`min-w-0 rounded-2xl bg-muted/60 p-3 ${wide ? 'col-span-2' : ''}`}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4 shrink-0" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-1 break-words text-sm font-semibold">{value}</p>
    </div>
  )
}
