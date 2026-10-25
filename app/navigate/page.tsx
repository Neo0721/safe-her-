'use client'

import {
  ArrowLeft,
  Building2,
  ExternalLink,
  Hospital,
  Loader2,
  MapPin,
  Navigation,
  Pill,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MapView } from '@/components/map-view'
import { ModeToggle } from '@/components/mode-toggle'
import { CONFIG } from '@/lib/config'
import {
  LOCATION_ERROR_TEXT,
  getLocationPermission,
  requestLocationPermission,
  watchFixes,
  type Fix,
  type LocationError,
} from '@/lib/location'
import {
  PlacesError,
  distanceBetween,
  externalDirectionsUrl,
  fetchWalkingRoute,
  findNearby,
  formatDistance,
  formatDuration,
  searchPlaces,
  type LatLng,
  type NearbyKind,
  type Place,
  type RouteResult,
} from '@/lib/places'
import { cn } from '@/lib/utils'

const REROUTE_AFTER_METERS = 120
const REROUTE_MIN_INTERVAL_MS = 20000
const ARRIVED_METERS = 30

const nearbyChips: { kind: NearbyKind; label: string; icon: typeof Building2 }[] = [
  { kind: 'police', label: 'Police', icon: ShieldCheck },
  { kind: 'hospital', label: 'Hospital', icon: Hospital },
  { kind: 'pharmacy', label: 'Pharmacy', icon: Pill },
]

export default function NavigatePage() {
  const router = useRouter()

  const [fix, setFix] = useState<Fix | null>(null)
  const [gpsError, setGpsError] = useState<LocationError | null>(null)
  const [gpsStatus, setGpsStatus] = useState('Requesting location…')

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [busy, setBusy] = useState<null | 'search' | 'nearby' | 'route'>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [destination, setDestination] = useState<Place | null>(null)
  const [route, setRoute] = useState<RouteResult | null>(null)
  const [sheetHeight, setSheetHeight] = useState(0)
  const [showSteps, setShowSteps] = useState(false)

  const sheetRef = useRef<HTMLElement>(null)
  const fixRef = useRef<Fix | null>(null)
  const routeOriginRef = useRef<{ at: number; point: LatLng } | null>(null)
  const destinationRef = useRef<Place | null>(null)
  const stopWatchRef = useRef<(() => void) | null>(null)
  const disposedRef = useRef(false)

  // ---- GPS ------------------------------------------------------------------------------
  const startGps = useCallback(async () => {
    stopWatchRef.current?.()
    stopWatchRef.current = null
    setGpsError(null)
    setGpsStatus('Requesting location…')

    let permission = await getLocationPermission()
    if (permission !== 'granted') permission = await requestLocationPermission()
    if (disposedRef.current) return
    if (permission === 'denied' || permission === 'unsupported') {
      const error = { code: permission === 'denied' ? 'denied' : 'unsupported', message: '', name: 'LocationError' } as LocationError
      setGpsError(error)
      setGpsStatus(LOCATION_ERROR_TEXT[error.code])
      return
    }
    setGpsStatus('Acquiring GPS…')
    const stop = await watchFixes(
      (next) => {
        fixRef.current = next
        setFix(next)
        setGpsStatus('Live GPS')
        setGpsError(null)
      },
      (error) => {
        setGpsError(error)
        setGpsStatus(LOCATION_ERROR_TEXT[error.code])
      }
    )
    if (disposedRef.current) {
      stop()
      return
    }
    stopWatchRef.current = stop
  }, [])

  useEffect(() => {
    disposedRef.current = false
    void startGps()
    return () => {
      disposedRef.current = true
      stopWatchRef.current?.()
      stopWatchRef.current = null
    }
  }, [startGps])

  useEffect(() => {
    const el = sheetRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setSheetHeight(el.offsetHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // ---- routing --------------------------------------------------------------------------
  const computeRoute = useCallback(async (to: Place) => {
    const from = fixRef.current
    if (!from) {
      setNotice('Waiting for a GPS fix before a route can be planned.')
      return
    }
    setBusy('route')
    setNotice(null)
    try {
      const result = await fetchWalkingRoute({ lat: from.lat, lng: from.lng }, to)
      if (disposedRef.current || destinationRef.current !== to) return
      setRoute(result)
      routeOriginRef.current = { at: Date.now(), point: { lat: from.lat, lng: from.lng } }
    } catch (error) {
      setRoute(null)
      setNotice(error instanceof PlacesError ? error.message : 'Could not plan a route.')
    } finally {
      if (!disposedRef.current) setBusy(null)
    }
  }, [])

  const chooseDestination = useCallback(
    (place: Place) => {
      destinationRef.current = place
      setDestination(place)
      setResults([])
      setRoute(null)
      setShowSteps(false)
      void computeRoute(place)
    },
    [computeRoute]
  )

  const clearDestination = () => {
    destinationRef.current = null
    setDestination(null)
    setRoute(null)
    setResults([])
    setNotice(null)
    routeOriginRef.current = null
  }

  // Re-plan when the user has clearly left the planned start point.
  useEffect(() => {
    const to = destinationRef.current
    const origin = routeOriginRef.current
    if (!fix || !to || !origin || busy) return
    const moved = distanceBetween(origin.point, { lat: fix.lat, lng: fix.lng })
    if (moved >= REROUTE_AFTER_METERS && Date.now() - origin.at >= REROUTE_MIN_INTERVAL_MS) void computeRoute(to)
  }, [fix, busy, computeRoute])

  // ---- search ---------------------------------------------------------------------------
  const runSearch = async () => {
    setBusy('search')
    setNotice(null)
    try {
      const found = await searchPlaces(query, fix ? { lat: fix.lat, lng: fix.lng } : undefined)
      setResults(found)
      if (found.length === 0) setNotice('No places matched that search.')
    } catch (error) {
      setResults([])
      setNotice(error instanceof PlacesError ? error.message : 'Search failed.')
    } finally {
      setBusy(null)
    }
  }

  const runNearby = async (kind: NearbyKind) => {
    if (!fix) {
      setNotice('Waiting for a GPS fix before nearby places can be found.')
      return
    }
    setBusy('nearby')
    setNotice(null)
    try {
      const found = await findNearby(kind, { lat: fix.lat, lng: fix.lng })
      setResults(found)
      if (found.length === 0) setNotice('Nothing of that kind was found within 4 km. Call your emergency number if you need help now.')
    } catch (error) {
      setResults([])
      setNotice(error instanceof PlacesError ? error.message : 'Could not look up nearby places.')
    } finally {
      setBusy(null)
    }
  }

  const pickOnMap = useCallback(
    (point: LatLng) => chooseDestination({ ...point, name: 'Dropped pin', detail: `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` }),
    [chooseDestination]
  )

  const straightLine = fix && destination ? distanceBetween({ lat: fix.lat, lng: fix.lng }, destination) : null
  const arrived = straightLine !== null && straightLine <= ARRIVED_METERS

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-background">
      <div className="absolute inset-0">
        <MapView
          latitude={fix?.lat ?? null}
          longitude={fix?.lng ?? null}
          accuracy={fix?.accuracy ?? null}
          path={route?.path}
          destination={destination ? { lat: destination.lat, lng: destination.lng, label: destination.name } : null}
          onMapClick={pickOnMap}
          fitRoute={!!route}
          follow={!route}
          bottomInset={sheetHeight}
          showZoom={false}
        />
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[999] bg-gradient-to-b from-background/90 to-transparent"
        style={{ height: 'calc(var(--sat) + 1.25rem)' }}
        aria-hidden="true"
      />

      <header className="pt-safe relative z-[1000] flex items-center justify-between gap-2 p-4">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="surface-raised flex size-11 shrink-0 items-center justify-center rounded-2xl shadow-lg transition-transform active:scale-90"
        >
          <ArrowLeft className="size-5" />
        </button>
        <span className="surface-raised flex min-w-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold shadow-lg">
          <span className={cn('inline-flex size-2.5 shrink-0 rounded-full', fix ? 'bg-success' : gpsError ? 'bg-danger' : 'bg-amber-500')} />
          <span className="truncate">{gpsStatus}</span>
        </span>
        <ModeToggle />
      </header>

      <div className="flex-1" />

      <section
        ref={sheetRef}
        className="relative z-[1000] max-h-[66dvh] overflow-y-auto rounded-t-[2rem] border-t border-border bg-card p-5 pb-[calc(1.25rem+var(--sab))] shadow-[0_-12px_40px_-12px_rgb(0_0_0/0.35)]"
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border" />
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Safe route</h1>
        <p className="text-sm text-muted-foreground">
          Walking directions to a place you choose. Tap the map to drop a pin, search, or find the nearest help.
        </p>

        {gpsError && (
          <div role="alert" className="mt-3 rounded-xl border border-danger/30 bg-danger/8 p-3 text-sm">
            <p>
              {gpsError.code === 'denied'
                ? 'Location permission is off. Allow it for SafeHer in your phone settings to get routes.'
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

        {!destination && (
          <>
            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void runSearch()
              }}
            >
              <label className="sr-only" htmlFor="place-search">
                Search for a place
              </label>
              <input
                id="place-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a place or address"
                enterKeyHint="search"
                className="surface-raised min-h-12 min-w-0 flex-1 rounded-2xl px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
              <button
                type="submit"
                disabled={busy !== null || query.trim().length < 3}
                aria-label="Search"
                className="gradient-primary flex size-12 shrink-0 items-center justify-center rounded-2xl disabled:opacity-50"
              >
                {busy === 'search' ? <Loader2 className="size-5 animate-spin" /> : <Search className="size-5" />}
              </button>
            </form>

            <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Find nearest">
              {nearbyChips.map(({ kind, label, icon: Icon }) => (
                <button
                  key={kind}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void runNearby(kind)}
                  className="surface-raised flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-bold transition-transform active:scale-95 disabled:opacity-50"
                >
                  <Icon className="size-5 text-primary" />
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        {notice && (
          <p role="alert" className="mt-3 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            {notice}
          </p>
        )}

        {!destination && results.length > 0 && (
          <ul className="mt-3 space-y-2" aria-label="Places">
            {results.map((p, i) => (
              <li key={`${p.lat}-${p.lng}-${i}`}>
                <button
                  type="button"
                  onClick={() => chooseDestination(p)}
                  className="surface-raised flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left active:scale-[0.98]"
                >
                  <MapPin className="size-5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.name}</span>
                    {p.detail && <span className="block truncate text-xs text-muted-foreground">{p.detail}</span>}
                  </span>
                  {p.distance !== undefined && <span className="shrink-0 text-xs font-semibold text-muted-foreground">{formatDistance(p.distance)}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}

        {destination && (
          <div className="mt-4">
            <div className="surface-raised flex items-center gap-3 rounded-2xl p-3">
              <span className="gradient-danger flex size-10 shrink-0 items-center justify-center rounded-xl">
                <MapPin className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{destination.name}</p>
                {destination.detail && <p className="truncate text-xs text-muted-foreground">{destination.detail}</p>}
              </div>
              <button
                type="button"
                onClick={clearDestination}
                aria-label="Clear destination"
                className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground active:bg-muted"
              >
                <X className="size-5" />
              </button>
            </div>

            {busy === 'route' && (
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground" role="status">
                <Loader2 className="size-4 animate-spin" /> Planning a walking route…
              </p>
            )}

            {arrived && (
              <p role="status" className="mt-3 rounded-xl bg-success/15 p-3 text-sm font-semibold text-success">
                You have arrived.
              </p>
            )}

            {route && !arrived && (
              <>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Stat label="Walking" value={formatDistance(route.distance)} />
                  <Stat label="Time" value={formatDuration(route.duration)} />
                  <Stat label="Straight line" value={straightLine !== null ? formatDistance(straightLine) : '…'} />
                </div>

                <button
                  type="button"
                  onClick={() => setShowSteps((s) => !s)}
                  aria-expanded={showSteps}
                  className="mt-3 flex min-h-11 w-full items-center justify-between rounded-xl px-1 text-sm font-semibold text-primary"
                >
                  {showSteps ? 'Hide' : 'Show'} turn-by-turn steps ({route.steps.length})
                  <Navigation className="size-4" />
                </button>
                {showSteps && (
                  <ol className="mt-1 space-y-1.5 text-sm">
                    {route.steps.map((s, i) => (
                      <li key={i} className="flex items-start justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2">
                        <span>{s.instruction}</span>
                        {s.distance > 0 && <span className="shrink-0 text-xs text-muted-foreground">{formatDistance(s.distance)}</span>}
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <a
                href={externalDirectionsUrl(destination)}
                target="_blank"
                rel="noopener noreferrer"
                className="surface-raised flex min-h-14 items-center justify-center gap-2 rounded-2xl text-sm font-bold active:scale-95"
              >
                <ExternalLink className="size-5 text-muted-foreground" />
                Open in Maps
              </a>
              <a
                href={`tel:${CONFIG.emergencyNumber}`}
                className="gradient-danger glow-danger flex min-h-14 items-center justify-center gap-2 rounded-2xl text-sm font-bold active:scale-95"
              >
                Call {CONFIG.emergencyNumber}
              </a>
            </div>
          </div>
        )}

        <p className="mt-4 text-[11px] leading-snug text-muted-foreground">
          Routes come from the public OpenStreetMap routing service and need internet. They are a guide only: stay aware of your
          surroundings and prefer well-lit, busy streets.
        </p>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted/60 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  )
}
