'use client'

import 'leaflet/dist/leaflet.css'
import type * as Leaflet from 'leaflet'
import { MapPin } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface MapViewProps {
  latitude: number | null
  longitude: number | null
  accuracy?: number | null
  /** Optional recorded route (e.g. an SOS location history) drawn as a line. */
  path?: { lat: number; lng: number }[]
  /** Keep the map centred on the position as it changes. */
  follow?: boolean
  markerLabel?: string
  /** Pixels at the bottom covered by an overlay (e.g. a bottom sheet); the position is centred in the visible part. */
  bottomInset?: number
  showZoom?: boolean
  /** A chosen destination, drawn as a flag-style marker (used by navigation). */
  destination?: { lat: number; lng: number; label?: string } | null
  /** Called with the tapped coordinates (used to pick a destination on the map). */
  onMapClick?: (point: { lat: number; lng: number }) => void
  /** Zoom the camera to show the whole route (and the destination) when it changes. */
  fitRoute?: boolean
}

/** Leaflet + OpenStreetMap map showing a real position, an accuracy circle and an optional route. */
export function MapView({ latitude, longitude, accuracy, path, follow = true, markerLabel = 'You are here', bottomInset = 0, showZoom = true, destination = null, onMapClick, fitRoute = false }: MapViewProps) {
  const destRef = useRef<Leaflet.CircleMarker | null>(null)
  const clickRef = useRef(onMapClick)
  useEffect(() => {
    clickRef.current = onMapClick
  })
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Leaflet.Map | null>(null)
  const markerRef = useRef<Leaflet.CircleMarker | null>(null)
  const circleRef = useRef<Leaflet.Circle | null>(null)
  const routeRef = useRef<Leaflet.Polyline | null>(null)
  const libRef = useRef<typeof Leaflet | null>(null)
  const firstFixRef = useRef(true)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const [tilesFailed, setTilesFailed] = useState(false)

  const hasPosition = latitude !== null && longitude !== null
  const hasPath = !!path && path.length > 0
  const shouldExist = hasPosition || hasPath
  // Latest values for map creation without making the creation effect re-run on every fix.
  const latRef = useRef<{ lat: number; lng: number } | null>(null)
  const pathRef = useRef(path)
  useEffect(() => {
    latRef.current = hasPosition ? { lat: latitude!, lng: longitude! } : null
    pathRef.current = path
  })

  // Load Leaflet on the client only (it touches `window`).
  useEffect(() => {
    let cancelled = false
    import('leaflet')
      .then((mod) => {
        if (cancelled) return
        libRef.current = (mod as unknown as { default?: typeof Leaflet }).default ?? mod
        setReady(true)
      })
      .catch((error) => {
        console.error('Failed to load Leaflet:', error)
        if (!cancelled) setFailed('The map library failed to load.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Create the map once a position (or route) exists, and tear it down on unmount.
  useEffect(() => {
    const L = libRef.current
    if (!ready || !L || !containerRef.current || mapRef.current) return
    if (!shouldExist) return

    const start: [number, number] = latRef.current
      ? [latRef.current.lat, latRef.current.lng]
      : [pathRef.current![0].lat, pathRef.current![0].lng]
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true }).setView(start, 16)
    map.attributionControl.setPrefix(false)
    if (showZoom) L.control.zoom({ position: 'topright' }).addTo(map)

    const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    })
    tiles.on('tileerror', () => setTilesFailed(true))
    tiles.on('tileload', () => setTilesFailed(false))
    tiles.addTo(map)
    map.on('click', (e: Leaflet.LeafletMouseEvent) => clickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }))
    mapRef.current = map

    // Keep tiles correct when the WebView resizes (keyboard, rotation, bottom sheets).
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      map.remove()
      mapRef.current = null
      markerRef.current = null
      circleRef.current = null
      routeRef.current = null
      destRef.current = null
      firstFixRef.current = true
    }
  }, [ready, shouldExist, showZoom])

  // Update marker, accuracy circle and follow behaviour as fixes arrive.
  useEffect(() => {
    const L = libRef.current
    const map = mapRef.current
    if (!L || !map || !hasPosition) return

    const point: [number, number] = [latitude!, longitude!]
    if (markerRef.current) {
      markerRef.current.setLatLng(point)
    } else {
      // A CircleMarker avoids the default image marker (whose asset paths break under bundlers).
      markerRef.current = L.circleMarker(point, {
        radius: 9,
        color: '#ffffff',
        weight: 3,
        fillColor: '#7c3aed',
        fillOpacity: 1,
      })
        .addTo(map)
        .bindTooltip(markerLabel)
    }

    if (circleRef.current) {
      circleRef.current.setLatLng(point)
      if (accuracy) circleRef.current.setRadius(accuracy)
    } else if (accuracy) {
      circleRef.current = L.circle(point, {
        radius: accuracy,
        color: '#7c3aed',
        fillColor: '#7c3aed',
        fillOpacity: 0.12,
        weight: 1,
      }).addTo(map)
    }

    if (follow || firstFixRef.current) {
      map.setView(point, firstFixRef.current ? 16 : map.getZoom(), { animate: false })
      // Shift the view so the marker sits in the middle of the part not covered by the bottom sheet.
      if (bottomInset > 0) map.panBy([0, bottomInset / 2], { animate: false })
      firstFixRef.current = false
    }
  }, [latitude, longitude, accuracy, follow, hasPosition, ready, markerLabel, bottomInset])

  // Draw / update the route line.
  useEffect(() => {
    const L = libRef.current
    const map = mapRef.current
    if (!L || !map) return
    routeRef.current?.remove()
    routeRef.current = null
    if (path && path.length > 1) {
      const line = L.polyline(
        path.map((p) => [p.lat, p.lng] as [number, number]),
        { color: destination ? '#7c3aed' : '#ef4444', weight: 5, opacity: 0.85 },
      ).addTo(map)
      routeRef.current = line
      if (!hasPosition) map.fitBounds(line.getBounds(), { padding: [32, 32] })
    }
  }, [path, hasPosition, ready, latitude, longitude, destination])

  // Camera: show the whole route once when it (not the GPS fix) changes.
  useEffect(() => {
    const L = libRef.current
    const map = mapRef.current
    if (!fitRoute || !L || !map || !path || path.length < 2) return
    map.fitBounds(L.latLngBounds(path.map((p) => [p.lat, p.lng] as [number, number])), { padding: [48, 48] })
  }, [path, fitRoute, ready, shouldExist])

  // Destination marker.
  useEffect(() => {
    const L = libRef.current
    const map = mapRef.current
    if (!L || !map) return
    destRef.current?.remove()
    destRef.current = null
    if (!destination) return
    destRef.current = L.circleMarker([destination.lat, destination.lng], {
      radius: 10,
      color: '#ffffff',
      weight: 3,
      fillColor: '#ef4444',
      fillOpacity: 1,
    })
      .addTo(map)
      .bindTooltip(destination.label || 'Destination')
  }, [destination, ready, shouldExist])

  if (failed) {
    return <MapPlaceholder text={failed} />
  }
  if (!hasPosition && !hasPath) {
    return <MapPlaceholder text="Waiting for a GPS fix…" pulse />
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={containerRef} className="h-full w-full" />
      {tilesFailed && (
        <div className="pointer-events-none absolute inset-x-4 top-16 z-[500] rounded-xl bg-card/95 px-3 py-2 text-center text-xs text-muted-foreground shadow ring-1 ring-border">
          Map tiles could not load. Check your internet connection. Your GPS position is still being recorded.
        </div>
      )}
    </div>
  )
}

function MapPlaceholder({ text, pulse }: { text: string; pulse?: boolean }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-muted px-4 text-center text-muted-foreground">
      <MapPin className={`mb-2 size-8 text-muted-foreground/60 ${pulse ? 'animate-bounce' : ''}`} />
      <p className="text-sm font-medium">{text}</p>
    </div>
  )
}

export default MapView
